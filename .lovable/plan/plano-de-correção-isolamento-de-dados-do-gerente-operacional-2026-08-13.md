# Plano de Correção: Isolamento de Dados do Gerente Operacional IA

O Gerente Operacional está exibindo alertas de unidades (ex: Solver2) em empresas às quais elas não pertencem (ex: Boteco do Barão). A auditoria identificou que, embora o agrupamento técnico seja realizado, o prompt da IA e o processamento dos resultados não impõem um isolamento rigoroso por ID, permitindo que a IA misture recomendações ou que o código associe prioridades globais a empresas específicas.

## Auditoria do Fluxo

1.  **Consultas**: Realizadas em `operational.utils.server.ts` e `operational-job.server.ts`. O filtro por `company_id` existe, mas os dados são unidos em arrays globais antes de serem processados pela IA.
2.  **Associação**: Unidades são associadas via `branch_id` e `company_id`.
3.  **Objeto IA**: O `userContent` enviado para a IA (`ai.server.ts`) agrupa por organização, mas o prompt é vago sobre o isolamento absoluto.
4.  **Resposta IA**: A IA retorna um JSON com um array de `recommendations` (por `companyId`) e arrays globais de `prioridades` e `destaques`.
5.  **Falha de Isolamento**: O frontend (`gerente-operacional.tsx`) consome `summaryIa.prioridades` (global) dentro do loop de cada empresa, exibindo todos os alertas para todas as empresas.

## Ações Técnicas

### 1. Reforço no Agrupamento de Dados (Backend)

- Ajustar `buildGroupedOrganizations` em `operational.utils.server.ts` para garantir que o objeto de cada organização contenha apenas suas próprias filiais, validando o `company_id`.

### 2. Rigor no Prompt da IA (Backend)

- Modificar `generateGlobalOperationalSummary` em `ai.server.ts` para exigir que `prioridades` e `destaques` sejam incluídos **dentro** de cada objeto de empresa no array `recommendations`, em vez de serem arrays globais.
- Atualizar o `systemPrompt` para proibir explicitamente a menção de unidades de outras empresas.

### 3. Validação de IDs na Resposta (Backend/Frontend)

- Implementar uma validação no `ai.server.ts` que verifica se qualquer unidade mencionada na recomendação de uma empresa realmente pertence a essa empresa.
- Em `operational.functions.ts`, garantir que o enriquecimento dos dados filtre estritamente por ID.

### 4. Isolamento na Exibição (Frontend)

- Alterar `gerente-operacional.tsx` para renderizar apenas as prioridades e destaques que pertençam especificamente àquela organização no loop, eliminando a exibição de listas globais.

### 5. Tratamento de Histórico Insuficiente

- Padronizar as mensagens de "observação" (5 dias) para serem determinísticas e não inventarem tendências, tanto na IA quanto no fallback de código.

## Auditoria de Segurança e Dados

- Nenhuma alteração de RLS ou permissões é necessária. A correção foca no isolamento lógico durante o processamento da IA e renderização.

## Arquivos a serem alterados

- `src/lib/operational.utils.server.ts`
- `src/lib/ai.server.ts`
- `src/lib/operational.functions.ts`
- `src/routes/_authenticated/gerente-operacional.tsx`
