'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SuccessPage() {
  const sp = useSearchParams();
  const paymentId = sp.get('paymentId');
  const statusFromClient = sp.get('status');
  const ref = sp.get('ref');

  const [serverStatus, setServerStatus] = useState<string>('carregando…');
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;
    // Checa no servidor (fonte de verdade)
    fetch(`/api/payment-status?id=${paymentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          setServerStatus(data.status || 'desconhecido');
          setDetails(data.details || null);
        } else {
          setError(data?.error || 'Falha ao consultar status no servidor');
        }
      })
      .catch(() => setError('Erro de rede ao consultar status'));
  }, [paymentId]);

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Pagamento</h1>

      <div className="rounded border p-4">
        <p><strong>Payment ID:</strong> {paymentId}</p>
        <p><strong>Status (client):</strong> {statusFromClient}</p>
        <p><strong>Status (server):</strong> {serverStatus}</p>
        <p><strong>External Reference:</strong> {ref}</p>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      {details && (
        <pre className="overflow-auto rounded border bg-gray-50 p-3 text-sm">
{JSON.stringify(details, null, 2)}
        </pre>
      )}

      <p className="text-sm text-gray-600">
        Assim que o Mercado Pago enviar o webhook com <code>approved</code>, seu pedido será marcado como pago e o e-mail de confirmação será enviado.
      </p>
    </main>
  );
}
