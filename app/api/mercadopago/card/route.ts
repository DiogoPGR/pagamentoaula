import { NextRequest, NextResponse } from 'next/server';
import { mercadoPagoService } from '@/lib/mercadopago';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await mercadoPagoService.createCardPayment({
      token: body.token,
      issuer_id: body.issuer_id,
      payment_method_id: body.payment_method_id,
      installments: body.installments,
      amount: body.amount,
      description: body.description,
      external_reference: body.external_reference, // use o ID do seu pedido
      payer: body.payer, // { email, identification: { type, number } }
    });

    // Repasse o retorno do MP (status, id, etc.)
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error('Erro /api/mercadopago/card:', e);
    return NextResponse.json({ error: 'Erro ao processar pagamento' }, { status: 500 });
  }
}
