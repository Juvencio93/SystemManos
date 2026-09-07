# Plan - Definitively Fix Chat Read Status on Conversation Open

Correct the regression where unread counts remained until the IntersectionObserver triggered. This plan implements direct reading confirmation upon opening a conversation, ensures consistent visual unread dividers, and optimizes for performance by avoiding redundant server calls.

## User Review Required

> [!IMPORTANT]
> This fix restores the "Step 1" direct read logic for the initial conversation opening while keeping the "Step 2" unread divider and IntersectionObserver for subsequent messages.

- Does the proposed "Novas mensagens" divider behavior (persisting for the session) meet your expectations?
- Is the 5-day observation rule still relevant for all operations, or should it be adjusted for specific profiles? (Assumed to stay as is unless noted).

## Proposed Changes

### Logic & Performance
- **Direct Confirmation:** Restore direct call to `markConversationAsRead` when a conversation is opened, instead of waiting for scroll/visibility events.
- **Redundancy Protection:** Implement `readRequestKey` logic using `useRef` to prevent multiple read calls for the same state (e.g., during re-renders or realtime updates).
- **Session Boundary:** Use `sessionUnreadBoundary` to freeze the "Novas mensagens" divider at the initial unread message when the conversation was opened, even after the server confirms they are read.

### Server-Side (src/lib/chat-validation.functions.ts)
- Refine `markConversationAsRead` to be more deterministic:
    - Verify participation and `history_cleared_at`.
    - Update all eligible receipts (`recipient_profile_id = currentProfileId`, `read_at IS NULL`, `sender_id != userId`).
    - Return precise metadata: `readMessageIds`, `readAt`, and `remainingUnreadCount: 0` (since we read all in that conversation).
    - Add server-side logging for non-updates to assist debugging.

### Frontend - UI Updates (src/routes/_authenticated/mensagens.tsx & src/components/app/chat/GlobalChatWidget.tsx)
- **State Integration:**
    - Initialize `sessionUnreadBoundary` when `activeConversationId` changes.
    - Check `readRequestKey` before calling `markConversationAsRead`.
- **UI Logic:**
    - Use `sessionUnreadBoundary` to render the "Novas mensagens" divider.
    - Immediately clear red unread counters and update message icons locally upon server success.
    - Ensure `IntersectionObserver` in `useChatIntersection` still handles *new* messages arriving while the conversation is already open.

### Verification Plan
- **Manual Validation:**
    1. Create unread message -> verify red badge (1).
    2. Open conversation -> verify divider appears AND badge clears immediately.
    3. Check DB -> verify `read_at` is set.
    4. Check sender -> verify cyan checkmarks (✓✓).
- **Edge Cases:**
    - Multiple unread messages.
    - Switch between Widget and /mensagens page.
    - ADM (Support) vs Matriz/Filial identification.
- **System Integrity:** Run `npm run build`, typecheck, and lint.
