# Financeiro Module Surgical Correction

Correct the Financial module calculations and responsiveness according to the strict requirements.

## User Review Required

> [!IMPORTANT]
>
> - "Faturamento Recebido" will now use `paid_at` for period filtering.
> - Responsiveness will be improved for cards, charts, and tables.

## Proposed Changes

### Backend (Logic)

#### [Financial Functions](src/lib/financeiro.functions.ts)

- Modify `getFinanceiroStats` to filter `pago` charges using `paid_at` when a period is selected.
- Ensure `due_date` is still used for `pendente` and `atrasado` charges.
- Prevent duplication of charges in the dashboard set.
- Update `chargesWithDerivedStatus` mapping to use `paid_at` logic for paid items.

### Frontend (UI/UX)

#### [Financial Dashboard](src/routes/_authenticated/financeiro/index.tsx)

- Update top cards layout:
  - Mobile: 1 per row.
  - Tablet: 2 per row.
  - Desktop: 4 per row.
- Update charts layout:
  - Mobile/Tablet: 1 per row (stacking).
  - Desktop: 2 columns (Bar Chart taking 2/3, Pie Chart 1/3 as currently, or explicit responsive grid).
- Improve table responsiveness:
  - Use `overflow-x-auto` on the table container.
  - Ensure no content is cut (min-widths on columns).
- Verify "Recibo" button visibility for paid charges.

## Technical Details

- In `getFinanceiroStats`, paid charges will be included if `paid_at` falls within `startDate` and `endDate`.
- Unpaid charges (`pendente`/`atrasado`) will be included if `due_date` falls within the period.
- This ensures that if a charge from last month was paid this month, it appears in "this month"'s received revenue.
- Use `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for cards.
- Use `grid-cols-1 lg:grid-cols-3` for charts (with `lg:col-span-2` for the main chart).
