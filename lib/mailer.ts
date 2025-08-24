import nodemailer from 'nodemailer';

const from = process.env.MAIL_FROM || 'no-reply@example.com';

export async function getTransport() {
  // Produção → usa seu SMTP real
  if (process.env.NODE_ENV === 'production') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465, // 465 = SSL
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    });
  }

  // Desenvolvimento → conta Ethereal (preview no navegador)
  const test = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: test.user, pass: test.pass },
  });
}

type LineItem = { title: string; quantity: number; unit_price: number };

export async function sendPaymentConfirmationEmail(args: {
  to: string;
  name?: string;
  orderId: string | number;
  amount: number;
  items?: LineItem[];
  receiptUrl?: string;
}) {
  const { to, name, orderId, amount, items = [], receiptUrl } = args;

  const currency = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const itemsHtml = items.length
    ? `<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee;">
        <thead>
          <tr style="background:#fafafa;">
            <th align="left">Item</th>
            <th align="right">Qtd</th>
            <th align="right">Preço</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(it => `
            <tr>
              <td>${it.title}</td>
              <td align="right">${it.quantity}</td>
              <td align="right">${currency(it.unit_price)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    : '';

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111;">
      <h2 style="margin:0 0 8px;">Pagamento confirmado ✅</h2>
      <p style="margin:0 0 16px;">Olá${name ? `, <strong>${name}</strong>` : ''}! Recebemos seu pagamento.</p>
      <div style="border:1px solid #eee;border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="margin:4px 0;"><strong>Pedido:</strong> ${orderId}</p>
        <p style="margin:4px 0;"><strong>Total:</strong> ${currency(amount)}</p>
      </div>
      ${itemsHtml}
      ${receiptUrl ? `
        <p style="margin:16px 0;">
          <a href="${receiptUrl}" style="background:#111;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;display:inline-block;">
            Ver comprovante/nota
          </a>
        </p>` : ''}
      <p style="margin-top:24px;color:#555;">Qualquer dúvida, responda este e-mail.</p>
      <p style="margin:0;color:#999;font-size:12px;">Obrigado por comprar com a gente! 💙</p>
    </div>
  `;

  const transporter = await getTransport();
  const info = await transporter.sendMail({
    from,
    to,
    subject: `Confirmação do pagamento – Pedido ${orderId}`,
    html,
  });

  const previewUrl = (nodemailer as any).getTestMessageUrl?.(info) || null;
  return { messageId: info.messageId, previewUrl };
}
