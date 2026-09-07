# Plan - Definite Chat Read Receipt Restoration

Correct the regression in conversation reading confirmation. Restore the "Step 1" behavior where opening a conversation directly marks messages as read on the server and updates the UI immediately, while preserving the visual "New messages" divider using a session-based boundary.

## User Review Required
> [!IMPORTANT]
> This change modifies how unread messages are marked as read. Instead of waiting for the user to scroll past them (IntersectionObserver), the system will now confirm all pending messages as read immediately upon opening the conversation, as it did previously. The visual "New messages" divider will still be shown to indicate where the user left off.

## Technical Details

### Server Side (Server Functions)
- **Refactor `markConversationAsRead`** in `src/lib/chat-validation.functions.ts`:
  - Ensure it resolves the real `profileId` of the authenticated user.
  - Query all receipts for the conversation where `recipient_profile_id = profileId`, `read_at IS NULL`, and the message was not sent by the user.
  - Respect `history_cleared_at` if present in `conversation_user_preferences`.
  - Update `delivered_at` (if null) and `read_at` to the current time.
  - Broadcast a `chat:receipt_update` event via Supabase Realtime for each updated message to notify the sender.
  - Return the list of `readMessageIds` and the `remainingUnreadCount`.

### Client Side (Frontend)
- **Shared logic in `GlobalChatWidget.tsx` and `mensagens.tsx`**:
  - Implement a `readRequestKey` using `useRef` to prevent duplicate calls per conversation opening. The key will be `${userId}:${conversationId}:${firstUnreadId}`.
  - When messages load for a selected conversation:
    1. Identify the first unread incoming message.
    2. Set `sessionUnreadBoundary` to that message's ID (this state persists for the session to render the divider).
    3. Call `markConversationAsRead` immediately.
  - Update local state:
    - Update `read_at` for messages in the conversation list.
    - Zero out the unread counter for the specific conversation and update the global total.
  - **IntersectionObserver** (`useChatIntersection.ts`):
    - Keep the observer active only for *newly arriving* messages or when the user scrolls to older, previously unread messages that weren't caught in the initial load (e.g., if there's pagination).

### UI/UX
- The "New messages" divider will use `sessionUnreadBoundary` to decide its position, not the `read_at` field, ensuring it stays visible even after the server confirms reading.
- Red unread counters will disappear immediately upon opening the conversation.
- Senders will see their gray double-checks (`✓✓`) turn turquoise (`✓✓`) as soon as the recipient opens the chat.

## Validation Plan
- [ ] Create a message between two users (e.g., Matriz and Support).
- [ ] Verify the unread counter is `1`.
- [ ] Open the conversation and verify:
  - The "New messages" divider appears.
  - The unread counter vanishes instantly.
  - The server records `read_at`.
  - The sender sees turquoise checkmarks.
- [ ] Close and re-open the conversation; verify the counter doesn't return.
- [ ] Test with multiple unread messages.
- [ ] Verify `build`, `typecheck`, and `lint`.
