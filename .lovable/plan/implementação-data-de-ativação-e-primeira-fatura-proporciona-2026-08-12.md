# Implementação: Data de Ativação e Primeira Fatura Proporcional

Implementar a lógica de ativação de empresas com cobrança imediata de ativação e cálculo automático de fatura proporcional caso a data de ativação divirja do dia de vencimento mensal.

## Alterações Propostas

### 1. Banco de Dados (Migration SQL)

- Adicionar coluna `activated_at` (timestamptz) na tabela `companies`.
- Garantir que a coluna `due_day` seja obrigatória para o fluxo financeiro.

### 2. Funções de Servidor (`src/lib/cnpj.functions.ts`)

- Atualizar `companyInput` para incluir `activated_at` como obrigatório no cadastro.
- Modificar `createCompanyWithAccess`:
  - Salvar `activated_at`.
  - Chamar uma nova função `processInitialBilling(companyId, activatedAt, dueDay, monthlyPrice)`.
  - A função `processInitialBilling` será atômica e idempotente:
    - Cria cobrança "Ativação" (valor integral, status pago, vencimento hoje).
    - Calcula o próximo vencimento (próximo mês no `due_day`).
    - Se `day(activatedAt) != dueDay`:
      - Calcula dias proporcionais.
      - Valor = `(monthlyPrice / 30) * dias`.
      - Cria cobrança "Período proporcional" (pendente).
    - Senão:
      - Cria cobrança "Mensalidade" integral para o próximo mês (pendente).

### 3. Interface de Cadastro (`src/routes/_authenticated/empresas.index.tsx`)

- Adicionar campo "Data de ativação" (Popovers/Calendar do Radix/shadcn).
- Garantir que o formulário exija a data.
- **Preview Financeiro**: Adicionar uma seção no diálogo de cadastro que mostre:
  - Valor da Ativação (R$).
  - Valor da Próxima Fatura (Proporcional ou Integral) com data de vencimento.

### 4. Lógica de Data e Timezone

- Usar explicitamente `America/Sao_Paulo` para todos os cálculos de competência e vencimento.
- Implementar helper para "último dia do mês" para vencimentos em dias 29, 30, 31.

## Detalhes Técnicos

### Fórmula do Proporcional

```typescript
const dailyValue = monthlyPrice / 30;
const diffDays = differenceInDays(nextBillingDate, activatedAt);
const proportionalValue = Math.round(dailyValue * diffDays * 100) / 100;
```

### Idempotência

- A função de ativação verificará a existência de cobranças com a referência "Ativação" para a empresa antes de gerar novas.

### Validação e Build

- Executar `npx tsc --noEmit` e `npm run build` ao final.

## Plano de Testes

1. Cadastrar empresa com ativação 20/08 e vencimento 10 (Deve gerar Ativação paga hoje + Proporcional de ~20 dias para 10/09).
2. Cadastrar empresa com ativação 10/08 e vencimento 10 (Deve gerar Ativação paga hoje + Integral para 10/09).
3. Testar meses curtos (Fevereiro) com vencimento dia 30.
4. Tentar salvar duas vezes seguidas para garantir que as cobranças não duplicam.
