# Schema Prisma para Sistema de Pagamentos

Este diretório contém o schema Prisma para o sistema de pagamentos integrado com Mercado Pago.

## 📋 Estrutura do Banco

### Tabela `payments`
- **ID único** do sistema
- **IDs do Mercado Pago** (mercadopagoId, externalReference)
- **Informações do pagamento** (valor, moeda, status, método)
- **Dados do pagador** (nome, email, CPF)
- **Metadados** (descrição, itens, URLs)
- **Timestamps** do Mercado Pago
- **Status específicos** (detalhes de rejeição)

### Tabela `webhook_events`
- **Auditoria** de todos os webhooks recebidos
- **Rastreamento** de eventos por pagamento
- **Status de processamento** (processado, erro)
- **Dados completos** do webhook em JSON

## 🚀 Como Usar

### 1. Instalar Dependências
```bash
npm install prisma @prisma/client
npm install -D prisma
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
DATABASE_URL="mysql://root:password@localhost:3306/pagamentoaula"
```

**Exemplos de configuração:**
- **MySQL local**: `mysql://root:123456@localhost:3306/pagamentoaula`
- **MySQL com Docker**: `mysql://root:password@localhost:3306/pagamentoaula`
- **PlanetScale**: `mysql://username:password@host/database`

### 3. Gerar Cliente Prisma
```bash
npx prisma generate
```

### 4. Executar Migrações
```bash
npx prisma migrate dev --name initial
```

### 5. Visualizar Banco (Opcional)
```bash
npx prisma studio
```

## 💡 Exemplos de Uso

### **Criar Pagamento**
```typescript
import { paymentService } from '@/prisma/prisma.config';

const payment = await paymentService.createPayment({
  mercadopagoId: '123456789',
  externalReference: 'order_123',
  amount: 99.90,
  paymentMethod: 'credit_card',
  payerName: 'João Silva',
  payerEmail: 'joao@email.com',
  payerCpf: '12345678901',
  description: 'Produto Digital',
  items: [{ title: 'Produto', quantity: 1, unit_price: 99.90 }]
});
```

### **Atualizar Status**
```typescript
await paymentService.updatePaymentStatus('123456789', 'approved', {
  status_detail: 'accredited',
  date_last_updated: '2025-01-01T00:00:00Z'
});
```

### **Buscar Pagamento**
```typescript
const payment = await paymentService.getPaymentByMercadoPagoId('123456789');
const paymentByRef = await paymentService.getPaymentByReference('order_123');
```

## 🔧 Comandos Úteis

```bash
# Resetar banco (desenvolvimento)
npx prisma migrate reset

# Ver status das migrações
npx prisma migrate status

# Criar nova migração
npx prisma migrate dev --name nome_da_migracao

# Deploy em produção
npx prisma migrate deploy

# Seed do banco (se necessário)
npx prisma db seed

# Push direto (desenvolvimento)
npx prisma db push
```

## 📊 Índices Criados

- `mercadopagoId` - Busca rápida por ID do MP
- `externalReference` - Busca por referência externa
- `status` - Filtros por status do pagamento
- `payerEmail` - Busca por email do pagador
- `paymentId` - Relacionamento com webhooks
- `eventType` - Filtros por tipo de evento

## 🎯 Próximos Passos

1. **Integrar com webhook** - Salvar pagamentos quando criados
2. **Atualizar status** - Modificar status quando webhook chegar
3. **Logs de auditoria** - Registrar todos os eventos
4. **Relatórios** - Consultas para análise de dados
5. **Cache** - Otimizar consultas frequentes

## ⚠️ Notas sobre MySQL

- **Charset**: UTF8MB4 para suporte completo a emojis
- **JSON**: Suporte nativo a campos JSON
- **ENUM**: Status implementado como ENUM nativo
- **Índices**: Otimizados para consultas frequentes 