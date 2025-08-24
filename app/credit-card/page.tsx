'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';

// ---- Componente interno que renderiza o Brick do cartão ----
function CardBrick(props: {
  amount: number;
  buyer: { email: string; cpf: string; name?: string };
  onResult: (resp: any) => void;
}) {
  const { amount, buyer, onResult } = props;
  const containerId = 'cardPaymentBrick_container';
  const brickRef = useRef<any>(null);

  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY as string | undefined;

  const initBrick = useCallback(async () => {
    try {
      if (!PUBLIC_KEY) {
        setErr('NEXT_PUBLIC_MP_PUBLIC_KEY não definida no .env.local');
        setLoading(false);
        return;
      }
      // @ts-ignore – será injetado via <Script />
      if (!window.MercadoPago) {
        setErr('SDK do Mercado Pago não carregou.');
        setLoading(false);
        return;
      }

      // @ts-ignore
      const mp = new window.MercadoPago(PUBLIC_KEY, { locale: 'pt-BR' });
      const bricks = mp.bricks();

      brickRef.current = await bricks.create('cardPayment', containerId, {
        initialization: { amount },
        callbacks: {
          onReady: () => setLoading(false),
          onError: (error: any) => {
            console.error('[Brick onError]', error);
            setErr(error?.message || 'Erro ao inicializar o formulário.');
            setLoading(false);
          },
          onSubmit: async (cardFormData: any) => {
            try {
              console.log('[Brick] 📝 Enviando dados do cartão...');
              console.log('[Brick] 👤 Dados do cliente:', {
                name: buyer.name,
                email: buyer.email,
                cpf: buyer.cpf
              });
              
              const res = await fetch('/api/mercadopago/card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  token: cardFormData.token,
                  issuer_id: cardFormData.issuerId,
                  payment_method_id: cardFormData.paymentMethodId,
                  installments: Number(cardFormData.installments || 1),
                  amount,
                  description: 'Pedido na Minha Loja',
                  external_reference: `order_${Date.now()}`,
                  payer: {
                    name: buyer.name, // ✅ Incluir nome do cliente
                    email: buyer.email,
                    identification: { type: 'CPF', number: buyer.cpf.replace(/\D/g, '') },
                  },
                }),
              });
              
              const data = await res.json();
              console.log('[Brick] ✅ Pagamento processado:', data);
              
              // Verificar se foi salvo no banco
              if (data.saved_to_db) {
                console.log('[Brick] 💾 Dados salvos no banco com sucesso');
              } else {
                console.warn('[Brick] ⚠️ Dados não foram salvos no banco');
              }
              
              onResult(data);
            } catch (e: any) {
              console.error('[Submit error]', e);
              setErr('Falha ao enviar pagamento.');
            }
          },
        },
      });
    } catch (e: any) {
      console.error('[Init brick error]', e);
      setErr(e?.message || 'Falha ao criar o Brick.');
      setLoading(false);
    }
  }, [PUBLIC_KEY, amount, buyer, onResult]);

  useEffect(() => {
    return () => {
      try {
        brickRef.current?.destroy?.();
        const el = document.getElementById(containerId);
        if (el) el.innerHTML = '';
      } catch {}
    };
  }, []);

  const maskedKey =
    PUBLIC_KEY ? `${PUBLIC_KEY.slice(0, 6)}…${PUBLIC_KEY.slice(-4)}` : '—';

  return (
    <>
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => {
          setSdkLoaded(true);
          initBrick();
        }}
        onError={() => {
          setErr('Não foi possível carregar o SDK do Mercado Pago.');
          setLoading(false);
        }}
      />

      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
        SDK: {sdkLoaded ? 'carregado' : 'carregando'} • Chave pública: {maskedKey}
      </div>

      {err && (
        <div
          style={{
            padding: '12px',
            border: '1px solid #fecaca',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      {loading && !err && (
        <div
          style={{
            padding: '12px',
            border: '1px solid #e5e7eb',
            background: '#f9fafb',
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          Carregando formulário de cartão…
        </div>
      )}

      <div id={containerId} style={{ minHeight: 320 }} />
    </>
  );
}

// -------------------- Página --------------------
export default function CreditCardPage() {
  const router = useRouter();

  const [amount, setAmount] = useState<number>(199.9);
  const [name, setName] = useState<string>('Diogo Vitalis');
  const [email, setEmail] = useState<string>('diogovitalisdev@gmail.com');
  const [cpf, setCpf] = useState<string>('123.456.789-09');

  const [result, setResult] = useState<any>(null);

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Pagamento com Cartão</h1>
        <p className="text-sm text-gray-500">
          Preencha os dados e conclua com segurança.
        </p>
      </header>

      <section className="grid gap-4 rounded-lg border p-4">
        <label className="flex items-center gap-2">
          <span className="w-40 text-sm text-gray-600">Valor (R$)</span>
          <input
            type="number"
            min={1}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="flex-1 rounded border px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-40 text-sm text-gray-600">Nome</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded border px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-40 text-sm text-gray-600">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded border px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-40 text-sm text-gray-600">CPF</span>
          <input
            type="text"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            className="flex-1 rounded border px-3 py-2"
          />
        </label>
      </section>

      <section className="rounded-lg border p-4">
        <CardBrick
          amount={amount}
          buyer={{ email, cpf, name }}
          onResult={(resp) => {
            setResult(resp);
            if (resp?.id) {
              const q = new URLSearchParams({
                paymentId: String(resp.id),
                status: String(resp.status || ''),
                ref: String(resp.external_reference || ''),
              }).toString();
              router.push(`/success?${q}`);
            }
          }}
        />
      </section>

      {result && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 text-lg font-medium">Resultado</h2>
          <pre className="overflow-auto text-sm">
{JSON.stringify(result, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
