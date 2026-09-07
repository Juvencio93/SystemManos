# Plan - Form Validation Improvement

Apply strict client-side validation and graceful error handling for company and branch registration forms.

## User Review Required

> [!IMPORTANT]
> This change focuses on `src/routes/_authenticated/empresas.index.tsx` and `src/routes/_authenticated/filiais.tsx`. No other parts of the system will be altered.

## Proposed Changes

### 1. Form Validation Logic

- Implement a `validationErrors` state in both `CompaniesPage` and `BranchesPage`.
- Create a `validateForm` function that checks all mandatory fields before calling mutations.
- Mandatory fields for Company: `name`, `slug`, `access_email`, `access_password` (if new), `business_segment`, `business_description` (30-600 chars), `activated_at`.
- Mandatory fields for Branch: `name`, `portal_slug`, `access_email`, `access_password` (if new).

### 2. UI Highlighting

- Update form inputs to show a red border when an error exists for that field.
- Add error message labels below each field.
- Implement automatic scrolling/focusing on the first field with an error using refs.

### 3. Graceful Error Handling

- Update `saveCompany` and `saveBranch` mutation `onError` handlers to catch specific server errors (like "e-mail já utilizado") and map them back to the field-level validation state instead of showing a generic toast or closing the dialog.
- Ensure the dialog remains open and form state is preserved when these errors occur.

## Technical Details

### Components

- `src/routes/_authenticated/empresas.index.tsx`
- `src/routes/_authenticated/filiais.tsx`

### Logic

- Add `const [errors, setErrors] = useState<Record<string, string>>({})`.
- Check `if (Object.keys(newErrors).length > 0) { setErrors(newErrors); scrollToFirstError(); return; }`.
- Handle "User already exists" or "Database unique constraint" errors from `createServerFn` specifically to show the "Este e-mail já é utilizado..." message.
