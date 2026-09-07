# Plan - Fix Chat Conversation Persistence

The goal is to fix a bug where new chat conversations don't appear in the "Active Conversations" list until a user preference entry is created. This is caused by an `!inner` join in the `getConversations` server function.

## Proposed Changes

### 1. Refactor `getConversations` (`src/lib/chat.functions.ts`)
- Remove the `conversation_user_preferences!inner` join from the main query.
- Remove the `.eq("conversation_user_preferences.user_id", userId)` filter.
- Split the data fetching into two steps:
    - Step 1: Fetch all conversations where the user is a participant (via RLS).
    - Step 2: Fetch user preferences for the resulting conversation IDs.
- Merge the preferences in memory, providing defaults (`isPinned: false`, `hiddenAt: null`) for missing entries.

### 2. Update `getOrCreateConversation` (`src/lib/chat-validation.functions.ts`)
- Keep the preference creation (upsert) as a fallback but ensure it's not a requirement for visibility.
- Verify `prefErr` and log if it fails, but don't fail the whole operation.
- Use `upsert` with explicit `onConflict` if the constraint is confirmed (or stick to a safe update/insert logic).

### 3. Update `selectContact` (`src/components/app/chat/GlobalChatWidget.tsx`)
- Ensure it uses the fresh data from `refetchConversations()` to find and open the newly created conversation.

### 4. Database Review
- Confirm RLS policies on `conversation_user_preferences` and `conversations`. (Done in analysis: RLS is correct).
- Check if `conversation_user_preferences` has a proper PK/Unique constraint. (I will attempt one more check or assume fallback).

## Technical Details
- **Hierarchy Awareness**: `getConversations` already has logic to filter by `company_id` for non-ADM users, preserving unit isolation.
- **Timezone**: All date operations will continue to respect the project's timezone requirements where applicable.

## Validation Plan
1. **Manual Test**: Click a contact (e.g., "Boteco do Barão") and verify the conversation opens instantly.
2. **List Verification**: Confirm the new conversation appears in the "Active Conversations" list immediately.
3. **Persistence Test**: Reload the page and verify the conversation is still there.
4. **Build & Typecheck**: Run `bun run build` and `bunx tsc --noEmit`.
