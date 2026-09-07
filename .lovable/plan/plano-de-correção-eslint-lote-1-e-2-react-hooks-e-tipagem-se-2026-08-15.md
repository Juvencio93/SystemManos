# Plano de Correção ESLint - Lote 1 e 2 (React Hooks e Tipagem Segura)

Este plano foca na correção incremental e segura dos erros ESLint, priorizando a estabilidade do Dashboard Financeiro e telas administrativas.

## Lote 1: React e Hooks

Correção de dependências e regras de hooks para evitar renderizações desnecessárias ou comportamentos inconsistentes.

### Arquivos

- `src/routes/_authenticated/financeiro/index.tsx`
- `src/routes/_authenticated/financeiro/-components.tsx`
- `src/routes/_authenticated/empresas.$companyId.tsx`

## Lote 2: Tipagem e Telas Administrativas

Substituição de `any` por tipos explícitos do `Database` ou interfaces locais, além da limpeza de variáveis não utilizadas.

### Arquivos

- `src/routes/_authenticated/gerente-operacional.tsx`
- `src/routes/_authenticated/filiais.tsx`
- `src/routes/_authenticated/empresas.index.tsx`

## Regras de Preservação Financeira

- **MRR**: Soma das mensalidades das empresas com `subscription_status === 'ativa'`.
- **Receita Acumulada**: Soma de todas as `company_charges` com `status === 'pago'`.
- **Investimento Total**: Soma histórica de `expenses`.
- **Lucro Real**: Receita Acumulada - Investimento Total.
- **Filtros**: O filtro de período não deve afetar os KPIs acumulados históricos.

## Detalhes Técnicos

- Utilizar `import type { Database } from "@/integrations/supabase/types"` para tipagem.
- Validar objetos `unknown` com `Zod` quando provenientes de APIs externas ou IA.
- Configurar `.eslintignore` ou `.eslintrc.json` para ignorar `src/integrations/supabase/types.ts` se necessário, sem editá-lo.

## Validação Final

Para cada lote:

1. `bunx tsc --noEmit`
2. `bun run build`
3. `bunx eslint . --format summary`
