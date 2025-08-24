import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/prisma/prisma.config';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    console.log(`[RECENT-PAYMENTS] Listando ${limit} pagamentos mais recentes`);
    
    // Buscar pagamentos mais recentes
    const payments = await paymentService.listPayments({
      skip: 0,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
    
    // Contar total
    const total = await paymentService.countPayments();
    
    console.log(`[RECENT-PAYMENTS] Encontrados ${payments.length} pagamentos de ${total} total`);
    
    // Formatar dados para exibição
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      mercadopagoId: payment.mercadopagoId,
      externalReference: payment.externalReference,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      payerName: payment.payerName,
      payerEmail: payment.payerEmail,
      payerCpf: payment.payerCpf,
      description: payment.description,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      // Contar webhooks
      webhookCount: payment.webhookEvents?.length || 0,
      // Último webhook
      lastWebhook: payment.webhookEvents?.[0] ? {
        type: payment.webhookEvents[0].eventType,
        processed: payment.webhookEvents[0].processed,
        createdAt: payment.webhookEvents[0].createdAt,
      } : null
    }));
    
    return NextResponse.json({
      success: true,
      data: formattedPayments,
      pagination: {
        total,
        limit,
        showing: payments.length
      },
      summary: {
        byStatus: payments.reduce((acc, p) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byPaymentMethod: payments.reduce((acc, p) => {
          acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });
    
  } catch (err) {
    console.error('[RECENT-PAYMENTS] Erro ao listar pagamentos:', err);
    return NextResponse.json(
      { success: false, error: 'Falha ao listar pagamentos' },
      { status: 500 }
    );
  }
} 