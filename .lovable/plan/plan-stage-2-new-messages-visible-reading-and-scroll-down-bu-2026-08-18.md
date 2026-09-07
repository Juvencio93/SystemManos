# Plan - Stage 2: New Messages, Visible Reading, and Scroll Down Button

Improve chat navigation with a "New Messages" divider, visibility-based read receipts, and smart scrolling.

## User Review Required

> [!IMPORTANT]
> The "New Messages" divider is calculated locally when a conversation opens. It is not persisted in the database as a record; it uses the `read_at` timestamps from receipts to determine where the unread block begins.

## Proposed Changes

### Database & Backend
- No changes required. Using existing `chat_message_receipts` and `messages` infrastructure from Stage 1.

### Shared Logic & Hooks
- Create `src/hooks/use-chat-scroll.ts` to manage:
  - Detecting if the user is near the bottom.
  - Tracking "new messages since last scroll".
  - Handling auto-scroll vs. showing the "scroll down" button.
- Create `src/hooks/use-chat-intersection.ts` to manage:
  - `IntersectionObserver` for marking messages as read only when visible (60% threshold).
  - Batching updates to `updateMessageReceipt`.

### Component: `mensagens.tsx` (Route)
- Implement the "New Messages" divider logic:
  - Find `firstUnreadMessageId` on mount/active conversation change.
  - Inject `<div role="separator">` before that message.
- Integrate `useChatScroll` for the smart scroll button and auto-scrolling logic.
- Integrate `useChatIntersection` for visibility-based receipts.

### Component: `GlobalChatWidget.tsx` (Widget)
- Apply identical logic as above to ensure consistent behavior across both UIs.
- Ensure the floating button is positioned correctly within the widget's restricted space.

## Technical Details

- **Divider Logic**: `const [sessionFirstUnreadId, setSessionFirstUnreadId] = useState<string | null>(null)` - set once per conversation open.
- **IntersectionObserver**: Root will be the scrollable container. Threshold 0.6. Only observe received messages where `receipt.readAt` is null.
- **Batching**: Collect message IDs in a ref, trigger `updateMessageReceipt` after 500ms of inactivity or when reaching 10 IDs.
- **Scroll Button**: Position absolute/sticky at the bottom right of the message list. High z-index but below tooltips/popovers.

## Constrained Checklist & Confidence Score

1. [x] Divider only appears once per session?
2. [x] No premature reading of messages?
3. [x] Auto-scroll only when near bottom?
4. [x] Scroll button shows "N new messages"?
5. [x] Support maps to ADM profile ID?
6. [x] No new migrations/columns?

Confidence Score: 5/5

## Mental Sandbox Simulation

- User opens chat with 5 unread messages.
- `firstUnreadMessageId` is ID #1.
- `useEffect` scrolls to ID #1 (with context).
- Divider is rendered above ID #1.
- User stays at top. IDs #1-2 are visible. `IntersectionObserver` schedules update for #1 and #2.
- 500ms later, server function is called.
- User scrolls down. #3 and #4 become visible. They are marked read.
- New message arrives while user is in middle. `useChatScroll` sees user is NOT at bottom.
- "↓ 1 nova mensagem" button appears. Scroll position stays.
- User clicks button. `scrollIntoView(bottom)`. Button disappears. #5 and #6 become visible and are marked read.
