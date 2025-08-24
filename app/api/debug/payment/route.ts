import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/prisma/prisma.config';
import { mercadoPagoService } from '@/lib/mercadopago';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('id');

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: 'ID do pagamento é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`[DEBUG] Verificando pagamento ID: ${paymentId}`);

    // Buscar no banco de dados
    const dbPayment = await paymentService.getPaymentByMercadoPagoId(paymentId);
    
    // Buscar no Mercado Pago
    let mpPayment = null;
    try {
      mpPayment = await mercadoPagoService.getPaymentDetails(paymentId);
    } catch (mpError) {
      console.log(`[DEBUG] Erro ao buscar no MP:`, mpError);
    }

    // Comparar status
    const statusMatch = dbPayment && mpPayment ? dbPayment.status === mpPayment.status : false;
    
    const debugInfo = {
      paymentId,
      timestamp: new Date().toISOString(),
      
      // Banco de dados
      database: dbPayment ? {
        id: dbPayment.id,
        status: dbPayment.status,
        createdAt: dbPayment.createdAt,
        updatedAt: dbPayment.updatedAt,
        mercadopagoId: dbPayment.mercadopagoId,
        externalReference: dbPayment.externalReference,
        amount: dbPayment.amount,
        payerName: dbPayment.payerName,
        payerEmail: dbPayment.payerEmail,
      } : null,
      
      // Mercado Pago
      mercadopago: mpPayment ? {
        id: mpPayment.id,
        status: mpPayment.status,
        external_reference: mpPayment.external_reference,
        transaction_amount: mpPayment.transaction_amount,
        date_created: mpPayment.date_created,
        date_last_updated: mpPayment.date_last_updated,
        status_detail: (mpPayment as any).status_detail,
        rejection_reason: (mpPayment as any).rejection_reason,
      } : null,
      
      // Análise
      analysis: {
        statusMatch,
        statusDifference: dbPayment && mpPayment ? {
          database: dbPayment.status,
          mercadopago: mpPayment.status,
          needsUpdate: dbPayment.status !== mpPayment.status,
        } : null,
        lastWebhookEvent: dbPayment?.webhookEvents?.[0] ? {
          type: dbPayment.webhookEvents[0].eventType,
          processed: dbPayment.webhookEvents[0].processed,
          createdAt: dbPayment.webhookEvents[0].createdAt,
        } : null,
      }
    };

    console.log(`[DEBUG] Análise completa:`, debugInfo);

    return NextResponse.json({
      success: true,
      debug: debugInfo,
    });

  } catch (err) {
    console.error('[DEBUG] Erro ao analisar pagamento:', err);
    return NextResponse.json(
      { success: false, error: 'Falha ao analisar pagamento' },
      { status: 500 }
    );
  }
} 