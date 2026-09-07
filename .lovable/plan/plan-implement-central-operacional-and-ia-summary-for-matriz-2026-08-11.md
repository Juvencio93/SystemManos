# Plan: Implement Central Operacional and IA Summary for Matriz

Restructure the AI Summary logic and implement the Operational Manager view for Matriz users, ensuring strict context isolation and professional operational language.

## User Review Required

> [!IMPORTANT]
> The Operational Manager for Matriz will display a consolidated view of the Headquarters and its active branches. A daily analysis will be generated automatically at 06:00 (BRT). For new companies (<14 days), the system will use the "Em observação" (In observation) status to avoid false alerts.

- Does the Matriz user need to be able to trigger a new operational analysis manually, or should they only see the daily scheduled one? (Default: Read-only daily analysis to save costs).

## Proposed Changes

### Database & Migrations

- Update `operational_analyses` to support `company_id` for Matriz-specific daily snapshots.
- Ensure RLS policies allow Matriz users to read only their own company's analyses.

### Backend (Server Functions)

#### `src/lib/operational.functions.ts`

- Refactor `runOperationalAnalysis` to support an optional `companyId` parameter for Matriz-level daily jobs.
- Update `getLatestOperationalAnalysis` to filter by the authenticated user's `company_id` when the role is `matriz`.
- Implement strict validation to prevent Matriz users from accessing data from other companies.

#### `src/lib/insights.functions.ts` & `src/lib/company.server.ts`

- Fix `getCompanyBriefing` and `getCompanyOverview` to resolve context exclusively from the session's `company_id`.
- Ensure the AI prompt for Matriz summaries prioritizes the "Perfil Comercial" (Segment, Description, Goal).
- Renaming: Update "Resumo IA" button logic to "Ver resumo diário" which fetches the persisted analysis instead of triggering a new AI call.

### Frontend (UI/UX)

#### `src/components/app/app-shell.tsx`

- Add "Gerente Operacional IA" to the sidebar for `matriz` role.

#### `src/routes/_authenticated/gerente-operacional.tsx`

- Update the page to handle both ADM (global) and Matriz (filtered) views.
- Implement the Matriz-specific dashboard: General situation, highlighted units, "Em observação" units, and executive summary.

#### `src/components/app/ai-agent-card.tsx`

- Rename the button in the Matriz card to "Ver resumo diário".
- Ensure the card logic for Matriz reads the persisted daily analysis instead of calling the AI summary on every click.

## Technical Details

- **Idempotency**: Daily jobs for each Matriz will be keyed by `company_id` and `analysis_date`.
- **Security**: Server-side verification of roles and `company_id` using `context.supabase`. No reliance on `user_metadata`.
- **AI Cost Optimization**: Matriz analysis is limited to once per day. Manual chat (Marketing Consultancy) remains separate and respects existing daily limits.

## Validation Plan

- [ ] Log in as Matriz and verify "Gerente Operacional IA" appears in the menu.
- [ ] Verify the page displays only data for that Matriz and its branches.
- [ ] Verify that units with <14 days show the blue "Em observação" badge.
- [ ] Check if the AI Summary correctly uses the "Perfil Comercial" context.
- [ ] Attempt to access another company's analysis URL and verify access is denied.
