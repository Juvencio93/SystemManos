---
title: Chat Delivery and Experience Corrections
description: Fixes for real-time message delivery, sound, automatic scrolling, read status tracking, and emoji sizing in the chat system.
---

## Technical Details

### Real-time & Sound
- **Server Side**: Update `sendMessage` in `src/lib/chat.functions.ts` to trigger a broadcast event (`chat:message`) to all relevant participants (excluding the sender) after a message is saved.
- **Client Side**: 
  - Centralize message broadcast handling in `src/hooks/use-chat-presence.ts`. It will now listen for `chat:message` on the user's personal channel, play `mensagem.mp3`, and manage event deduplication.
  - Refactor `GlobalChatWidget` and `mensagens.tsx` to remove their own message listeners and rely on the centralized presence hook for sound and cache invalidation.

### Automatic Scrolling
- **Implementation**: Add a hidden `div` with a ref at the bottom of message lists in both `GlobalChatWidget.tsx` and `mensagens.tsx`.
- **Logic**: Use `useLayoutEffect` to scroll this ref into view whenever the active conversation changes or new messages are added to the current view.

### Read Status Tracking
- **Schema**: Utilize the existing `read_at` column in the `messages` table.
- **Function**: Implement `markConversationAsRead` server function to update `read_at` for all messages in a conversation where the current user is a recipient.
- **Trigger**: Call this function whenever a conversation is opened or when a new message arrives in a conversation that is already active and visible.
- **UI**: Update unread indicators (`!`) to correctly reflect messages that have `read_at IS NULL` and were sent by someone else.

### UI Refinements
- **Emoji Size**: Adjust CSS classes to limit the visual size of emojis.
  - Chat messages: max 32px for emoji-only content.
  - Chat trigger button: max 22px for the emoji icon.
- **Hierarchy Awareness**: Ensure message broadcasts target all ADMs when a Matriz/Filial user messages "Support".

### Validation Plan
- Multi-session test: Verify ADM and Matriz can exchange messages with sound and auto-scroll working for both.
- Visibility check: Confirm the `!` badge disappears instantly when opening an unread conversation.
- Regression: Ensure Nudges still work correctly (sound, shake, no history) and don't trigger normal message logic.
