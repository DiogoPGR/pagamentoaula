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
  }) {
    return prisma.payment.create({
      data: {
        mercadopagoId: data.mercadopagoId,
        externalReference: data.externalReference,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        payerName: data.payerName,
        payerEmail: data.payerEmail,
        payerCpf: data.payerCpf,
        description: data.description,
        items: data.items ? JSON.stringify(data.items) : null,
        status: 'PENDING',
      },
    });
  },

  // Atualizar status do pagamento
  async updatePaymentStatus(mercadopagoId: string, status: string, mpData?: any) {
    return prisma.payment.update({
      where: { mercadopagoId },
      data: {
        status: status.toUpperCase() as any,
        mpStatusDetail: mpData?.status_detail || null,
        mpRejectionReason: mpData?.rejection_reason || null,
        mpUpdatedAt: mpData?.date_last_updated ? new Date(mpData.date_last_updated) : null,
        updatedAt: new Date(),
      },
    });
  },

  // Buscar pagamento por ID do Mercado Pago
  async getPaymentByMercadoPagoId(mercadopagoId: string) {
    return prisma.payment.findUnique({
      where: { mercadopagoId },
      include: {
        webhookEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
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