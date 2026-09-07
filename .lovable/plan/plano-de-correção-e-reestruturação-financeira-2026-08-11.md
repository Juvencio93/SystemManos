# Plano de Correção e Reestruturação Financeira

Auditoria realizada: A empresa "PANIFICADORA CAMPOS" (R$ 150,00) está ativa, mas não possui cobrança pendente. A "SOLVER" possui uma cobrança de R$ 60,00 para 09/2026. Isso explica o MRR de R$ 210,00 e a previsão de R$ 60,00, além do erro de competência no filtro "Este mês" (já que estamos em Agosto/2026 e a única cobrança é de Setembro).

## 1. Correção dos Dados e Idempotência (Backend)

- **Audit & Backfill**: Criar a cobrança faltante para "PANIFICADORA CAMPOS" (08/2026 e 09/2026 conforme regra).
- **Refatorar `ensureCurrentCharge`**:
  - Garantir que use a competência correta baseada no mês atual e `due_day`.
  - Se o `due_day` do mês atual já passou, a cobrança deve ser marcada como `atrasado` ou `pendente` conforme a data exata.
  - Implementar `upsert` ou verificação rigorosa de `(company_id, competence)` para evitar duplicidade.
- **Refatorar `updateCompany`**: Garantir que a sincronização financeira não crie lacunas e respeite o fuso `America/Sao_Paulo`.

## 2. Refatoração da Visão Geral (Frontend)

- **Filtros de Período**:
  - Ajustar a lógica de `getFinanceiroStats` para filtrar estritamente por `due_date`.
  - Adicionar opção "Próximos 30 dias" e torná-la o padrão.
- **Cards de Resumo**:
  - Faturamento: Pagos no período.
  - MRR: Soma de `monthly_price` de empresas ativas.
  - Previsão: Soma de pendentes/atrasados no período.
  - Em Atraso: Pendentes com `due_date < hoje`.
- **Novos Gráficos**:
  - **Previsão de Recebimentos**: Gráfico de barras (Recharts) com cores semânticas (Verde: Pago, Amarelo: Pendente, Vermelho: Atrasado, Ciano: Futuro).
  - **Distribuição da Receita**: Gráfico de rosca (PieChart) por empresa matriz.

## 3. Segurança e Qualidade

- Validar RLS para garantir isolamento total.
- Implementar skeletons e estados de erro robustos.
- Executar `npm run build` e `npm run lint` para garantir integridade.

## Detalhes Técnicos

- **Arquivos**: `src/lib/financeiro.functions.ts`, `src/lib/billing.functions.ts`, `src/routes/_authenticated/financeiro/index.tsx`, `src/routes/_authenticated/financeiro/a-receber.tsx`.
- **Base de Dados**: Manutenção das tabelas `companies` e `company_charges`.
