# Plan - Fix and Hide Conversations

Functional fix for pinning and hiding chat conversations, ensuring individual user preferences without data loss.

## User Review Required

> [!IMPORTANT]
> - The system uses a `conversation_user_preferences` table to store your personal pins and hidden status.
> - "Delete" (Excluir) only hides the conversation from your list; it does not delete messages.
> - If the other person sends a new message, the conversation reappears automatically.

## Proposed Changes

### Database & Security
- **Schema**: Ensure `conversation_user_preferences` has a `PRIMARY KEY (user_id, conversation_id)`.
- **Permissions**: Verify `GRANT` (SELECT, INSERT, UPDATE) for `authenticated` and strict RLS (`auth.uid() = user_id`).
- **Safety**: No `DELETE` commands will be used on core chat tables.

### Backend (Server Functions)
- **togglePinConversation**: Use `upsert` with `onConflict` to update `is_pinned` based on the authenticated session.
- **hideConversation**: Use `upsert` to set `hidden_at` to the current timestamp and reset `is_pinned` to false.
- **getConversations**:
  - Filter out conversations where `hidden_at` is set, UNLESS a new message has arrived after that date.
  - Sort pinned conversations to the top.
- **sendMessage**: When sending a message, clear `hidden_at` for the sender to ensure it stays visible.

### Frontend (UI/UX)
- **Dropdown Menu**: Add/Update "Fixar", "Desafixar", and "Excluir da minha lista" options.
- **Event Handling**: Stop propagation on the menu trigger to prevent opening the conversation accidentally.
- **Sorting**: Implement client-side sorting parity (Pinned > Date).
- **Confirmation**: Show a clear modal explaining that "Excluir" is non-destructive and temporary.
- **Navigation**: If a user clicks a contact that was hidden, clear `hidden_at` to restore it.

## Technical Details
- **Tables**: `public.conversation_user_preferences`
- **Functions**: `src/lib/chat.functions.ts`
- **Components**: `src/routes/_authenticated/mensagens.tsx`, `src/components/app/chat/GlobalChatWidget.tsx`
- **Validation**: Build, Typecheck, and manual verification of `upsert` result.
