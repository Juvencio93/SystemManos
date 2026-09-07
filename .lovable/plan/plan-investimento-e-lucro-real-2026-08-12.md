# Plan: Investimento e Lucro Real

Renomear o conceito de "Despesas" para "Investimento" no módulo Financeiro e ajustar as fórmulas de cálculo para considerar o histórico acumulado (Investimento total vs Receita acumulada), garantindo que o filtro de período não apague o histórico desses indicadores específicos.

## User Review Required

> [!IMPORTANT]
> A alteração mudará o rótulo visual de "Despesas" para "Investimento" em todo o dashboard financeiro. O cálculo de "Investimento a recuperar" e "Lucro realizado" passará a ser acumulado (histórico total do banco de dados), independente do filtro de data selecionado no dashboard.

- Confirmar se a renomeação de "Despesas" para "Investimento" deve ser aplicada também ao título da página de gerenciamento (`/financeiro/despesas`).
- Confirmar se o "Investimento total" deve realmente ignorar qualquer filtro de data em todos os cards do dashboard.

## Technical Details

### 1. Backend: `src/lib/financeiro.functions.ts`

- Renomear campos no retorno de `getFinanceiroStats`: `despesasTotal` -> `investimentoTotal`, `lucroReal` -> `lucroAcumulado` (ou similar).
- Calcular `receitaAcumuladaTotal`: Soma de todas as cobranças com `status === 'pago'` no banco, sem filtro de data.
- Calcular `investimentoTotalAcumulado`: Soma de todas as despesas no banco, sem filtro de data.
- Implementar as novas fórmulas:
  - `investimentoARecuperar = Math.max(investimentoTotalAcumulado - receitaAcumuladaTotal, 0)`
  - `lucroRealizado = Math.max(receitaAcumuladaTotal - investimentoTotalAcumulado, 0)`

### 2. Frontend: Dashboard Financeiro (`src/routes/_authenticated/financeiro/index.tsx`)

- Atualizar rótulos nos Cards:
  - "Despesas" -> "Investimento"
  - "Faturamento" -> "Receita" (se necessário, ou manter coerente com o pedido).
- Adicionar/Atualizar cards para:
  - "Investimento total" (Acumulado)
  - "Receita acumulada" (Acumulado)
  - "Investimento a recuperar" ou "Lucro realizado" (Lógica condicional baseada nas fórmulas).
- Garantir que os valores exibidos nesses cards específicos venham dos campos acumulados calculados no servidor.

### 3. Frontend: Gestão de Investimentos (`src/routes/_authenticated/financeiro/despesas.tsx`)

- Renomear títulos e textos: "Gastos de Ativação" -> "Investimentos de Ativação".
- Atualizar breadcrumbs e links internos.

### 4. Head Metadata

- Atualizar o título da rota de despesas para refletir "Investimentos".
