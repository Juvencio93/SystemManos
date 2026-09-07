# Plan: Chat Correction - Empty UUID and Two-Way Nudge

Correct the "invalid input syntax for type uuid: ''" error and ensure nudges (attention calls) work correctly between sender and recipient, including automatic chat opening.

## Proposed Changes

### 1. Server-side Validation
- **`src/lib/chat.functions.ts`**:
    - Add strict UUID validation to `sendMessage` input validator using Zod's `.uuid()`.
    - Improve error logging in `sendMessage` to capture full Supabase error details.

### 2. Client-side Robustness & Bug Fixes
- **`src/components/app/chat/GlobalChatWidget.tsx`**:
    - Implement `isValidUuid` helper.
    - **Fix Empty UUID**: Search and replace any `conversationId || ""` or `""` fallback with strict validation and error handling.
    - **Contact Opening**: Update `selectContact` to wait for `getOrCreateConversation` and validate the returned ID before setting active conversation. Ensure no message is sent automatically on open.
    - **Nudge Refactor**: Implement the mandatory sequence: 1. Validate UUID -> 2. Save "🫨" message -> 3. Broadcast nudge event.
    - **Broadcast Receiver**: Update the broadcast listener to:
        - Check if the current user is a recipient.
        - If recipient: Open the widget (`setChatWidgetOpen(true)`), find/fetch the conversation, set it as active, and trigger the shake/sound effects.
    - **Deduplication**: Use `eventId` and `messageId` to prevent duplicate processing of nudges.

- **`src/routes/_authenticated/mensagens.tsx`**:
    - Apply similar strict UUID validation to `sendMessage` calls.
    - Sync nudge broadcast handling with the GlobalChatWidget logic.

### 3. Presence Logic Refinement
- **`src/components/app/chat/GlobalChatWidget.tsx` & `src/routes/_authenticated/mensagens.tsx`**:
    - Ensure `isContactOnline` correctly maps contact types to the `onlinePresences` state.

## Technical Details
- Using `z.string().uuid()` in Zod schemas.
- Using `crypto.randomUUID()` for `eventId`.
- Enforcing `broadcast.self: true` (already confirmed in `use-chat-presence.ts`).
- Hierarchical recipient filtering for nudges based on `targetRole`, `targetCompanyId`, and `targetBranchId`.

## Validation Plan
1. **Type Check**: Run `bunx tsgo` to ensure no regression in types.
2. **Build**: Run `bun run build` to confirm production readiness.
3. **Manual Verification**:
    - Test opening contacts (Branches, Matrizes, Support) to ensure no UUID errors.
    - Test sending regular messages.
    - Test Nudge from Matriz to Filial and vice versa (verify sound, shake, and auto-open on both ends).
    - Verify no duplicate sounds or messages.
