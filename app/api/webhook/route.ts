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

  // Log leve (remova/ajuste em produção)
  console.log('[WEBHOOK] type:', type, 'paymentId:', paymentId, 'body:', body);

  const isPayment =
    (typeof type === 'string' && type.includes('payment')) || !!paymentId;

  if (!isPayment) {
    // Não é notificação de pagamento; apenas ACK para evitar re-tentativas
    return NextResponse.json(
      { success: true, message: 'Webhook recebido (não é payment)' },
      { status: 200 }
    );
  }

  if (!paymentId) {
    // Sem ID — não dá para consultar; ainda assim responda 200 para evitar flood
    return NextResponse.json(
      { success: false, message: 'Payment sem id' },
      { status: 200 }
    );
  }

  // Consulta com pequenas re-tentativas (às vezes o MP ainda não propagou o pagamento)
  const maxAttempts = 3;
  let details: any = null;
  let attempt = 0;
  let lastErr: any = null;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      details = await mercadoPagoService.getPaymentDetails(paymentId);
      if (details) break;
    } catch (e) {
      lastErr = e;
      await sleep(350 * attempt); // backoff leve
    }
  }

  if (!details) {
    console.error('[WEBHOOK] Falha ao obter detalhes do payment:', paymentId, lastErr);
    return NextResponse.json(
      { success: false, error: 'Não foi possível obter detalhes do pagamento' },
      { status: 200 }
    );
  }

  console.log('[WEBHOOK] payment details:', {
    id: details.id,
    status: details.status,
    external_reference: details.external_reference,
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

      if (buyerEmail) {
        await sendPaymentConfirmationEmail({
          to: buyerEmail,
          name: details?.payer?.first_name
            ? `${details.payer.first_name} ${details.payer.last_name || ''}`.trim()
            : undefined,
          orderId,
          amount: total,
          items,
          receiptUrl: details?.point_of_interaction?.transaction_data?.ticket_url,
        });
      } else {
        console.warn('[WEBHOOK] buyerEmail não encontrado para envio de e-mail.');
      }
    } catch (e) {
      console.error('[WEBHOOK] Erro ao enviar e-mail de confirmação:', e);
    }
  }

  // 3) Retornar ACK
  return NextResponse.json(
    {
      success: true,
      message: 'Webhook processado com sucesso',
      paymentId,
      status: details.status,
    },
    { status: 200 }
  );
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
