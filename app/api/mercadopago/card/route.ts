import { NextRequest, NextResponse } from 'next/server';
import { mercadoPagoService } from '@/lib/mercadopago';
import { paymentService } from '@/prisma/prisma.config';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('[CARD-API] 📝 Recebendo dados do pagamento:', {
      amount: body.amount,
      payerName: body.payer?.name,
      payerEmail: body.payer?.email,
      payerCpf: body.payer?.identification?.number,
      externalReference: body.external_reference,
      paymentMethod: body.payment_method_id,
      // Log completo do body para debug
      fullBody: JSON.stringify(body, null, 2)
    });

    // === SALVAR NO BANCO ANTES DE PROCESSAR ===
    let dbPayment = null;
    try {
      // Extrair dados do pagador com validação
      const payerName = String(body.payer?.name || 'Nome não informado');
      const payerEmail = String(body.payer?.email || 'email@nao.informado');
      const payerCpf = String(body.payer?.identification?.number || 'CPF não informado').replace(/\D/g, '');
      
      console.log('[CARD-API] 🔍 Dados extraídos para o banco:', {
        payerName,
        payerEmail,
        payerCpf,
        rawPayer: body.payer
      });
      
      // Criar pagamento no banco com status PENDING
      dbPayment = await paymentService.createPayment({
        mercadopagoId: `pending_${Date.now()}`, // ID temporário até receber o webhook
        externalReference: String(body.external_reference || `order_${Date.now()}`),
        amount: Number(body.amount),
        paymentMethod: String(body.payment_method_id || 'credit_card'),
        payerName: payerName,
        payerEmail: payerEmail,
        payerCpf: payerCpf,
        description: String(body.description || 'Pagamento com cartão de crédito'),
        items: body.items || undefined,
        initialStatus: 'PENDING', // Status inicial
      });
      
      console.log('[CARD-API] ✅ Pagamento salvo no banco:', {
        id: dbPayment.id,
        status: dbPayment.status,
        payerName: dbPayment.payerName,
        payerEmail: dbPayment.payerEmail,
        payerCpf: dbPayment.payerCpf
      });
      
    } catch (dbError) {
      console.error('[CARD-API] ❌ Erro ao salvar no banco:', dbError);
      // Continuar mesmo com erro no banco
    }

    // === PROCESSAR PAGAMENTO NO MERCADO PAGO ===
    const mpData = await mercadoPagoService.createCardPayment({
      token: body.token,
      issuer_id: body.issuer_id,
      payment_method_id: body.payment_method_id,
      installments: body.installments,
      amount: body.amount,
      description: body.description,
      external_reference: body.external_reference,
      payer: body.payer,
    });

    console.log('[CARD-API] ✅ Pagamento processado no MP:', {
      id: mpData.id,
      status: mpData.status,
      externalReference: mpData.external_reference
    });

    // === ATUALIZAR BANCO COM ID REAL DO MP ===
    if (dbPayment && mpData.id) {
      try {
        // Atualizar o pagamento com o ID real do Mercado Pago
        await paymentService.updatePaymentWithMercadoPagoId(
          dbPayment.id,
          String(mpData.id),
          mpData.status
        );
        
        console.log('[CARD-API] ✅ Banco atualizado com ID real do MP:', mpData.id);
        
      } catch (updateError) {
        console.error('[CARD-API] ❌ Erro ao atualizar ID do MP:', updateError);
      }
    }

    // Retornar dados do MP + informações do banco
    return NextResponse.json({
      ...mpData,
      saved_to_db: !!dbPayment,
      db_payment_id: dbPayment?.id || null,
    }, { status: 200 });
    
  } catch (e) {
    console.error('[CARD-API] ❌ Erro ao processar pagamento:', e);
    return NextResponse.json({ 
      error: 'Erro ao processar pagamento',
      details: e instanceof Error ? e.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
