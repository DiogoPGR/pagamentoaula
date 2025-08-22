#!/usr/bin/env node

/**
 * Script para testar o webhook localmente
 * Execute: node scripts/test-webhook.js
 */

const https = require('https');
const http = require('http');

// Configurações
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhook';
const PAYMENT_ID = process.env.PAYMENT_ID || '123456789';

// Dados de teste
const testData = {
  type: 'payment',
  data: {
    id: PAYMENT_ID
  }
};

// Função para fazer requisição HTTP/HTTPS
function makeRequest(url, data) {
  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';
  const client = isHttps ? https : http;
  
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (isHttps ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(data))
    }
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

// Função principal
async function testWebhook() {
  console.log('🧪 Testando Webhook...\n');
  console.log(`📍 URL: ${WEBHOOK_URL}`);
  console.log(`🆔 Payment ID: ${PAYMENT_ID}`);
  console.log(`📦 Dados: ${JSON.stringify(testData, null, 2)}\n`);

  try {
    console.log('📡 Enviando requisição...');
    const response = await makeRequest(WEBHOOK_URL, testData);
    
    console.log('✅ Resposta recebida:');
    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Headers: ${JSON.stringify(response.headers, null, 2)}`);
    console.log(`   Data: ${JSON.stringify(response.data, null, 2)}`);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log('\n🎉 Webhook funcionando corretamente!');
    } else {
      console.log('\n⚠️  Webhook retornou status de erro');
    }
    
  } catch (error) {
    console.error('\n❌ Erro ao testar webhook:');
    console.error(error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Dica: Verifique se o servidor está rodando em:', WEBHOOK_URL);
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testWebhook();
}

module.exports = { testWebhook, makeRequest };
