# Plan: Chat Fixes (Attachment, Presence, Nudge)

This plan corrects the `attachment is not defined` error, implements robust online status detection across different contact types, and fixes the nudge (attention call) flow with detailed error reporting.

## User Review Required

> [!IMPORTANT]
> I have verified that the `event` column exists in the `messages` table. No migrations are needed.

## Proposed Changes

### 1. Fix "attachment is not defined"
- Locate and rename the undeclared `attachment` variable in `GlobalChatWidget.tsx` to `uploadedAttachment`.
- Ensure all references are correctly scoped within handlers.
- Fix the `sendMessage` call signature to use the expected `{ data: { ... } }` structure required by `createServerFn`.

### 2. Robust Online Status
- Update `useChatPresence` to return `onlinePresences` (full objects) instead of just `onlineUserIds`.
- Implement `isContactOnline` logic in `GlobalChatWidget.tsx` to handle hierarchy-based presence:
    - **Support**: Online if any ADM is online.
    - **Matriz**: Online if a user with role `matriz` and matching `companyId` is online.
    - **Filial**: Online if a user with role `filial` and matching `branchId` is online.
- Add temporary debug logs to verify status detection during testing.

### 3. Nudge (Attention Call) Fix
- Update `handleSendAttention` in `GlobalChatWidget.tsx` and `mensagens.tsx` to:
    1. Save the database message first (event: "nudge").
    2. Check for success.
    3. Broadcast the synchronized effect (sound + shake) via Supabase Realtime.
- Improve error handling to display the specific cause of failure instead of a generic message.
- Enforce hierarchy rules for nudge recipients (who hears/sees the shake).

### 4. Technical Validation
- Run `bunx tsgo` to ensure all type errors are resolved.
- Run `bun run build` to confirm production readiness.

## Technical Details

### Presence Mapping
```typescript
function parsePresenceState(state: any) {
  return Object.entries(state).flatMap(([key, entries]: [string, any]) =>
    entries.map((entry: any) => ({
      userId: entry.userId || entry.user_id || key,
      role: entry.role === 'admin' ? 'adm' : entry.role,
      companyId: entry.companyId || entry.company_id,
      branchId: entry.branchId || entry.branch_id
    }))
  );
}
```

### Nudge Flow
- **Initiator**: Clicks button -> `sendMessage` (DB) -> `channel.send` (Broadcast).
- **Receiver**: Broadcast listener -> `playChatSound("attention")` + `shakeChatWidget()`.
- **Deduplication**: Use `eventId` (UUID) to prevent repeated sounds from sync/broadcast loops.
