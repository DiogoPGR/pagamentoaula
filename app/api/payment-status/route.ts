import { NextRequest, NextResponse } from 'next/server';
import { mercadoPagoService } from '@/lib/mercadopago';

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

    const details = await mercadoPagoService.getPaymentDetails(id);

    console.log(`[PAYMENT-STATUS] Status obtido para ${id}:`, {
      status: details.status,
      external_reference: details.external_reference,
      amount: details.transaction_amount,
    });

    // Variáveis para informações de rejeição
    let rejectionReason = 'Erro geral no processamento';
    let rejectionType = 'general_error';

    // Adicionar informações extras para rejeições
    if (details.status === 'rejected') {
      // Detectar o motivo específico da rejeição
      
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

      console.log(`[PAYMENT-STATUS] 🔍 Detalhes da rejeição para ${id}:`, {
        paymentMethod: details.payment_method_id,
        statusDetail: (details as any).status_detail || 'unknown',
        rejectionReason: rejectionReason,
        rejectionType: rejectionType,
        cardholderName: details?.payer?.first_name ? 
          `${details.payer.first_name} ${details.payer.last_name || ''}`.trim() : 
          'N/A',
        buyerEmail: details?.metadata?.buyer_email || details?.payer?.email || 'N/A',
      });
    }

    return NextResponse.json({
      success: true,
      status: details.status,
      details,
      checked_at: new Date().toISOString(),
      // Adicionar informações extras para rejeições
      rejection_info: details.status === 'rejected' ? {
        reason: rejectionReason,
        type: rejectionType,
        detail: (details as any).status_detail || 'unknown',
        payment_method: details.payment_method_id,
        cardholder_name: details?.payer?.first_name ? 
          `${details.payer.first_name} ${details.payer.last_name || ''}`.trim() : 
          'N/A',
        buyer_email: details?.metadata?.buyer_email || details?.payer?.email || 'N/A',
        original_status_detail: (details as any).status_detail || 'unknown',
        original_rejection_reason: (details as any).rejection_reason || 'unknown',
      } : null,
    });
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
