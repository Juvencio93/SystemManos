# Plano: Separação de Nome Pessoal e Nome Fantasia

## 1. Auditoria do Esquema Real

- **display_name**: `public.profiles.display_name` (Saudações).
- **Nome Fantasia (Matriz)**: `public.companies.trade_name` (Principal campo de identificação).
- **Nome Fantasia (Filial)**: `public.branches.trade_name` (Identificação da unidade).
- **Razão Social**: `legal_name` em ambas as tabelas.
- **Relacionamentos**: `user_roles` vincula `user_id` a `company_id`.

## 2. Ajustes em Helpers Centrais (`src/lib/name-utils.ts`)

- Refinar `getCompanyDisplayName` e `getBranchDisplayName` para priorizar estritamente `trade_name` e usar `legal_name` apenas como último recurso, removendo dependências de nomes de usuários.

## 3. Financeiro

- **Backend**: Atualizar `getFinanceiroStats` em `src/lib/financeiro.functions.ts` para selecionar explicitamente `trade_name` e `legal_name` da tabela `companies`.
- **Frontend**:
  - `financeiro/index.tsx`: Atualizar gráficos (Recharts Tooltips) e indicadores para usar `trade_name`.
  - `financeiro/a-receber.tsx`, `em-atraso.tsx`, `faturamento.tsx`: Corrigir tabelas e filtros de busca para identificar empresas pelo nome fantasia.
  - `financeiro/recibo.$chargeId.tsx`: Garantir exibição do Nome Fantasia em destaque e Razão Social nos dados formais.

## 4. Empresas e Filiais

- **Listagem de Empresas**: Corrigir `empresas.index.tsx` para exibir e buscar por `trade_name`.
- **Detalhes da Empresa**: `empresas.$companyId.tsx` deve exibir o nome fantasia no título e breadcrumb.
- **Filiais**: `filiais.tsx` deve mostrar o `trade_name` da filial, com subtítulo indicando a Matriz vinculada.

## 5. CRM e Relatórios

- **CRM**: (Se aplicável via rotas de marketing/campanhas) Garantir que cards e seletores usem `branch.trade_name` ou `company.trade_name`.
- **Relatórios**: `relatorios.tsx` deve usar a marca corporativa (`trade_name`) em vez de nomes de usuários responsáveis.

## 6. Padronização de Retorno (Backend)

- Revisar server functions em `src/lib/company-detail.server.ts`, `portal.server.ts` e `operational.utils.server.ts` para retornar propriedades explícitas: `companyTradeName`, `branchTradeName`, `userDisplayName`.

## Detalhes Técnicos

- Utilização de `companyTradeName` e `branchTradeName` em DTOs.
- Invalidação seletiva de cache via `queryClient.invalidateQueries` para chaves financeiras e de empresas.
- Implementação de fallbacks robustos: `trade_name` -> `name` -> `legal_name` -> "Sem nome".
