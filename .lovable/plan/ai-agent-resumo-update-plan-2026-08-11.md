# AI Agent Resumo Update Plan

Fix the "Atualizar resumo com IA" (Update AI Summary) feature on the company details page for the Admin panel.

## User Review Required

> [!IMPORTANT]
>
> - The AI summary will now be purely manual, meaning it will not load automatically when opening the page.
> - Admins will now use the commercial profile of the selected company for AI context, rather than their own profile.

## Proposed Changes

### AI Insights Logic

- **`src/lib/insights.functions.ts`**:
  - Update `resolveContext` to handle cases where an admin is viewing a specific company detail page.
  - Modify `getCompanyDetailBriefing` to ensure it uses the provided `companyId` and validates admin privileges.
  - Ensure AI limits are checked correctly for admins.

### UI Components

- **`src/components/app/ai-agent-card.tsx`**:
  - Add role-based titles (e.g., "Pergunte sobre a plataforma" for Admin).
  - Remove automatic triggers for AI generation.
  - Ensure the "Completar perfil" (Complete profile) banner is correctly shown/hidden based on role and inheritance.

### Company Detail Page

- **`src/routes/_authenticated/empresas.$companyId.tsx`**:
  - Remove `enabled: !!detail.data` and automatic refetching from the `briefing` query.
  - Update the "Atualizar resumo com IA" button to be a plain button (`type="button"`) and fix its `onClick` handler.
  - Add logic to display the "Nenhum resumo gerado" (No summary generated) message if no data exists.
  - Display the last update timestamp.
  - Ensure manual triggering only calls the server function once.

## Technical Details

### Security

- Server functions will explicitly verify if the user has the `adm` role before allowing access to another company's data.
- The `companyId` will be validated against the database to prevent ID spoofing.

### Performance

- AI results are cached in the `companies` table under `ai_insights_cache`.
- A 10-minute throttle is enforced on the server to prevent excessive AI costs.

### Validation

- Verify that opening a company details page does not trigger a network request to the AI gateway.
- Verify that clicking the update button triggers exactly one request.
- Verify that the summary persists across page reloads.
- Verify that the AI context correctly uses the Matriz Commercial Profile for the selected company.
