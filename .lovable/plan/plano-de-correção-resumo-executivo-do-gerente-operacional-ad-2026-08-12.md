# Plano de Correção: Resumo Executivo do Gerente Operacional ADM

Este plano visa corrigir a hierarquia e a apresentação do resumo executivo na visão ADM, garantindo que a estrutura organizacional (Matriz vs. Filial) seja respeitada e renderizada de forma determinística, sem depender da montagem livre da IA.

## Mudanças Técnicas

### 1. Servidor: Fonte Única da Hierarquia (`src/lib/operational.utils.server.ts`)

- Refatorar `buildCompanyOperations` para retornar uma estrutura de dados que utilize `created_at` específico da unidade (branch ou company).
- Criar a função `buildGroupedOrganizations` para agrupar operações por empresa, garantindo que:
  - Cada `company` seja uma Matriz.
  - Cada `branch` (ativa e não sede) seja uma Filial vinculada à sua Matriz.
  - Os nomes sigam a regra: `trade_name` > `legal_name` > `name`.

### 2. IA: Resposta Estruturada e Validação (`src/lib/ai.server.ts`)

- Alterar o `systemPrompt` para solicitar um JSON estruturado por `companyId`.
- A IA fornecerá apenas `diagnosis` e `recommendation` para cada organização já agrupada.
- Implementar validação no servidor para garantir que a IA não invente ou misture empresas.

### 3. Orquestração e Fallback (`src/lib/operational-job.server.ts`)

- Atualizar o fluxo para passar a estrutura agrupada para a IA.
- Implementar fallback determinístico caso a IA falhe ou retorne dados inválidos.
- Garantir que resumos antigos (em parágrafo único) sejam substituídos pela nova visualização estruturada.

### 4. Frontend: Renderização Determinística (`src/routes/_authenticated/gerente-operacional.tsx`)

- Alterar a renderização do `Resumo Executivo` para exibir seções separadas por empresa.
- Cada seção terá: Título (Nome Fantasia), Situação da Matriz, Situação das Filiais, Diagnóstico e Recomendação.
- Remover UUIDs e IDs técnicos da visualização.

## Arquivos que serão modificados

- `src/lib/operational.utils.server.ts`
- `src/lib/operational-job.server.ts`
- `src/lib/ai.server.ts`
- `src/routes/_authenticated/gerente-operacional.tsx`

Nenhum outro arquivo do sistema será alterado.
