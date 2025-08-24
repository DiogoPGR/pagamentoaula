import { NextRequest, NextResponse } from 'next/server';
import { mercadoPagoService } from '@/lib/mercadopago';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    console.log('[TEST-PIX] 🧪 Testando serviço PIX...');
    
    // Verificar variáveis de ambiente
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const notificationUrl = process.env.MP_NOTIFICATION_URL;
    
    console.log('[TEST-PIX] 🔑 Variáveis de ambiente:', {
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length || 0,
      baseUrl,
      notificationUrl,
      nodeEnv: process.env.NODE_ENV
    });
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'MERCADOPAGO_ACCESS_TOKEN não configurado',
        details: 'Configure a variável MERCADOPAGO_ACCESS_TOKEN no .env'
      }, { status: 500 });
    }
    
    // Testar criação de pagamento PIX com dados mínimos
    try {
      const testPayment = await mercadoPagoService.createPixPayment({
        name: 'Teste PIX',
        email: 'teste@example.com',
        cpf: '12345678901',
        amount: 1.00
      });
      
      console.log('[TEST-PIX] ✅ PIX criado com sucesso:', {
        id: testPayment.id,
        status: testPayment.status,
        hasQrCode: !!testPayment.qr_code,
        hasQrCodeBase64: !!testPayment.qr_code_base64
      });
      
      return NextResponse.json({
        success: true,
        message: 'PIX funcionando corretamente',
        testPayment: {
          id: testPayment.id,
          status: testPayment.status,
          hasQrCode: !!testPayment.qr_code,
          hasQrCodeBase64: !!testPayment.qr_code_base64,
          externalReference: testPayment.external_reference
        },
        environment: {
          hasAccessToken: !!accessToken,
          baseUrl,
          notificationUrl,
          nodeEnv: process.env.NODE_ENV
        }
      });
      
    } catch (pixError) {
      console.error('[TEST-PIX] ❌ Erro ao criar PIX:', pixError);
      
      return NextResponse.json({
        success: false,
        error: 'Falha ao criar PIX de teste',
        details: pixError instanceof Error ? pixError.message : 'Erro desconhecido',
        stack: pixError instanceof Error ? pixError.stack : undefined,
        environment: {
          hasAccessToken: !!accessToken,
          baseUrl,
          notificationUrl,
          nodeEnv: process.env.NODE_ENV
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('[TEST-PIX] ❌ Erro geral:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
} 