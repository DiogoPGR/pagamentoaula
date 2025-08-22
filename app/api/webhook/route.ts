import { NextRequest, NextResponse } from 'next/server';
import { mercadoPagoService } from '@/lib/mercadopago';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log para debug (remover em produção)
    console.log('Webhook recebido:', JSON.stringify(body, null, 2));

    // Verificar se é uma notificação de pagamento
    if (body.type === 'payment' && body.data?.id) {
      const paymentId = body.data.id;
      
      try {
        // Buscar informações detalhadas do pagamento
        const paymentInfo = await mercadoPagoService.getPaymentDetails(paymentId);
        
        // Log para debug
        console.log('Status do pagamento atualizado:', {
          paymentId,
          status: paymentInfo.status,
          externalReference: paymentInfo.external_reference
        });

        // Aqui você pode implementar lógica adicional:
        // - Atualizar banco de dados
        // - Enviar emails de confirmação
        // - Atualizar status do pedido
        // - Notificar o usuário via WebSocket ou Server-Sent Events
        
        return NextResponse.json({ 
          success: true, 
          message: 'Webhook processado com sucesso',
          paymentId,
          status: paymentInfo.status
        });
        
      } catch (error) {
        console.error('Erro ao processar webhook do pagamento:', error);
        return NextResponse.json(
          { error: 'Erro ao processar pagamento' },
          { status: 500 }
        );
      }
    }

    // Se não for uma notificação de pagamento, retornar sucesso
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook recebido (não é notificação de pagamento)' 
    });

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Método GET para verificação de saúde do webhook
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Webhook endpoint está funcionando',
    timestamp: new Date().toISOString()
  });
}
