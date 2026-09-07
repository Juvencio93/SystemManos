# Plan - Surgical Fix: Conversation Deletion and History Management

The goal is to ensure that when a user "deletes" (hides) a conversation, clicking the same contact again creates a **new** conversation instead of reusing the old one and restoring its history.

## Technical Details

### 1. Update `getOrCreateConversation` logic
- Modify the search for existing conversations to only consider conversations where the user's `hidden_at` is `NULL`.
- If multiple candidates exist (which shouldn't happen under normal circumstances, but for safety), prefer the one that is visible.
- If only hidden conversations exist, proceed to create a new one.
- **Strict Constraint:** Remove any code that sets `hidden_at: null` on an existing conversation during this flow.

### 2. Standardize `Support` conversation handling
- Ensure "Support" conversations follow the same logic.
- Avoid reusing hidden "Support" conversations.

### 3. Update `sendMessage` logic
- Remove the global `update({ hidden_at: null })` on `sendMessage`.
- Instead, only clear `hidden_at` for the **recipients** of the message, ensuring the conversation reappears in their lists.
- For the **sender**, `hidden_at` should already be `null` because they are interacting with an active (new or visible) conversation.

### 4. Update Frontend `selectContact`
- Ensure the React state for messages is cleared before switching to a new conversation ID.
- Verify that `refetchConversations` is called to update the list with the new ID.

## Proposed Changes

### Backend (`src/lib/chat-validation.functions.ts`)
- Refactor `getOrCreateConversation`:
  - Fetch user preferences for candidates before deciding.
  - Filter out conversations that are hidden for the current user.
  - Remove the "Reativação" logic.

### Backend (`src/lib/chat.functions.ts`)
- Update `sendMessage`:
  - Modify preference sync to NOT clear `hidden_at` for the current user (`userId`).
  - Only clear `hidden_at` for other participants.

### Frontend (`src/components/app/chat/GlobalChatWidget.tsx`)
- Update `selectContact`:
  - If a new conversation is created, ensure UI state is fresh.

## Validation Plan
1. **Manual Verification:**
   - Open a chat, send messages.
   - Hide the chat.
   - Click the contact again -> confirm a new empty chat opens.
   - Check Supabase `conversations` table to see two distinct IDs.
2. **Automated Checks:**
   - `vite build`
   - `tsgo` (typecheck)
