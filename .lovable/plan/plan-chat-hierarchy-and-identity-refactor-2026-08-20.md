# Plan - Chat Hierarchy and Identity Refactor

Refactor chat contacts, identity resolution, and presence to strictly follow hierarchical rules using `profileId`.

## Hierarchical Rules
- **ADM**: Sees all active Matrizes and their Branches (grouped by hierarchy).
- **Matriz**: Sees Support (ADM) and its own Branches.
- **Filial**: Sees Support (ADM), its own Matriz, and sister Branches.
- **Support**: Visual identity of the ADM profile.

## Technical Details

### 1. Server-side Normalization (`src/lib/chat-validation.functions.ts`)
- Implement `resolveChatContacts(currentProfileId)` to return grouped and validated contacts.
- Use trade names for display, ensuring no "UNIDADE" or "Contato" fallbacks.
- Update `getOrCreateConversation` to accept only `recipientProfileId`.
- Add `parentMatrixCompanyId` to `ChatContact` for grouping.

### 2. Identity Resolution (`src/lib/chat.functions.ts`)
- Update `getConversations` to return `other_profile_id` and resolve trade names based on that ID.
- Ensure all queries use `profileId` as the primary key for participants.

### 3. Presence Logic (`src/hooks/use-chat-presence.ts`)
- Standardize on `presence:global` channel.
- Use `profileId` as the key for all presence tracking and sound triggers.

### 4. UI Consistency (`GlobalChatWidget.tsx` & `mensagens.tsx`)
- Unify contact listing and conversation handling.
- Group branches under Matrizes for ADM view.
- Ensure "Digitando..." and receipts use `profileId`.

## Security
- Use `security definer` logic (via server functions) to enforce RLS-equivalent isolation during contact resolution.
- Prevent cross-matrix visibility for non-ADM roles.
