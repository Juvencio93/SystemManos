# Chat Audio and Attention Logic Overhaul

Correct and centralize chat audio behavior, broadcast logic for user entries and nudges, and fix message notification rules.

## User-Facing Changes
- **Unified Audio Feedback:** Everyone (including you) hears `online.mp3` when a user enters the platform.
- **Accurate Message Sounds:** Only message recipients hear `mensagem.mp3`. Sending a message no longer plays a sound for the sender.
- **Improved "Attention Call":**
  - Clicking the emoji now sends a persistent "🫨" emoji in the chat.
  - Triggers a synchronized screen shake and `chamando-atencao.mp3` sound for both sender and recipient.
  - Visible image or emoji in chat history.
- **Audio Controls:** Clearer feedback and centralized handling for muted states.

## Technical Details
- **Centralized Audio Handling:** All audio logic moved to `ChatPresenceProvider.tsx` using persistent `useRef` audio objects to prevent repeated resource creation.
- **Supabase Realtime Synchronization:**
  - `presence:global` updated with `broadcast: { self: true }` to allow self-entry sounds.
  - Implementation of `eventId` deduplication to prevent audio loops during presence syncs or re-renders.
  - Targeted nudges using role-based and ID-based filtering in broadcast payloads.
- **Database Consistency:** "Nudge" events now saved as standard messages with `event: 'nudge'` to preserve history.
- **Visual Animation:** CSS-based shake animation added to global styles for consistent behavior.
- **Browser Compatibility:** Implemented a global listener to unlock audio contexts on the first user interaction (pointerdown, etc.).

## Implementation Plan

### 1. Global Styles
- Add `chat-attention-shake` keyframes and class to `src/styles.css`.

### 2. Centralized Audio & Presence (`src/hooks/use-chat-presence.ts`)
- Initialize `Audio` objects once using `useRef`.
- Implement `playChatSound` utility with error handling and deduplication.
- Update Presence configuration to `self: true`.
- Implement `user:online` broadcast on subscription.
- Deduplicate sounds using `eventId`.

### 3. Server Functions (`src/lib/chat.functions.ts`)
- Restore database persistence for "nudge" messages (remove the ephemeral filter).
- Ensure "nudge" messages don't trigger regular "message" sounds.

### 4. UI Layer (`src/components/app/chat/GlobalChatWidget.tsx`)
- Update message rendering to handle `event: 'nudge'` visually (centered image/emoji).
- Consolidate message notification listeners to prevent duplicates.
- Implement `shakeChatWidget` triggered by broadcast events.
- Update `handleSendAttention` to send a real message first, then broadcast the effect.
- Implement UI indicator for muted audio/blocked permissions.
