'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    MercadoPago: any;
  }
}

type Props = {
  amount: number;
  buyer: { email: string; cpf: string; name?: string };
  onResult?: (resp: any) => void;
};

export default function CreditCardForm({ amount, buyer, onResult }: Props) {
  const containerId = 'cardPaymentBrick_container';
  const brickRef = useRef<any>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [timeoutHit, setTimeoutHit] = useState(false);

  const PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY as string | undefined;

  const initBrick = useCallback(async () => {
    try {
      if (!PUBLIC_KEY) {
        setErr('NEXT_PUBLIC_MP_PUBLIC_KEY não definida no .env.local');
        setLoading(false);
        return;
      }
      if (!window.MercadoPago) {
        setErr('SDK do Mercado Pago não carregou.');
        setLoading(false);
        return;
      }

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
                    email: buyer.email,
                    identification: { type: 'CPF', number: buyer.cpf.replace(/\D/g, '') },
                  },
                }),
              });
              const data = await res.json();
              onResult?.(data);
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

  // timeout de segurança: se não ficar pronto em ~8s, avisar
  useEffect(() => {
    if (!sdkLoaded) return;
    const t = setTimeout(() => {
      if (loading) {
        setTimeoutHit(true);
        setLoading(false);
        if (!err) {
          setErr(
            'Demorando para carregar o formulário. Verifique a chave pública, ad-blockers e o console do navegador.'
          );
        }
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [sdkLoaded, loading, err]);

  // cleanup
  useEffect(() => {
    return () => {
      try {
        brickRef.current?.destroy?.();
        const el = document.getElementById(containerId);
        if (el) el.innerHTML = '';
      } catch {}
    };
  }, []);

  // UI
  const maskedKey =
    PUBLIC_KEY ? `${PUBLIC_KEY.slice(0, 6)}…${PUBLIC_KEY.slice(-4)}` : '—';

  return (
    <>
      {/* Carrega o SDK do MP */}
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

      {/* Barra de status/diagnóstico (pode remover depois) */}
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
        SDK: {sdkLoaded ? 'carregado' : 'carregando'} • Chave pública: {maskedKey}
        {timeoutHit ? ' • timeout' : ''}
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
