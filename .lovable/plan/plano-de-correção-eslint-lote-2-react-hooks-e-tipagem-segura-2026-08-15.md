# Plano de Correção ESLint - Lote 2: React, Hooks e Tipagem Segura

Este plano visa corrigir os erros ESLint residuais focando em tipagem (`any` -> interfaces explícitas) e regras de React/Hooks nas telas administrativas de Empresas e Gerente Operacional.

## Ações Realizadas (Pré-requisitos)

- Reconciliação do inventário de erros para 126.
- Formatação global com Prettier para remover avisos de estilo.
- Criação de `src/lib/financeiro.types.ts` e correção total do módulo Financeiro.
- Verificação do Build e TypeScript (ambos com saída 0).

## Novas Etapas

### 1. Tipagem das Telas de Detalhes da Empresa

- **Arquivo**: `src/routes/_authenticated/empresas.$companyId.tsx`
- **Ação**:
  - Substituir todos os `any` nos mapas de `dispositivos`, `branches` e `campanhas` (linhas 550-850).
  - Utilizar o tipo `CompanyDetail` e seus subtipos definidos em `src/lib/company-detail.server.ts`.
  - Corrigir tipagem de eventos em componentes Recharts.

### 2. Refatoração do Gerente Operacional

- **Arquivo**: `src/routes/_authenticated/gerente-operacional.tsx`
- **Ação**:
  - Corrigir tipagem do `context` no `beforeLoad` (remover `unknown`).
  - Substituir `any` no mapeamento de alertas e nos componentes de exibição.
  - Garantir que `groupedOperations` use tipos explícitos de `OperationMetric`.
  - Corrigir tipagem de objetos injetados em utilitários de nome (`getBranchDisplayName`).

### 3. Saneamento de Filiais e Utilitários Legados

- **Arquivos**: `src/routes/_authenticated/filiais.tsx`, `src/lib/portal.server.ts`
- **Ação**:
  - Remover `any` em `onError` handlers e nos loops de renderização de tabelas.
  - Tipar explicitamente os resultados de consultas Supabase manuais.
  - Corrigir a exportação de tipos em `src/integrations/supabase/types.ts` se necessário (embora o arquivo esteja ignorado, as importações dele não estão).

### 4. Validação Final

- Executar `bun run build` para garantir integridade.
- Executar `eslint` apenas nos arquivos modificados para confirmar 0 erros.

## Detalhes Técnicos

- **Financeiro**: As fórmulas (MRR, Lucro Real) permanecem intocadas, apenas a passagem de dados agora é tipada via `FinanceiroStats`.
- **IA**: O contexto hierárquico da IA em `operational.functions.ts` é preservado; a correção foca apenas na exibição do resultado no frontend.
- **Timezone**: Mantido `America/Sao_Paulo` em todos os formatadores de data.
