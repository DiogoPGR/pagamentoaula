// lib/mailer.ts
import nodemailer, { SentMessageInfo } from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
} = process.env;

// --- Validação das variáveis de ambiente (falha explícita ajuda a depurar) ---
function assertEnv() {
  const missing: string[] = [];
  if (!SMTP_HOST) missing.push('SMTP_HOST');
  if (!SMTP_PORT) missing.push('SMTP_PORT');
  if (!SMTP_USER) missing.push('SMTP_USER');
  if (!SMTP_PASS) missing.push('SMTP_PASS');

  if (missing.length) {
    const msg =
      `[mailer] Variáveis SMTP ausentes: ${missing.join(', ')}. ` +
      `Configure-as no .env.`;
    console.error(msg);
    throw new Error(msg);
  }
}

// --- Transporter (singleton) ---
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    assertEnv();
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465, // 465 = SSL
      auth: { user: SMTP_USER as string, pass: SMTP_PASS as string },
      // pool: true, // opcional: habilite se for enviar muitos e-mails
    });
  }
  return transporter!;
}

// Verifica conexão SMTP uma única vez (gera log claro se algo falhar)
let verifiedOnce = false;
async function ensureVerified() {
  if (verifiedOnce) return;
  try {
    await getTransporter().verify();
    console.log('[mailer] SMTP verificado com sucesso');
    verifiedOnce = true;
  } catch (err) {
    console.error('[mailer] Falha ao verificar SMTP:', err);
    throw err;
  }
}

export type MailItem = { title: string; quantity: number; unit_price: number };

function brl(n: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n || 0);
}

function buildItemsTable(items: MailItem[]) {
  if (!items?.length) return '';
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:12px">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #eee">Item</th>
          <th style="text-align:center;padding:8px;border-bottom:1px solid #eee">Qtd</th>
          <th style="text-align:right;padding:8px;border-bottom:1px solid #eee">Preço</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (i) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #f5f5f5">${i.title}</td>
            <td style="padding:8px;text-align:center;border-bottom:1px solid #f5f5f5">${i.quantity}</td>
            <td style="padding:8px;text-align:right;border-bottom:1px solid #f5f5f5">
              ${brl((i.unit_price || 0) * (i.quantity || 1))}
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

export async function sendPaymentConfirmationEmail(opts: {
  to: string;
  name?: string;
  orderId: string;
  amount: number;
  items?: MailItem[];
  receiptUrl?: string | null | undefined;
}): Promise<SentMessageInfo> {
  assertEnv();
  await ensureVerified();

  const {
    to,
    name = 'Cliente',
    orderId,
    amount,
    items = [],
    receiptUrl,
  } = opts;

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:16px">
      <h2 style="margin:0 0 12px 0">Pagamento confirmado ✅</h2>
      <p style="margin:0 0 12px 0">Olá, <strong>${name}</strong>!</p>
      <p style="margin:0 0 12px 0">
        Recebemos o seu pagamento do pedido <strong>${orderId}</strong>.
      </p>

      ${buildItemsTable(items)}

      <p style="margin:12px 0 4px 0"><strong>Total:</strong> ${brl(amount)}</p>

      ${
        receiptUrl
          ? `<p style="margin:12px 0"><a href="${receiptUrl}" target="_blank" rel="noopener noreferrer">Ver comprovante</a></p>`
          : ''
      }

      <p style="margin-top:20px;color:#666;font-size:12px">
        Se você não reconhece esta compra, entre em contato com nosso suporte.
      </p>
    </div>
  `;

  const info = await getTransporter().sendMail({
    from: MAIL_FROM || (SMTP_USER as string),
    to,
    subject: `Pagamento confirmado – Pedido ${orderId}`,
    text: `Olá, ${name}. Seu pagamento do pedido ${orderId} foi confirmado. Total: ${brl(
      amount
    )}.`,
    html,
  });

  console.log('[mailer] sendMail OK', {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  });

  return info;
}
