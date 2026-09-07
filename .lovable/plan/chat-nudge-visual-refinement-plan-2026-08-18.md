# Chat Nudge Visual Refinement Plan

The goal is to simplify the "Attention Call" (nudge) visual presentation to only show the emoji in a compact bubble, removing all header text like "CHAMADA DE ATENÇÃO" or "🚨 Chamada de atenção".

## User Review Required

> [!IMPORTANT]
> The nudge emoji is currently defaulted to 🥺 if no content is provided. The plan updates the backend to explicitly store 🫨 as the default content for nudges, but the UI will render whatever is in `message.content` (or 🫨 as fallback).

## Proposed Changes

### Backend Logic
- **`src/lib/chat-attention.functions.ts`**: Update the `callContactAttention` server function to explicitly pass `content: "🫨"` when calling `sendMessage`. This ensures the message has the intended emoji stored in the database.
- **`src/lib/chat.functions.ts`**: Update `sendMessage` to avoid auto-capitalizing the content if it's an emoji-only nudge (though emoji doesn't have "case", keeping it clean is better).

### Frontend UI Components
- **`src/components/app/chat/GlobalChatWidget.tsx`**:
    - Update the message renderer for `msg.event === 'nudge'`.
    - Remove the `🚨 Chamada de atenção` / `... chamou sua atenção` header.
    - Render only the `message.content` (using 🫨 as fallback if null).
    - Apply `text-4xl leading-none` styling to the emoji.
    - Ensure the bubble container is compact and only contains the emoji.
- **`src/routes/_authenticated/mensagens.tsx`**:
    - Apply identical changes to the message renderer in the main messages page.

### Hierarchy & Sorting
- **`src/lib/chat.functions.ts`**: Update the conversation list preview text logic to show only the emoji (or a short label like "🫨 Atenção") instead of "😳 Chamou sua atenção".

## Technical Details
- The `messages` table uses an `event` column with the value `'nudge'` to identify these messages.
- The UI currently wraps nudge messages in a `div` with a header span. This will be replaced with a simple span for the emoji.
- Sound and shake effects are already handled by `broadcast` listeners and will not be touched.

## Validation Plan
1. **Send Nudge**: Verify in the UI that only the emoji appears in the chat bubble.
2. **Persistence**: Reload the page and ensure the emoji is still correctly rendered without the header.
3. **Recipient Side**: (Simulated via code) Ensure the broadcast still triggers the sound and shake while the message list updates to show just the emoji.
4. **Conversation List**: Verify the preview text in the sidebar is clean.
