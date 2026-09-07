# Plan: Fix Chat Contact List for Branches

Improve the contact list in the chat module when a user is logged in as a "Branch" (Filial). Currently, it only shows "Support". It must also show the Matriz (Headquarters) and sister Branches of the same Matriz, resolving their real profile IDs and display names.

## User Review Required

> [!IMPORTANT]
> This fix ensures that Branches can communicate with their parent Matriz and other units within the same company.

- Do you have specific branches or a company ID that I should use for manual testing in the preview, or should I rely on the existing hierarchy in the database?

## Proposed Changes

### Backend (Server Functions)

#### `src/lib/chat-validation.functions.ts`
- Modify `getChatContacts` to properly resolve the Matriz and sister Branches when the user role is `filial`.
- Ensure it uses the existing `company_id` hierarchy.
- Fetch real `profile_id`s from `user_roles` for all contacts to ensure `getOrCreateConversation` works correctly.
- Return a list that includes:
  1. Suporte (ADM)
  2. Matriz (Real profile of the company)
  3. Sister Branches (Active units of the same company, excluding self)

#### `src/lib/chat.functions.ts`
- Ensure `getConversations` correctly identifies the "other" profile name when the conversation is with a Matriz or another Branch.
- Improve naming resolution to use `trade_name` or `name` of the company/branch.

### Frontend (UI)

#### `src/routes/_authenticated/mensagens.tsx`
- Ensure the sidebar and header display names are resolved correctly using the new enriched contact data.
- Verify the "Matriz" and "Filial" labels are applied correctly.

## Verification Plan

### Automated Tests
- Run `npm run build` to ensure no regressions in type safety.
- Run `lovable-exec lint` to check for code style issues.

### Manual Verification
1. Log in as a Branch user.
2. Open the chat.
3. Verify "Suporte" is visible.
4. Verify the "Matriz" (Headquarters) is visible with its real name.
5. Verify "Filiais" (Sister branches) are visible if they exist.
6. Click on each contact and verify the conversation opens correctly.
7. Send a message to Matriz and verify it persists and identifies correctly after reload.
8. Verify that the "other profile" is correctly identified for online status synchronization.
