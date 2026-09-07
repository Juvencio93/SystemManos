# Plan - Fix Visitor Return Identification and CRM Inconsistency

Correcting the logic for identifying returning visitors and ensuring data consistency across CRM, History, and Marketing Dashboards, specifically for Gabriel Loren Juvêncio.

## Proposed Changes

### CRM and History Logic
- **`src/lib/crm.functions.ts`**:
    - Remove `company_id` filter when querying connections for the visitor history. This ensures that even if a visitor moved between branches or was registered under different metadata but shared the same `visitor_id`, their full connection history is visible.
    - Standardize the `VisitorHistorySummary` calculation to use the full count of connections returned by the query.

- **`src/lib/portal.server.ts`**:
    - Update `registerLead` to determine `is_returning` based on the visitor's global `connections_count` for the company, rather than checking only the specific branch/event.
    - Ensure `connections_count` increments correctly across the whole company scope.

### UI Enhancements
- **`src/components/app/crm/VisitorHistoryModal.tsx`**:
    - Add a "Visitante recorrente" (Recurrent Visitor) card to the summary.
    - Display "Sim" if `totalAcessos > 1`, along with the count of returns (e.g., "2 retornos").
    - Ensure the timeline displays all connection records correctly.
    - Update `SummaryCard` to support string values for labels like "Sim/Não".

### Data Consistency
- **`src/lib/insights.server.ts`**:
    - Verify that `visitantesHoje` correctly reflects total connections for the day, aligned with CRM reporting.

## Technical Details
- The source of truth for all modules (CRM, History, Dashboard) is now unified under the same connection counting logic.
- `visitor_id` is the primary key for identifying the person, and `connections` table is the source for all access events.
- Added explicit derived fields for "Recurrent Visitor" status in the UI to match the user's requirements.

## Validation Plan
- Inspect `VisitorHistoryModal` to ensure the new "Visitante recorrente" card appears and shows "Sim" for visitors with >1 access.
- Verify the timeline displays multiple entries for visitors like Gabriel Loren Juvêncio.
- Check that the total count in the CRM table matches the sum of entries in the history.
