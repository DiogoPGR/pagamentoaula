import { NextRequest, NextResponse } from 'next/server';
import { mercadoPagoService } from '@/lib/mercadopago';

export async function POST(request: NextRequest) {
  try {
    console.log('[PIX-API] 📝 Recebendo requisição PIX...');
    
    const body = await request.json();
    const { name, email, cpf, amount } = body;
    
    console.log('[PIX-API] 📋 Dados recebidos:', {
      name,
      email,
      cpf,
      amount,
      hasName: !!name,
      hasEmail: !!email,
      hasCpf: !!cpf,
      hasAmount: !!amount
    });

    // Validação básica
    if (!name || !email || !cpf || !amount) {
      console.log('[PIX-API] ❌ Validação falhou:', {
        missingName: !name,
        missingEmail: !email,
        missingCpf: !cpf,
        missingAmount: !amount
      });
      
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar formato do CPF (básico)
    const cpfClean = cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) {
      console.log('[PIX-API] ❌ CPF inválido:', { cpf, cpfClean, length: cpfClean.length });
      
      return NextResponse.json(
        { error: 'CPF inválido' },
        { status: 400 }
      );
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[PIX-API] ❌ Email inválido:', { email });
      
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    console.log('[PIX-API] ✅ Validação passou, criando pagamento...');

    // Criar pagamento PIX
    const paymentData = {
      name,
      email,
      cpf,
      amount: parseFloat(amount),
    };

    console.log('[PIX-API] 📤 Chamando mercadoPagoService.createPixPayment...');
    
    const pixPayment = await mercadoPagoService.createPixPayment(paymentData);
    
    console.log('[PIX-API] ✅ PIX criado com sucesso:', {
      id: pixPayment.id,
      status: pixPayment.status,
      hasQrCode: !!pixPayment.qr_code,
      hasQrCodeBase64: !!pixPayment.qr_code_base64,
      externalReference: pixPayment.external_reference
    });

    return NextResponse.json({
      success: true,
      data: pixPayment,
    });
  } catch (error) {
    console.error('[PIX-API] ❌ Erro na API de pagamento PIX:', error);
    
    // Log detalhado do erro
    if (error instanceof Error) {
      console.error('[PIX-API] 📋 Detalhes do erro:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
