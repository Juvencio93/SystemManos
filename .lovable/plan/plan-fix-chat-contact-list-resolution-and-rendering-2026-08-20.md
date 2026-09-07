# Plan: Fix Chat Contact List Resolution and Rendering

The current chat system incorrectly displays placeholders ("Contato") or empty groups when profiles or companies are missing required fields. This plan refactors the contact resolution logic (server-side) and list rendering (client-side) to ensure only valid, complete contacts are shown, and hierarchical relationships (Matriz/Filial) are correctly identified.

## Technical Details

### 1. Server-Side: `src/lib/chat-validation.functions.ts`
- **Strict `ChatContact` Validation:** Ensure every returned contact in `getChatContacts` has a valid `profileId`, `companyId`, and a non-placeholder `displayName`.
- **Hierarchical Correction for Filial:**
  - Explicitly fetch the Matriz `profileId` using the user's `companyId`.
  - Fetch sister branch profiles correctly by filtering out the current `branchId` and ensuring they belong to the same `companyId`.
- **Support Contact:** Ensure the ADM profile is correctly identified as "Suporte".

### 2. UI: `src/components/app/chat/GlobalChatWidget.tsx`
- **Diagnostic Mode:** Temporarily log `currentProfileId`, `matrixCompanyId`, and `rawContacts` to the console for Filial users to verify data flow.
- **Conditional Group Rendering:**
  - Wrap the "Suporte", "Matriz", and "Filiais" sections in filters that check if any valid contacts exist before rendering the accordion or header.
  - Remove all fallback strings like `"Contato"` or `"UNIDADE"`.
- **Identity Resolution:** Use `profileId` exclusively to identify contacts, preventing the "unidentified contact" issue.

### 3. Server-Side: `src/lib/chat.functions.ts`
- **`getConversations` Refinement:**
  - Ensure the `display_name` resolved for each conversation is based on the `other_profile_id`'s real trade name or profile name.
  - Avoid placeholders in the conversation list summary.

## Validation Steps
1. **Login as Filial:** Verify that "Suporte" and "Matriz" appear with real names.
2. **Verify Sister Branches:** If sister branches exist, they must appear under "Filiais".
3. **Check for Placeholders:** Ensure no "Contato" text or empty expanders are visible.
4. **Full Build & Typecheck:** Run `npm run build` and `tsgo` to ensure no regressions.
