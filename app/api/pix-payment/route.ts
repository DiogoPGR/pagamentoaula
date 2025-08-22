import { NextRequest, NextResponse } from 'next/server';
import { mercadoPagoService } from '@/lib/mercadopago';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, cpf, amount } = body;

    // Validação básica
    if (!name || !email || !cpf || !amount) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar formato do CPF (básico)
    const cpfClean = cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) {
      return NextResponse.json(
        { error: 'CPF inválido' },
        { status: 400 }
      );
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Criar pagamento PIX
    const paymentData = {
      name,
      email,
      cpf,
      amount: parseFloat(amount),
    };

    const pixPayment = await mercadoPagoService.createPixPayment(paymentData);

    return NextResponse.json({
      success: true,
      data: pixPayment,
    });
  } catch (error) {
    console.error('Erro na API de pagamento PIX:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
