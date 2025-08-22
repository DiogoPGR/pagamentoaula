import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

// Configurar o Mercado Pago com suas credenciais
// Em produção, use variáveis de ambiente
const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN';

// Configuração do cliente Mercado Pago
const client = new MercadoPagoConfig({ 
  accessToken: MP_ACCESS_TOKEN 
});

export interface PaymentData {
  name: string;
  email: string;
  cpf: string;
  amount: number;
}

export interface PixPaymentResponse {
  id: string;
  status: string;
  qr_code: string;
  qr_code_base64: string;
  external_reference: string;
}

export class MercadoPagoService {

  async createPixPayment(paymentData: PaymentData): Promise<PixPaymentResponse> {
    try {
      // Criar preferência de pagamento
      const preference = {
        items: [
          {
            title: 'Produto Digital',
            description: 'Acesso completo ao conteúdo',
            quantity: 1,
            unit_price: paymentData.amount,
            currency_id: 'BRL',
          },
        ],
        payer: {
          name: paymentData.name,
          email: paymentData.email,
          identification: {
            type: 'CPF',
            number: paymentData.cpf.replace(/\D/g, ''), // Remove caracteres não numéricos
          },
        },
        payment_methods: {
          excluded_payment_types: [
            { id: 'credit_card' },
            { id: 'debit_card' },
            { id: 'bank_transfer' },
          ],
          installments: 1,
        },
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/success`,
          failure: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/failure`,
          pending: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/pending`,
        },
        notification_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/webhook`,
        auto_return: 'approved',
        external_reference: `order_${Date.now()}`,
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
      };

      const preferenceClient = new Preference(client);
      const response = await preferenceClient.create({ body: preference });
      
      // Criar pagamento PIX
      const payment = {
        transaction_amount: paymentData.amount,
        description: 'Produto Digital - Acesso completo ao conteúdo',
        payment_method_id: 'pix',
        payer: {
          email: paymentData.email,
          first_name: paymentData.name.split(' ')[0],
          last_name: paymentData.name.split(' ').slice(1).join(' '),
          identification: {
            type: 'CPF',
            number: paymentData.cpf.replace(/\D/g, ''),
          },
        },
        external_reference: response.external_reference,
      };

      const paymentClient = new Payment(client);
      const pixResponse = await paymentClient.create({ body: payment });

      return {
        id: pixResponse.id.toString(),
        status: pixResponse.status,
        qr_code: pixResponse.point_of_interaction.transaction_data.qr_code,
        qr_code_base64: pixResponse.point_of_interaction.transaction_data.qr_code_base64,
        external_reference: response.external_reference,
      };
    } catch (error) {
      console.error('Erro ao criar pagamento PIX:', error);
      throw new Error('Falha ao processar pagamento PIX');
    }
  }

  async getPaymentStatus(paymentId: string): Promise<string> {
    try {
      const paymentClient = new Payment(client);
      const response = await paymentClient.get({ id: paymentId });
      return response.status;
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      throw new Error('Falha ao verificar status do pagamento');
    }
  }

  async getPaymentDetails(paymentId: string): Promise<any> {
    try {
      const paymentClient = new Payment(client);
      const response = await paymentClient.get({ id: paymentId });
      return {
        id: response.id,
        status: response.status,
        external_reference: response.external_reference,
        transaction_amount: response.transaction_amount,
        description: response.description,
        payment_method_id: response.payment_method_id,
        date_created: response.date_created,
        date_last_updated: response.date_last_updated,
        payer: response.payer,
        // Para pagamentos PIX
        point_of_interaction: response.point_of_interaction
      };
    } catch (error) {
      console.error('Erro ao buscar detalhes do pagamento:', error);
      throw new Error('Falha ao buscar detalhes do pagamento');
    }
  }
}

export const mercadoPagoService = new MercadoPagoService();
