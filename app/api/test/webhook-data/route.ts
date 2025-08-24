import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Simular dados de um webhook do Mercado Pago
    const mockWebhookData = body.mockData || {
      payer: {
        first_name: 'João',
        last_name: 'Silva',
        email: 'joao.silva@email.com',
        identification: {
          type: 'CPF',
          number: '12345678901'
        }
      },
      metadata: {
        buyer_email: 'joao.silva@email.com',
        customer_name: 'João Silva',
        payer_cpf: '12345678901'
      },
      additional_info: {
        payer: {
          first_name: 'João',
          last_name: 'Silva',
          email: 'joao.silva@email.com',
          identification: {
            number: '12345678901'
          }
        }
      }
    };

    // Função para extrair dados do pagador (igual ao webhook)
    function extractPayerData(details: any) {
      let payerName = 'Nome não informado';
      let payerEmail = 'email@nao.informado';
      let payerCpf = 'CPF não informado';
      
      // Nome: tentar várias fontes
      if (details?.payer?.first_name || details?.payer?.last_name) {
        payerName = [details.payer.first_name, details.payer.last_name]
          .filter(Boolean)
          .join(' ')
          .trim();
      } else if (details?.metadata?.customer_name) {
        payerName = details.metadata.customer_name;
      } else if (details?.additional_info?.payer?.first_name) {
        payerName = details.additional_info.payer.first_name;
      }
      
      // Email: tentar várias fontes
      if (details?.metadata?.buyer_email) {
        payerEmail = details.metadata.buyer_email;
      } else if (details?.payer?.email) {
        payerEmail = details.payer.email;
      } else if (details?.additional_info?.payer?.email) {
        payerEmail = details.additional_info.payer.email;
      }
      
      // CPF: tentar várias fontes
      if (details?.payer?.identification?.number) {
        payerCpf = details.payer.identification.number;
      } else if (details?.metadata?.payer_cpf) {
        payerCpf = details.metadata.payer_cpf;
      } else if (details?.additional_info?.payer?.identification?.number) {
        payerCpf = details.additional_info.payer.identification.number;
      }
      
      return { payerName, payerEmail, payerCpf };
    }

    const extractedData = extractPayerData(mockWebhookData);

    return NextResponse.json({
      success: true,
      test: {
        input: mockWebhookData,
        extracted: extractedData,
        analysis: {
          nameFound: extractedData.payerName !== 'Nome não informado',
          emailFound: extractedData.payerEmail !== 'email@nao.informado',
          cpfFound: extractedData.payerCpf !== 'CPF não informado',
          allDataFound: extractedData.payerName !== 'Nome não informado' && 
                       extractedData.payerEmail !== 'email@nao.informado' && 
                       extractedData.payerCpf !== 'CPF não informado'
        }
      }
    });

  } catch (err) {
    console.error('[TEST] Erro ao testar extração de dados:', err);
    return NextResponse.json(
      { success: false, error: 'Falha ao testar extração' },
      { status: 500 }
    );
  }
} 