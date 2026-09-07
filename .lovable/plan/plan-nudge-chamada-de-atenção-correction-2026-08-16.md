# Plan - Nudge (Chamada de Atenção) Correction

Fix the nudge (attention call) functionality to ensure reliable delivery, proper recipient resolution (including support/admin), and correct UI feedback across all user states.

## User Review Required

> [!IMPORTANT]
> The nudge functionality will be strictly ephemeral (Broadcast-only) and will no longer be saved to the database messages history.

## Proposed Changes

### Backend & Logic
#### [Surgical Fix] Recipient Resolution
- Create `resolveNudgeTargetUserIds` server function in `src/lib/chat-validation.functions.ts`.
- Implement logic to resolve:
  - Standard participants (Matriz/Filial).
  - Support conversations: Resolve real IDs of all users with `role = 'adm'` (using `supabaseAdmin`).
  - Exclude the sender.
- Ensure only real user UUIDs are returned.

#### [Surgical Fix] Chat Functions
- Remove nudge saving from `sendMessage` in `src/lib/chat.functions.ts`.

### Hooks & Provider
#### [Surgical Fix] Global Listener
- Move the nudge listener to `src/hooks/use-chat-presence.ts` (inside the `presence:global` effect).
- Subscribe the user to their personal nudge channel: `local:widget:nudge:${userId}`.
- Implement `handleIncomingNudge` to:
  - Play `chamando-atencao.mp3`.
  - Open the chat widget (`setIsOpen(true)`).
  - Select the specific conversation.
  - Trigger the shake animation.

### Frontend
#### [Surgical Fix] Send Nudge Implementation
- Update `handleSendAttention` in `src/components/app/chat/GlobalChatWidget.tsx`:
  - Call the new `resolveNudgeTargetUserIds` server function.
  - Send individual broadcasts to each target user's personal channel.
  - Remove `temp:nudge:*` channel usage.
  - Provide immediate local feedback (sound + shake).
  - Remove database message insertion.

#### [Surgical Fix] UI Components
- Update `ChatPanel` and `GlobalChatWidget` to handle global nudge states (pending conversation, animation triggers).

## Technical Details
- **Broadcast Protocol**: Use `supabase.channel("local:widget:nudge:${targetUserId}")` for delivery.
- **Admin Resolution**: Server-side query to `user_roles` using `supabaseAdmin` to bypass RLS when looking for ADMs.
- **State Management**: Use `ChatPresenceContext` to coordinate widget opening and animation across the app.
- **Cooldown**: Preserve the 5-minute cooldown logic per conversation in `localStorage`.

## Verification Plan

### Automated Tests
- `bun run build` and `bunx tsc --noEmit` to ensure type safety.

### Manual Verification
- **Test 1**: Matriz -> Filial (Widget closed). Verify sound, auto-open, and shake.
- **Test 2**: Matriz -> Suporte. Verify all active ADMs receive the nudge.
- **Test 3**: Suporte -> Matriz. Verify delivery to the branch manager.
- **Test 4**: History Check. Confirm no `🫨` message appears in chat history.
- **Test 5**: Cooldown. Confirm 5-minute block is enforced.
