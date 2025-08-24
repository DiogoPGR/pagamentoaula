import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const MP_ACCESS_TOKEN =
  process.env.MERCADOPAGO_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN';

const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });

// ---- Helper: resolve e valida a URL do webhook (apenas https e sem localhost)
function getNotificationUrl(): string | undefined {
  const rawEnv = (process.env.MP_NOTIFICATION_URL || '').trim();
  if (rawEnv) {
    try {
      const u = new URL(rawEnv);
      if (u.protocol !== 'https:') return undefined; // MP exige https
      // ok
      return u.href;
    } catch {
      return undefined;
    }
  }

  const base = (process.env.NEXT_PUBLIC_BASE_URL || '').trim();
  if (base) {
    try {
      const u = new URL(base);
      if (
        u.protocol === 'https:' &&
        u.hostname !== 'localhost' &&
        u.hostname !== '127.0.0.1' &&
        u.hostname !== '::1'
      ) {
        return `${u.origin}/api/webhook`;
      }
    } catch {
      /* ignore */
    }
  }

  return undefined;
}

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
  // PIX
  async createPixPayment(paymentData: PaymentData): Promise<PixPaymentResponse> {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const notificationUrl = getNotificationUrl();
      console.log('[MP] notificationUrl usada (PIX):', notificationUrl);

      const externalReference = `order_${Date.now()}`;
      const items = [
        {
          title: 'Produto Digital',
          description: 'Acesso completo ao conteúdo',
          quantity: 1,
          unit_price: paymentData.amount,
          currency_id: 'BRL',
        },
      ];

      const [firstName, ...rest] = paymentData.name.trim().split(' ');
      const lastName = rest.join(' ');

      // Preferência (para navegação/back_urls)
      const preferenceClient = new Preference(client);
      await preferenceClient.create({
        body: {
          items,
          payer: {
            name: paymentData.name,
            email: paymentData.email,
            identification: {
              type: 'CPF',
              number: paymentData.cpf.replace(/\D/g, ''),
            },
          },
          metadata: {
            buyer_email: paymentData.email,
            order_id: externalReference,
            customer_name: paymentData.name,
          },
          additional_info: {
            items: items.map((i) => ({
              title: i.title,
              quantity: i.quantity,
              unit_price: i.unit_price,
            })),
            payer: {
              email: paymentData.email,
              first_name: firstName || paymentData.name,
              last_name: lastName || '',
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
            success: `${baseUrl}/success`,
            failure: `${baseUrl}/failure`,
            pending: `${baseUrl}/pending`,
          },
          ...(notificationUrl ? { notification_url: notificationUrl } : {}),
          auto_return: 'approved',
          external_reference: externalReference,
          expires: true,
          expiration_date_from: new Date().toISOString(),
          expiration_date_to: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      });

      // Pagamento PIX
      const paymentClient = new Payment(client);
      const pixResponse = await paymentClient.create({
        body: {
          transaction_amount: paymentData.amount,
          description: 'Produto Digital - Acesso completo ao conteúdo',
          payment_method_id: 'pix',
          payer: {
            email: paymentData.email,
            first_name: firstName || paymentData.name,
            last_name: lastName || '',
            identification: {
              type: 'CPF',
              number: paymentData.cpf.replace(/\D/g, ''),
            },
          },
          external_reference: externalReference,
          ...(notificationUrl ? { notification_url: notificationUrl } : {}),
          metadata: {
            buyer_email: paymentData.email,
            order_id: externalReference,
            customer_name: paymentData.name,
          },
          additional_info: {
            items: items.map((i) => ({
              title: i.title,
              quantity: i.quantity,
              unit_price: i.unit_price,
            })),
            payer: {
              email: paymentData.email,
              first_name: firstName || paymentData.name,
              last_name: lastName || '',
            },
          },
        },
      });

      return {
        id: String(pixResponse.id),
        status: pixResponse.status,
        qr_code:
          pixResponse.point_of_interaction?.transaction_data?.qr_code || '',
        qr_code_base64:
          pixResponse.point_of_interaction?.transaction_data?.qr_code_base64 ||
          '',
        external_reference: externalReference,
      };
    } catch (error) {
      console.error('Erro ao criar pagamento PIX:', error);
      throw new Error('Falha ao processar pagamento PIX');
    }
  }

  // CARTÃO
  async createCardPayment(args: {
    token: string;
    issuer_id?: string;
    payment_method_id: string;
    installments?: number;
    amount: number;
    description?: string;
    external_reference?: string;
    payer: {
      email: string;
      identification: { type: 'CPF' | 'CNPJ'; number: string };
    };
  }) {
    try {
      const notificationUrl = getNotificationUrl();
      console.log('[MP] notificationUrl usada (CARD):', notificationUrl);

      const paymentClient = new Payment(client);
      const resp = await paymentClient.create({
        body: {
          token: args.token,
          issuer_id: args.issuer_id,
          payment_method_id: args.payment_method_id,
          transaction_amount: Number(args.amount),
          installments: Number(args.installments || 1),
          description: args.description || 'Pagamento com cartão',
          external_reference:
            args.external_reference || `order_${Date.now()}`,
          capture: true,
          payer: {
            email: args.payer.email,
            identification: {
              type: args.payer.identification.type,
              number: args.payer.identification.number.replace(/\D/g, ''),
            },
          },
          ...(notificationUrl ? { notification_url: notificationUrl } : {}),
          metadata: {
            buyer_email: args.payer.email,
            order_id: args.external_reference,
          },
        },
      });
      return resp;
    } catch (error) {
      console.error('Erro ao criar pagamento com cartão:', error);
      throw new Error('Falha ao processar pagamento com cartão');
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
        additional_info: (response as any).additional_info,
        metadata: (response as any).metadata,
        order: (response as any).order,
        point_of_interaction: response.point_of_interaction,
      };
    } catch (error) {
      console.error('Erro ao buscar detalhes do pagamento:', error);
      throw new Error('Falha ao buscar detalhes do pagamento');
    }
  }
}

export const mercadoPagoService = new MercadoPagoService();
