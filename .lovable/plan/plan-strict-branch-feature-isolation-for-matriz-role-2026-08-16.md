# Plan: Strict Branch Feature Isolation for Matriz Role

The objective is to ensure that all branch-related UI elements (cards, menu items, shortcuts, and selection options) are completely hidden from users with the `matriz` role when their plan limit for branches (`activationLimit`) is 0.

## User Review Required

> [!IMPORTANT]
> This plan will enforce a strict rule: if the Matriz account has `0` filiais included in their plan, all filial management and selection features will be completely removed from their view, not just disabled.

## Proposed Changes

### 1. Unified Access Hook Enhancement
`src/hooks/use-access.ts`
- Ensure `activationLimit` is always correctly fetched from the `companies` table and exposed in the `AccessInfo` type.

### 2. Dashboard Component Update
`src/routes/_authenticated/dashboard.tsx`
- Refine the `canUseBranches` logic in `MatrizDashboard` to strictly check `planLimit > 0`.
- Use this flag to filter the `modules` array so the "Filiais" card is not rendered.
- Ensure the `branchesCount` query is handled gracefully when the limit is 0.

### 3. Sidebar Menu Update
`src/components/app/app-shell.tsx`
- Update the filtering logic for sidebar navigation items.
- Specifically hide the "Filiais" item (currently linking to `/portais` or `/filiais`) for Matriz users when `activationLimit` is 0.

### 4. Campaign Management Update
`src/routes/_authenticated/campanhas.tsx`
- In `targetOptions`, filter out any branch options for Matriz users when their limit is 0, leaving only the "Matriz" and "Evento" options if applicable.

### 5. Branch Management Page Protection
`src/routes/_authenticated/filiais.tsx`
- Add a top-level check: if the user is Matriz and the limit is 0, render a "Feature Not Available" state or redirect to dashboard (though the menu link will already be hidden).

## Technical Details
- The condition `role === 'matriz' && activationLimit === 0` will be the central trigger for hiding elements.
- We will use `Number(company?.activation_limit ?? 0)` to ensure consistent numeric comparison.
- We will verify if `activationLimit` in `AccessInfo` corresponds to `filiais_incluidas_no_plano` (it currently maps to `activation_limit` in `useAccess`).

## Verification Plan
- **Manual Verification:** Access the preview as a Matriz user with `activation_limit = 0` and confirm:
  - Sidebar does not show "Filiais".
  - Dashboard does not show "Filiais" card.
  - Campaign creation "Local" select does not show "Filial" options.
  - Direct navigation to `/filiais` shows the restricted access message.
