import { PrismaClient } from '@prisma/client';

// Configuração global do Prisma
declare global {
  var __prisma: PrismaClient | undefined;
}

// Singleton do Prisma para evitar múltiplas conexões
export const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Funções úteis para pagamentos
export const paymentService = {
  // Criar novo pagamento
  async createPayment(data: {
    mercadopagoId: string;
    externalReference: string;
    amount: number;
    paymentMethod: string;
    payerName: string;
    payerEmail: string;
    payerCpf: string;
    description?: string;
    items?: any[];
    initialStatus?: string;
  }) {
    // Validar e limpar dados antes de salvar
    const cleanData = {
      mercadopagoId: data.mercadopagoId,
      externalReference: data.externalReference,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      payerName: data.payerName.trim() || 'Nome não informado',
      payerEmail: data.payerEmail.trim() || 'email@nao.informado',
      payerCpf: data.payerCpf.replace(/\D/g, '') || 'CPF não informado',
      description: data.description?.trim(),
      items: data.items ? data.items : undefined,
      status: (data.initialStatus || 'PENDING').toUpperCase() as any,
    };

    console.log('[PRISMA] Criando pagamento com dados:', {
      mercadopagoId: cleanData.mercadopagoId,
      payerName: cleanData.payerName,
      payerEmail: cleanData.payerEmail,
      payerCpf: cleanData.payerCpf,
      status: cleanData.status,
    });

    const payment = await prisma.payment.create({
      data: cleanData,
    });

    console.log('[PRISMA] ✅ Pagamento criado com sucesso:', {
      id: payment.id,
      payerName: payment.payerName,
      payerEmail: payment.payerEmail,
      payerCpf: payment.payerCpf,
      status: payment.status,
    });

    return payment;
  },

  // Atualizar status do pagamento
  async updatePaymentStatus(mercadopagoId: string, status: string, mpData?: any) {
    console.log(`[PRISMA] Atualizando status do pagamento ${mercadopagoId} para: ${status}`);
    
    const result = await prisma.payment.update({
      where: { mercadopagoId },
      data: {
        status: status.toUpperCase() as any,
        mpStatusDetail: mpData?.status_detail || null,
        mpRejectionReason: mpData?.rejection_reason || null,
        mpUpdatedAt: mpData?.date_last_updated ? new Date(mpData.date_last_updated) : null,
        updatedAt: new Date(),
      },
    });
    
    console.log(`[PRISMA] ✅ Status atualizado com sucesso para: ${result.status}`);
    return result;
  },

  // Atualizar pagamento com ID real do Mercado Pago
  async updatePaymentWithMercadoPagoId(dbId: string, mercadopagoId: string, status: string) {
    console.log(`[PRISMA] Atualizando pagamento ${dbId} com ID do MP: ${mercadopagoId}`);
    
    const result = await prisma.payment.update({
      where: { id: dbId },
      data: {
        mercadopagoId,
        status: status.toUpperCase() as any,
        updatedAt: new Date(),
      },
    });
    
    console.log(`[PRISMA] ✅ Pagamento atualizado com ID do MP: ${result.mercadopagoId}`);
    return result;
  },

  // Buscar pagamento por ID do Mercado Pago
  async getPaymentByMercadoPagoId(mercadopagoId: string) {
    const payment = await prisma.payment.findUnique({
      where: { mercadopagoId },
      include: {
        webhookEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    
    if (payment) {
      console.log(`[PRISMA] Pagamento encontrado: ${mercadopagoId} -> Status: ${payment.status}`);
    } else {
      console.log(`[PRISMA] Pagamento não encontrado: ${mercadopagoId}`);
    }
    
    return payment;
  },

  // Buscar pagamento por referência externa
  async getPaymentByReference(externalReference: string) {
    return prisma.payment.findUnique({
      where: { externalReference },
      include: {
        webhookEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  },

  // Listar pagamentos com paginação e filtros
  async listPayments(options: {
    where?: any;
    skip?: number;
    take?: number;
    orderBy?: any;
  }) {
    return prisma.payment.findMany({
      where: options.where,
      skip: options.skip,
      take: options.take,
      orderBy: options.orderBy,
      include: {
        webhookEvents: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  },

  // Contar total de pagamentos
  async countPayments(where?: any) {
    return prisma.payment.count({ where });
  },

  // Registrar evento de webhook
  async logWebhookEvent(paymentId: string, eventType: string, eventData: any) {
    return prisma.webhookEvent.create({
      data: {
        paymentId,
        eventType,
        eventData: JSON.stringify(eventData),
        processed: false,
      },
    });
  },

  // Marcar webhook como processado
  async markWebhookProcessed(webhookId: string, error?: string) {
    return prisma.webhookEvent.update({
      where: { id: webhookId },
      data: {
        processed: true,
        processedAt: new Date(),
        error: error || null,
      },
    });
  },
};

export default prisma; 