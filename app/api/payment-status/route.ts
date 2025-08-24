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

    const details = await mercadoPagoService.getPaymentDetails(id);

    return NextResponse.json({
      success: true,
      status: details.status,
      details,
    });
  } catch (err) {
    console.error('Erro em /api/payment-status:', err);
    return NextResponse.json(
      { success: false, error: 'Falha ao consultar status do pagamento' },
      { status: 500 }
    );
  }
}
