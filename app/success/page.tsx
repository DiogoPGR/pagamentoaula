'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

export default function SuccessPage() {
  const sp = useSearchParams();
  const paymentId = sp.get('paymentId');
  const statusFromClient = sp.get('status');
  const ref = sp.get('ref');

  const [serverStatus, setServerStatus] = useState<string>('carregando…');
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Função para consultar o status do pagamento
  const checkPaymentStatus = async (isForced = false) => {
    if (!paymentId) return;
    
    if (isForced) {
      setIsChecking(true);
    }
    
    try {
      const response = await fetch(`/api/payment-status?id=${paymentId}`);
      const data = await response.json();
      
      if (data?.success) {
        const newStatus = data.status || 'desconhecido';
        setServerStatus(newStatus);
        setDetails(data.details || null);
        setError(null);
        
        // Se o pagamento foi aprovado, para o polling
        if (newStatus === 'approved') {
          setIsPolling(false);
        }
      } else {
        setError(data?.error || 'Falha ao consultar status no servidor');
      }
    } catch (err) {
      setError('Erro de rede ao consultar status');
    } finally {
      if (isForced) {
        setIsChecking(false);
      }
    }
  };

  // Função para forçar verificação via POST
  const forceCheckStatus = async () => {
    if (!paymentId) return;
    
    setIsChecking(true);
    try {
      const response = await fetch('/api/payment-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      
      const data = await response.json();
      
      if (data?.success) {
        const newStatus = data.status || 'desconhecido';
        setServerStatus(newStatus);
        setDetails(data.details || null);
        setError(null);
        
        if (newStatus === 'approved') {
          setIsPolling(false);
        }
      } else {
        setError(data?.error || 'Falha na verificação forçada');
      }
    } catch (err) {
      setError('Erro de rede na verificação forçada');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (!paymentId) return;
    
    // Primeira verificação imediata
    checkPaymentStatus();
    
    // Inicia polling se o status não for aprovado
    if (statusFromClient !== 'approved') {
      setIsPolling(true);
      
      // Polling a cada 5 segundos
      const interval = setInterval(() => {
        if (isPolling) {
          checkPaymentStatus();
        }
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [paymentId, statusFromClient, isPolling]);

  // Função para renderizar o status com ícone
  const renderStatus = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold">Aprovado ✅</span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-2 text-yellow-600">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">Pendente ⏳</span>
          </div>
        );
      case 'rejected':
        // Determinar o tipo específico de rejeição
        const rejectionType = details?.rejection_info?.type || 'general_error';
        
        if (rejectionType === 'insufficient_amount') {
          return (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-semibold">Recusado por Quantia Insuficiente ❌</span>
            </div>
          );
        } else if (rejectionType === 'invalid_card_number') {
          return (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-semibold">Recusado - Cartão Inválido ❌</span>
            </div>
          );
        } else if (rejectionType === 'invalid_expiry_date') {
          return (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-semibold">Recusado - Data Inválida ❌</span>
            </div>
          );
        } else if (rejectionType === 'authorization_required') {
          return (
            <div className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-semibold">Autorização Necessária ⚠️</span>
            </div>
          );
        } else {
          return (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-semibold">Recusado por Erro Geral ❌</span>
            </div>
          );
        }
      case 'cancelled':
        return (
          <div className="flex items-center gap-2 text-orange-600">
            <AlertCircle className="h-5 w-5" />
            <span className="font-semibold">Cancelado ⏹️</span>
          </div>
        );
      case 'in_process':
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">Em Análise 🔄</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">{status}</span>
          </div>
        );
    }
  };

  // Função para renderizar mensagem baseada no status
  const renderMessage = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
            <h3 className="font-semibold mb-2">🎉 Pagamento Confirmado!</h3>
            <p>Seu pagamento foi aprovado com sucesso. Você receberá um e-mail de confirmação em breve.</p>
          </div>
        );
      case 'pending':
        return (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
            <h3 className="font-semibold mb-2">⏳ Pagamento em Processamento</h3>
            <p>Seu pagamento está sendo processado. Esta página será atualizada automaticamente quando o status mudar.</p>
            {isPolling && (
              <p className="text-sm mt-2">Verificando status automaticamente...</p>
            )}
          </div>
        );
      case 'rejected':
        // Determinar o tipo específico de rejeição
        const rejectionType = details?.rejection_info?.type || 'general_error';
        
        if (rejectionType === 'insufficient_amount') {
          return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <h3 className="font-semibold mb-2">❌ Pagamento Recusado por Quantia Insuficiente</h3>
              <p>Seu pagamento foi recusado porque o cartão não possui limite suficiente para esta transação.</p>
              <div className="mt-3 p-3 bg-red-100 rounded border border-red-300">
                <p className="text-sm font-medium">💡 O que fazer agora?</p>
                <ul className="text-sm mt-1 space-y-1">
                  <li>• Verifique o limite disponível no seu cartão</li>
                  <li>• Tente com outro cartão com limite suficiente</li>
                  <li>• Considere pagar em parcelas para reduzir o valor</li>
                  <li>• Entre em contato com seu banco para aumentar o limite</li>
                  <li>• Ou entre em contato conosco para outras opções de pagamento</li>
                </ul>
              </div>
            </div>
          );
        } else if (rejectionType === 'invalid_card_number') {
          return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <h3 className="font-semibold mb-2">❌ Pagamento Recusado - Número do Cartão Inválido</h3>
              <p>O número do cartão informado está incorreto ou inválido.</p>
              <div className="mt-3 p-3 bg-red-100 rounded border border-red-300">
                <p className="text-sm font-medium">💡 O que fazer agora?</p>
                <ul className="text-sm mt-1 space-y-1">
                  <li>• Verifique se o número do cartão está correto</li>
                  <li>• Confirme se não há espaços ou caracteres extras</li>
                  <li>• Tente novamente com os dados corretos</li>
                </ul>
              </div>
            </div>
          );
        } else if (rejectionType === 'invalid_expiry_date') {
          return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <h3 className="font-semibold mb-2">❌ Pagamento Recusado - Data de Validade Inválida</h3>
              <p>A data de validade do cartão está incorreta ou o cartão expirou.</p>
              <div className="mt-3 p-3 bg-red-100 rounded border border-red-300">
                <p className="text-sm font-medium">💡 O que fazer agora?</p>
                <ul className="text-sm mt-1 space-y-1">
                  <li>• Verifique a data de validade no seu cartão</li>
                  <li>• Confirme se o formato está correto (MM/AA)</li>
                  <li>• Use um cartão válido e não expirado</li>
                </ul>
              </div>
            </div>
          );
        } else if (rejectionType === 'authorization_required') {
          return (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-800">
              <h3 className="font-semibold mb-2">⚠️ Autorização Necessária</h3>
              <p>Seu banco precisa autorizar esta transação. Entre em contato com eles.</p>
              <div className="mt-3 p-3 bg-orange-100 rounded border border-orange-300">
                <p className="text-sm font-medium">💡 O que fazer agora?</p>
                <ul className="text-sm mt-1 space-y-1">
                  <li>• Entre em contato com seu banco</li>
                  <li>• Confirme se a transação foi autorizada</li>
                  <li>• Tente novamente após a autorização</li>
                </ul>
              </div>
            </div>
          );
        } else {
          // Rejeição geral
          return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <h3 className="font-semibold mb-2">❌ Pagamento Recusado por Erro Geral</h3>
              <p>Infelizmente seu pagamento foi recusado pelo sistema. Isso pode acontecer por diversos motivos:</p>
              <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                <li>Problemas temporários no processamento</li>
                <li>Dados do cartão incorretos ou inválidos</li>
                <li>Limite insuficiente ou cartão bloqueado</li>
                <li>Erro na validação dos dados</li>
              </ul>
              <div className="mt-3 p-3 bg-red-100 rounded border border-red-300">
                <p className="text-sm font-medium">💡 O que fazer agora?</p>
                <ul className="text-sm mt-1 space-y-1">
                  <li>• Verifique se os dados do cartão estão corretos</li>
                  <li>• Tente novamente com outro cartão</li>
                  <li>• Entre em contato com seu banco se o problema persistir</li>
                  <li>• Ou entre em contato conosco para outras opções de pagamento</li>
                </ul>
              </div>
            </div>
          );
        }
      case 'cancelled':
        return (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-800">
            <h3 className="font-semibold mb-2">⏹️ Pagamento Cancelado</h3>
            <p>Seu pagamento foi cancelado. Você pode tentar novamente quando quiser.</p>
          </div>
        );
      case 'in_process':
        return (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
            <h3 className="font-semibold mb-2">🔄 Pagamento em Análise</h3>
            <p>Seu pagamento está sendo analisado pelo sistema. Esta análise pode levar alguns minutos.</p>
            {isPolling && (
              <p className="text-sm mt-2">Verificando status automaticamente...</p>
            )}
          </div>
        );
      default:
        return (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-800">
            <h3 className="font-semibold mb-2">📋 Status do Pagamento</h3>
            <p>Verificando o status do seu pagamento...</p>
            <p className="text-sm mt-2">Status atual: <strong>{status}</strong></p>
          </div>
        );
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Status do Pagamento</h1>
        <p className="text-gray-600">Acompanhe o status do seu pagamento em tempo real</p>
      </div>

      {/* Informações do pagamento */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Detalhes do Pagamento</h2>
          <button
            onClick={forceCheckStatus}
            disabled={isChecking}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Verificando...' : 'Verificar Agora'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Payment ID</p>
            <p className="font-mono text-sm">{paymentId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Referência</p>
            <p className="font-mono text-sm">{ref}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status (Cliente)</p>
            <p className="text-sm">{statusFromClient || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status (Servidor)</p>
            {renderStatus(serverStatus)}
          </div>
        </div>
      </div>

      {/* Mensagem de status */}
      {renderMessage(serverStatus)}

      {/* Informações detalhadas de rejeição */}
      {serverStatus === 'rejected' && details?.rejection_info && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          <h3 className="font-semibold mb-3">🔍 Detalhes da Rejeição</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-red-600 font-medium">Motivo Principal:</p>
              <p className="font-mono">{details.rejection_info.reason || 'Erro geral no processamento'}</p>
            </div>
            <div>
              <p className="text-red-600 font-medium">Detalhe Técnico:</p>
              <p className="font-mono">{details.rejection_info.detail || 'N/A'}</p>
            </div>
            <div>
              <p className="text-red-600 font-medium">Método de Pagamento:</p>
              <p className="font-mono">{details.rejection_info.payment_method || 'N/A'}</p>
            </div>
            <div>
              <p className="text-red-600 font-medium">Nome do Portador:</p>
              <p className="font-mono">{details.rejection_info.cardholder_name || 'N/A'}</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-red-100 rounded border border-red-300">
            <p className="text-sm font-medium text-red-800">📋 Informações para Suporte</p>
            <p className="text-xs text-red-700 mt-1">
              Payment ID: {paymentId} | Referência: {ref} | 
              Valor: R$ {details?.transaction_amount?.toFixed(2) || 'N/A'}
            </p>
          </div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
          <h3 className="font-semibold mb-2">Erro</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Detalhes técnicos (opcional) */}
      {details && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="font-semibold mb-2 text-sm text-gray-700">Detalhes Técnicos</h3>
          <pre className="overflow-auto text-xs text-gray-600">
{JSON.stringify(details, null, 2)}
        </pre>
        </div>
      )}

      {/* Informações adicionais */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
        <h3 className="font-semibold mb-2">ℹ️ Como funciona</h3>
        <ul className="text-sm space-y-1">
          <li>• Esta página verifica automaticamente o status do seu pagamento a cada 5 segundos</li>
          <li>• Use o botão "Verificar Agora" para forçar uma verificação imediata</li>
          <li>• Quando o Mercado Pago processar o pagamento, o status será atualizado</li>
          <li>• Você receberá um e-mail de confirmação assim que o pagamento for aprovado</li>
          <li>• Pode fechar esta página e voltar mais tarde para verificar o status</li>
        </ul>
      </div>
    </main>
  );
}
