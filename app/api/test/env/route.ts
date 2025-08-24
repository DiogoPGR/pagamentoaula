import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    console.log('[TEST-ENV] 🔍 Verificando variáveis de ambiente...');
    
    // Verificar variáveis críticas
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const notificationUrl = process.env.MP_NOTIFICATION_URL;
    
    // Verificar se as variáveis estão definidas
    const envStatus = {
      MERCADOPAGO_ACCESS_TOKEN: {
        defined: !!accessToken,
        length: accessToken?.length || 0,
        preview: accessToken ? `${accessToken.slice(0, 6)}...${accessToken.slice(-4)}` : 'Não definido'
      },
      NEXT_PUBLIC_MP_PUBLIC_KEY: {
        defined: !!publicKey,
        length: publicKey?.length || 0,
        preview: publicKey ? `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}` : 'Não definido'
      },
      NEXT_PUBLIC_BASE_URL: {
        defined: !!baseUrl,
        value: baseUrl || 'Não definido'
      },
      MP_NOTIFICATION_URL: {
        defined: !!notificationUrl,
        value: notificationUrl || 'Não definido'
      }
    };
    
    console.log('[TEST-ENV] 📋 Status das variáveis:', envStatus);
    
    // Verificar se há problemas críticos
    const criticalIssues = [];
    
    if (!accessToken) {
      criticalIssues.push('MERCADOPAGO_ACCESS_TOKEN não está configurado');
    } else if (accessToken === 'YOUR_ACCESS_TOKEN') {
      criticalIssues.push('MERCADOPAGO_ACCESS_TOKEN ainda está com valor padrão');
    }
    
    if (!publicKey) {
      criticalIssues.push('NEXT_PUBLIC_MP_PUBLIC_KEY não está configurado');
    } else if (publicKey === 'YOUR_PUBLIC_KEY') {
      criticalIssues.push('NEXT_PUBLIC_MP_PUBLIC_KEY ainda está com valor padrão');
    }
    
    if (!baseUrl) {
      criticalIssues.push('NEXT_PUBLIC_BASE_URL não está configurado');
    }
    
    const hasCriticalIssues = criticalIssues.length > 0;
    
    return NextResponse.json({
      success: !hasCriticalIssues,
      message: hasCriticalIssues ? 'Problemas críticos encontrados' : 'Variáveis de ambiente configuradas corretamente',
      criticalIssues,
      environment: envStatus,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[TEST-ENV] ❌ Erro ao verificar variáveis:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro ao verificar variáveis de ambiente',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
} 