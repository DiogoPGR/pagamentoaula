import { NextRequest, NextResponse } from 'next/server';
import { mercadoPagoService } from '@/lib/mercadopago';
import { paymentService } from '@/prisma/prisma.config';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // aceita ?id=... ou ?paymentId=...
    const id =
      searchParams.get('id') ||
      searchParams.get('paymentId') ||
      undefined;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID do pagamento é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`[PAYMENT-STATUS] Consultando status do pagamento ID: ${id}`);

    // Buscar no banco de dados primeiro
    let dbPayment = null;
    try {
      dbPayment = await paymentService.getPaymentByMercadoPagoId(id);
      if (dbPayment) {
        console.log(`[PAYMENT-STATUS] Pagamento encontrado no banco:`, {
          id: dbPayment.id,
          status: dbPayment.status,
          amount: dbPayment.amount,
          payerName: dbPayment.payerName,
        });
      }
    } catch (dbError) {
      console.log(`[PAYMENT-STATUS] Erro ao buscar no banco:`, dbError);
      // Continuar com consulta ao Mercado Pago
    }

    // Buscar no Mercado Pago para dados atualizados
    const mpDetails = await mercadoPagoService.getPaymentDetails(id);

    console.log(`[PAYMENT-STATUS] Status obtido do MP para ${id}:`, {
      status: mpDetails.status,
      external_reference: mpDetails.external_reference,
      amount: mpDetails.transaction_amount,
    });

    // Determinar o tipo específico de rejeição
    let rejectionReason = 'Erro geral no processamento';
    let rejectionType = 'general_error';

    if (mpDetails.status === 'rejected') {
      // Verificar se é por quantia insuficiente
      if ((mpDetails as any).status_detail === 'cc_rejected_insufficient_amount' || 
          (mpDetails as any).rejection_reason === 'cc_rejected_insufficient_amount' ||
          (mpDetails as any).status_detail === 'insufficient_amount' ||
          (mpDetails as any).rejection_reason === 'insufficient_amount') {
        rejectionReason = 'Quantia insuficiente';
        rejectionType = 'insufficient_amount';
      }
      // Verificar outros tipos comuns de rejeição
      else if ((mpDetails as any).status_detail === 'cc_rejected_bad_filled_card_number' ||
               (mpDetails as any).rejection_reason === 'cc_rejected_bad_filled_card_number') {
        rejectionReason = 'Número do cartão inválido';
        rejectionType = 'invalid_card_number';
      }
      else if ((mpDetails as any).status_detail === 'cc_rejected_bad_filled_date' ||
               (mpDetails as any).rejection_reason === 'cc_rejected_bad_filled_date') {
        rejectionReason = 'Data de validade inválida';
        rejectionType = 'invalid_expiry_date';
      }
      else if ((mpDetails as any).status_detail === 'cc_rejected_bad_filled_other' ||
               (mpDetails as any).rejection_reason === 'cc_rejected_bad_filled_other') {
        rejectionReason = 'Dados do cartão incorretos';
        rejectionType = 'invalid_card_data';
      }
      else if ((mpDetails as any).status_detail === 'cc_rejected_call_for_authorize' ||
               (mpDetails as any).rejection_reason === 'cc_rejected_call_for_authorize') {
        rejectionReason = 'Autorização necessária';
        rejectionType = 'authorization_required';
      }
      else if ((mpDetails as any).status_detail === 'cc_rejected_insufficient_amount' ||
               (mpDetails as any).rejection_reason === 'cc_rejected_insufficient_amount') {
        rejectionReason = 'Limite insuficiente';
        rejectionType = 'insufficient_limit';
      }

      console.log(`[PAYMENT-STATUS] 🔍 Detalhes da rejeição para ${id}:`, {
        paymentMethod: mpDetails.payment_method_id,
        statusDetail: (mpDetails as any).status_detail || 'unknown',
        rejectionReason: rejectionReason,
        rejectionType: rejectionType,
        cardholderName: mpDetails?.payer?.first_name ? 
          `${mpDetails.payer.first_name} ${mpDetails.payer.last_name || ''}`.trim() : 
          'N/A',
        buyerEmail: mpDetails?.metadata?.buyer_email || mpDetails?.payer?.email || 'N/A',
      });
    }

    // Preparar resposta combinando dados do banco e do MP
    const response = {
      success: true,
      status: mpDetails.status,
      details: mpDetails,
      checked_at: new Date().toISOString(),
      // Dados do banco de dados
      db_payment: dbPayment ? {
        id: dbPayment.id,
        status: dbPayment.status,
        payerName: dbPayment.payerName,
        payerEmail: dbPayment.payerEmail,
        amount: dbPayment.amount,
        createdAt: dbPayment.createdAt,
        updatedAt: dbPayment.updatedAt,
      } : null,
      // Informações extras para rejeições
      rejection_info: mpDetails.status === 'rejected' ? {
        reason: rejectionReason,
        type: rejectionType,
        detail: (mpDetails as any).status_detail || 'unknown',
        payment_method: mpDetails.payment_method_id,
        cardholder_name: mpDetails?.payer?.first_name ? 
          `${mpDetails.payer.first_name} ${mpDetails.payer.last_name || ''}`.trim() : 
          'N/A',
        buyer_email: mpDetails?.metadata?.buyer_email || mpDetails?.payer?.email || 'N/A',
        original_status_detail: (mpDetails as any).status_detail || 'unknown',
        original_rejection_reason: (mpDetails as any).rejection_reason || 'unknown',
      } : null,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[PAYMENT-STATUS] Erro ao consultar status:', err);
    return NextResponse.json(
      { success: false, error: 'Falha ao consultar status do pagamento' },
      { status: 500 }
    );
  }
}

// Endpoint POST para forçar verificação (útil para testes)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: 'paymentId é obrigatório no body' },
        { status: 400 }
      );
    }

    console.log(`[PAYMENT-STATUS] Forçando verificação do pagamento ID: ${paymentId}`);

    const details = await mercadoPagoService.getPaymentDetails(paymentId);

    console.log(`[PAYMENT-STATUS] Verificação forçada para ${paymentId}:`, {
      status: details.status,
      external_reference: details.external_reference,
    });

    return NextResponse.json({
      success: true,
      status: details.status,
      details,
      forced_check: true,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[PAYMENT-STATUS] Erro na verificação forçada:', err);
    return NextResponse.json(
      { success: false, error: 'Falha na verificação forçada' },
      { status: 500 }
    );
  }
}
