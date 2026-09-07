# Plan: Migrate Messages to a Global Floating Chat Widget

Transition the internal messaging system from a dedicated page to a global floating widget accessible via a fixed button, similar to the AI Operational Manager.

## User Interface Changes

### 1. Sidebar Navigation
- Remove "Mensagens" from the `NAV` array in `src/components/app/app-shell.tsx`.

### 2. Global Floating Widget
- Implement a `FloatingChatWidget` component to be rendered in `src/routes/_authenticated/route.tsx`.
- The widget will feature a fixed circular button in the bottom-right corner.
- **Visuals:** Uses the `MessagesSquare` icon (lucide-react), consistent size and shadow with the existing AI robot mascot button.
- **Unread Badge:** Display a red numerical badge on the button if there are unread messages.
- **Placement Logic:** If `role === 'adm'`, both the AI robot and the Messages button will appear side-by-side with a 16px gap.

### 3. Chat Panel (Overlay)
- Instead of navigating to `/mensagens`, clicking the button will open a `Sheet` or popover overlay.
- Re-use the existing chat logic (fetching conversations, sending messages, presence, nudges) from the current `MensagensPage` within this overlay.
- Maintain the dual-panel layout (conversation list + active chat) within the overlay's constrained dimensions.

## Technical Details

- **Component Refactoring:** Extract the core logic of `src/routes/_authenticated/mensagens.tsx` into a reusable `ChatPanel` component.
- **Global Rendering:** Mount the `FloatingChatWidget` inside the `AppShell` or `_authenticated` route to ensure it's visible across all authenticated pages.
- **Unread Counting:** Add logic to `getConversations` or a separate helper to count messages since `last_read_at` (if implemented) or use total counts to detect new activity.
- **Styling:** Use Tailwind CSS for fixed positioning (`bottom-6 right-6`), z-index management, and responsive side-by-side layout for Admins.

## Validation Plan
- Verify build success (type and lint checks).
- Manually test on preview:
  - Confirm "Mensagens" is gone from the sidebar.
  - Check visibility and positioning of the floating button on multiple routes (Dashboard, CRM, etc.).
  - Verify side-by-side positioning for Admin users.
  - Confirm clicking the button opens the chat overlay without page navigation.
  - Verify real-time messages and unread badges.
