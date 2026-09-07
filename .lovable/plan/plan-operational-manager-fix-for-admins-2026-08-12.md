# Plan - Operational Manager Fix for Admins

Correction of the IA Operational Manager for `adm` role, ensuring correct hierarchy between Headquarters (Matriz) and Branches (Filial), standardized name resolution, and dynamic unit grouping.

## Proposed Changes

### 1. `src/lib/operational.functions.ts`

- Update `OPERATIONAL_RULES` to ensure `NEW_OPERATION_DAYS` is 5 (confirmed).
- Update types to include corporate fields if missing (already has `companyTradeName`, etc.).

### 2. `src/lib/operational.utils.server.ts`

- **`buildCompanyOperations`**: Refactor to strictly differentiate Matriz (from `companies`) and Filiais (from `branches`).
- **Hierarchy**: Ensure a Matriz is never labeled as a Filial and only actual branches linked via `company_id` are grouped.
- **Name Resolution**: Apply strict priority: `trade_name` > `legal_name` > `name`.
- **`buildInitialOperationalSummary`**: Improve deterministic summary to follow hierarchy and use corporate names.

### 3. `src/lib/operational-job.server.ts`

- **Data Agroupment**: Reorganize unit grouping by `company_id` before saving to `metrics_snapshot`.
- **Hash Stability**: Update hash generation to consider ID, unit type, and corporate names.
- **IA Prompt**: Enhance the system prompt for `generateGlobalOperationalSummary` to emphasize hierarchy and corporate names.
- **Counters**: Fix global counters (`EMPRESAS`, `UNIDADES`, etc.) to correctly count distinct Headquarters and total active units without duplication.

### 4. `src/routes/_authenticated/gerente-operacional.tsx`

- **Authentication**: Remove specific email/ID checks for admins; use only `user_roles.role === 'adm'`.
- **UI Clean-up**: Remove UUID/ID display from the public interface.
- **Grouping**: Ensure units are grouped by Matriz in the UI list.
- **Stable Sort**: Sort companies by `trade_name`, and units within them (Matriz first, then branches by `trade_name`).

### 5. `src/components/app/operational/OperationalUnitCard.tsx`

- Ensure corporate names are passed and displayed.
- Verify fallback names ("Empresa sem nome", "Filial sem nome").

## Technical details

- **Hierarchy Rule**: Matriz = `companies` record; Filial = `branches` record where `is_headquarters` is false (or filtered by `company_id`).
- **Admins**: Any user with `role = 'adm'` in `user_roles` gets the global view.
- **Observation Period**: Exactly 5 days for the `observacao` status.
- **Validation**:
  - `npm run build` for type safety.
  - Manual verification of grouping logic via preview.
  - No new migrations or RLS changes.
