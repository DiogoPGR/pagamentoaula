import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/prisma/prisma.config';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Parâmetros de paginação e filtros
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const email = searchParams.get('email');
    
    console.log(`[PAYMENTS] Listando pagamentos - página ${page}, limite ${limit}`);
    
    // Construir filtros
    const where: any = {};
    if (status) where.status = status.toUpperCase();
    if (email) where.payerEmail = { contains: email, mode: 'insensitive' };
    
    // Calcular offset para paginação
    const offset = (page - 1) * limit;
    
    // Buscar pagamentos com paginação
    const [payments, total] = await Promise.all([
      paymentService.listPayments({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      paymentService.countPayments(where)
    ]);
    
    console.log(`[PAYMENTS] Encontrados ${payments.length} pagamentos de ${total} total`);
    
    return NextResponse.json({
      success: true,
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
    
  } catch (err) {
    console.error('[PAYMENTS] Erro ao listar pagamentos:', err);
    return NextResponse.json(
      { success: false, error: 'Falha ao listar pagamentos' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validar dados obrigatórios
    const requiredFields = ['mercadopagoId', 'externalReference', 'amount', 'paymentMethod', 'payerName', 'payerEmail', 'payerCpf'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Campo obrigatório: ${field}` },
          { status: 400 }
        );
      }
    }
    
    console.log(`[PAYMENTS] Criando pagamento manual:`, {
      mercadopagoId: body.mercadopagoId,
      externalReference: body.externalReference,
      amount: body.amount
    });
    
    const payment = await paymentService.createPayment({
      mercadopagoId: body.mercadopagoId,
      externalReference: body.externalReference,
      amount: Number(body.amount),
      paymentMethod: body.paymentMethod,
      payerName: body.payerName,
      payerEmail: body.payerEmail,
      payerCpf: body.payerCpf.replace(/\D/g, ''),
      description: body.description,
      items: body.items,
    });
    
    console.log(`[PAYMENTS] ✅ Pagamento criado com sucesso:`, payment.id);
    
    return NextResponse.json({
      success: true,
      data: payment,
      message: 'Pagamento criado com sucesso'
    });
    
  } catch (err) {
    console.error('[PAYMENTS] Erro ao criar pagamento:', err);
    return NextResponse.json(
      { success: false, error: 'Falha ao criar pagamento' },
      { status: 500 }
    );
  }
} 