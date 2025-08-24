import { NextRequest, NextResponse } from 'next/server';
import { mercadoPagoService } from '@/lib/mercadopago';
import { sendPaymentConfirmationEmail } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  // Alguns webhooks chegam sem JSON válido; tratamos isso.
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const url = new URL(req.url);
  // MP pode mandar "type", "topic" ou "action" (ex.: payment.updated)
  const type =
    body?.type ||
    body?.action ||
    url.searchParams.get('type') ||
    url.searchParams.get('topic') ||
    url.searchParams.get('action') ||
    '';

  // O id do pagamento pode vir em body.data.id, ?data.id=... ou ?id=...
  const paymentId =
    body?.data?.id ||
    url.searchParams.get('data.id') ||
    url.searchParams.get('id') ||
    null;

  // Log detalhado para debug
  console.log('[WEBHOOK] ===== NOVO WEBHOOK RECEBIDO =====');
  console.log('[WEBHOOK] type:', type);
  console.log('[WEBHOOK] paymentId:', paymentId);
  console.log('[WEBHOOK] body completo:', JSON.stringify(body, null, 2));
  console.log('[WEBHOOK] URL params:', Object.fromEntries(url.searchParams.entries()));

  const isPayment =
    (typeof type === 'string' && type.includes('payment')) || !!paymentId;

  if (!isPayment) {
    console.log('[WEBHOOK] Não é notificação de pagamento - ignorando');
    // Não é notificação de pagamento; apenas ACK para evitar re-tentativas
    return NextResponse.json(
      { success: true, message: 'Webhook recebido (não é payment)' },
      { status: 200 }
    );
  }

  if (!paymentId) {
    console.log('[WEBHOOK] Payment sem ID - ignorando');
    // Sem ID — não dá para consultar; ainda assim responda 200 para evitar flood
    return NextResponse.json(
      { success: false, message: 'Payment sem id' },
      { status: 200 }
    );
  }

  console.log('[WEBHOOK] Processando pagamento ID:', paymentId);

  // Consulta com pequenas re-tentativas (às vezes o MP ainda não propagou o pagamento)
  const maxAttempts = 3;
  let details: any = null;
  let attempt = 0;
  let lastErr: any = null;

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`[WEBHOOK] Tentativa ${attempt}/${maxAttempts} de obter detalhes do payment`);
    
    try {
      details = await mercadoPagoService.getPaymentDetails(paymentId);
      if (details) {
        console.log(`[WEBHOOK] Detalhes obtidos na tentativa ${attempt}:`, {
          id: details.id,
          status: details.status,
          external_reference: details.external_reference,
        });
        break;
      }
    } catch (e) {
      lastErr = e;
      console.log(`[WEBHOOK] Erro na tentativa ${attempt}:`, e);
      if (attempt < maxAttempts) {
        console.log(`[WEBHOOK] Aguardando ${350 * attempt}ms antes da próxima tentativa...`);
        await sleep(350 * attempt); // backoff leve
      }
    }
  }

  if (!details) {
    console.error('[WEBHOOK] Falha ao obter detalhes do payment após todas as tentativas:', paymentId, lastErr);
    return NextResponse.json(
      { success: false, error: 'Não foi possível obter detalhes do pagamento' },
      { status: 200 }
    );
  }

  console.log('[WEBHOOK] ===== DETALHES FINAIS DO PAGAMENTO =====');
  console.log('[WEBHOOK] payment details:', {
    id: details.id,
    status: details.status,
    external_reference: details.external_reference,
    transaction_amount: details.transaction_amount,
    payment_method_id: details.payment_method_id,
    date_created: details.date_created,
    date_last_updated: details.date_last_updated,
  });

  // === SUA LÓGICA DE NEGÓCIO ===
  // 1) Atualize o banco (pedido → pago) usando external_reference / id
  //    Exemplo (Prisma):
  // await prisma.order.update({
  //   where: { externalRef: details.external_reference },
  //   data: {
  //     status: 'PAID',
  //     paymentId: String(details.id),
  //     paidAt: new Date(),
  //   },
  // });

  // 2) Se aprovado, enviar e-mail de confirmação
  if (details.status === 'approved') {
    console.log('[WEBHOOK] 🎉 Pagamento APROVADO! Enviando e-mail de confirmação...');
    
    try {
      const buyerEmail =
        details?.metadata?.buyer_email ||
        details?.payer?.email ||
        details?.additional_info?.payer?.email;

      const orderId =
        details?.external_reference || details?.metadata?.order_id || String(details.id);

      const items = Array.isArray(details?.additional_info?.items)
        ? details.additional_info.items.map((it: any) => ({
            title: it.title,
            quantity: Number(it.quantity || 1),
            unit_price: Number(it.unit_price || it.unitPrice || 0),
          }))
        : [];

      const total = Number(details?.transaction_amount || 0);

      console.log('[WEBHOOK] Dados para e-mail:', {
        buyerEmail,
        orderId,
        total,
        itemsCount: items.length,
      });

      if (buyerEmail) {
        const emailResult = await sendPaymentConfirmationEmail({
          to: buyerEmail,
          name: details?.payer?.first_name
            ? `${details.payer.first_name} ${details.payer.last_name || ''}`.trim()
            : undefined,
          orderId,
          amount: total,
          items,
          receiptUrl: details?.point_of_interaction?.transaction_data?.ticket_url,
        });
        
        console.log('[WEBHOOK] ✅ E-mail enviado com sucesso:', {
          messageId: emailResult.messageId,
          previewUrl: emailResult.previewUrl,
        });
      } else {
        console.warn('[WEBHOOK] ⚠️ buyerEmail não encontrado para envio de e-mail.');
      }
    } catch (e) {
      console.error('[WEBHOOK] ❌ Erro ao enviar e-mail de confirmação:', e);
    }
  } else if (details.status === 'rejected') {
    // 3) Se rejeitado, logar detalhes da rejeição
    console.log('[WEBHOOK] ❌ Pagamento REJEITADO! Analisando motivo...');
    
    // Detectar o motivo específico da rejeição
    let rejectionReason = 'Erro geral no processamento';
    let rejectionType = 'general_error';
    
    // Verificar se é por quantia insuficiente
    if ((details as any).status_detail === 'cc_rejected_insufficient_amount' || 
        (details as any).rejection_reason === 'cc_rejected_insufficient_amount' ||
        (details as any).status_detail === 'insufficient_amount' ||
        (details as any).rejection_reason === 'insufficient_amount') {
      rejectionReason = 'Quantia insuficiente';
      rejectionType = 'insufficient_amount';
    }
    // Verificar outros tipos comuns de rejeição
    else if ((details as any).status_detail === 'cc_rejected_bad_filled_card_number' ||
             (details as any).rejection_reason === 'cc_rejected_bad_filled_card_number') {
      rejectionReason = 'Número do cartão inválido';
      rejectionType = 'invalid_card_number';
    }
    else if ((details as any).status_detail === 'cc_rejected_bad_filled_date' ||
             (details as any).rejection_reason === 'cc_rejected_bad_filled_date') {
      rejectionReason = 'Data de validade inválida';
      rejectionType = 'invalid_expiry_date';
    }
    else if ((details as any).status_detail === 'cc_rejected_bad_filled_other' ||
             (details as any).rejection_reason === 'cc_rejected_bad_filled_other') {
      rejectionReason = 'Dados do cartão incorretos';
      rejectionType = 'invalid_card_data';
    }
    else if ((details as any).status_detail === 'cc_rejected_call_for_authorize' ||
             (details as any).rejection_reason === 'cc_rejected_call_for_authorize') {
      rejectionReason = 'Autorização necessária';
      rejectionType = 'authorization_required';
    }
    else if ((details as any).status_detail === 'cc_rejected_insufficient_amount' ||
             (details as any).rejection_reason === 'cc_rejected_insufficient_amount') {
      rejectionReason = 'Limite insuficiente';
      rejectionType = 'insufficient_limit';
    }
    
    // Extrair informações sobre a rejeição
    const rejectionDetails = {
      paymentId: details.id,
      externalReference: details.external_reference,
      amount: details.transaction_amount,
      paymentMethod: details.payment_method_id,
      statusDetail: (details as any).status_detail || 'unknown',
      cardholderName: details?.payer?.first_name ? 
        `${details.payer.first_name} ${details.payer.last_name || ''}`.trim() : 
        'N/A',
      buyerEmail: details?.metadata?.buyer_email || details?.payer?.email || 'N/A',
      rejectionReason: rejectionReason,
      rejectionType: rejectionType,
      originalStatusDetail: (details as any).status_detail || 'unknown',
      originalRejectionReason: (details as any).rejection_reason || 'unknown',
      dateRejected: new Date().toISOString(),
    };
    
    console.log('[WEBHOOK] Detalhes da rejeição:', rejectionDetails);
    
    // Log específico para quantia insuficiente
    if (rejectionType === 'insufficient_amount') {
      console.log('[WEBHOOK] 💳 REJEIÇÃO POR QUANTIA INSUFICIENTE!');
      console.log('[WEBHOOK] - Valor da transação:', details.transaction_amount);
      console.log('[WEBHOOK] - Método de pagamento:', details.payment_method_id);
      console.log('[WEBHOOK] - Portador:', rejectionDetails.cardholderName);
      console.log('[WEBHOOK] - E-mail:', rejectionDetails.buyerEmail);
    }
    
    // Aqui você pode implementar:
    // - Notificação para a equipe de suporte
    // - Atualização do status no banco de dados
    // - Envio de e-mail informando sobre a rejeição
    // - Log para análise de fraudes
    
    console.log('[WEBHOOK] 💡 Ações recomendadas para rejeição:');
    if (rejectionType === 'insufficient_amount') {
      console.log('[WEBHOOK] - Verificar limite disponível no cartão');
      console.log('[WEBHOOK] - Sugerir pagamento em parcelas');
      console.log('[WEBHOOK] - Oferecer outras formas de pagamento');
    } else {
      console.log('[WEBHOOK] - Verificar dados do cartão');
      console.log('[WEBHOOK] - Confirmar limite disponível');
      console.log('[WEBHOOK] - Validar informações do pagador');
      console.log('[WEBHOOK] - Verificar se não é uma tentativa de fraude');
    }
    
  } else if (details.status === 'cancelled') {
    console.log('[WEBHOOK] ⏹️ Pagamento CANCELADO pelo usuário ou sistema');
  } else if (details.status === 'in_process') {
    console.log('[WEBHOOK] 🔄 Pagamento em PROCESSAMENTO/ANÁLISE');
  } else {
    console.log(`[WEBHOOK] 📋 Pagamento com status: ${details.status} - monitorando...`);
  }

  // 3) Retornar ACK
  const response = {
    success: true,
    message: 'Webhook processado com sucesso',
    paymentId,
    status: details.status,
    external_reference: details.external_reference,
    processed_at: new Date().toISOString(),
  };
  
  console.log('[WEBHOOK] ===== RESPOSTA DO WEBHOOK =====');
  console.log('[WEBHOOK] Response:', response);
  
  return NextResponse.json(response, { status: 200 });
}

// Healthcheck simples
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return NextResponse.json({
    status: 'ok',
    ts: new Date().toISOString(),
    echo: Object.fromEntries(searchParams.entries()),
  });
}
