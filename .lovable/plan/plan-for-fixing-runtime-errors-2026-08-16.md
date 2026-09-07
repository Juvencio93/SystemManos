# Plan for Fixing Runtime Errors

## Objectives
1. Fix infinite recursion in RLS policies for `conversations` and `conversation_participants`.
2. Fix duplication of Supabase Realtime Presence channels causing subscription errors.

## Technical Details

### Error 1: Infinite Recursion in RLS
The policies for `conversations` and `conversation_participants` are cross-referencing each other:
- `conversation_participants` select policy checks `conversations`.
- `conversations` select policy checks `conversation_participants`.

**Solution:**
- Create `SECURITY DEFINER` functions to check membership without triggering RLS recursively.
- `check_conversation_access(conversation_id, user_id)`: Checks if a user is a participant or if their company owns the conversation.
- `check_participant_access(participant_id, user_id)`: Checks if a user has access to a participant.
- Update RLS policies to use these functions.

### Error 2: Presence Channel Duplication
The `useChatPresence` hook creates a new channel instance on every mount. Since it's used in `AppShell` (global) and `GlobalChatWidget` (global), multiple subscriptions to the same topic are created.

**Solution:**
- Implement a singleton pattern or a shared state for the presence channel.
- Update `useChatPresence` to reuse an existing channel if it already exists for the given `companyId`.
- Ensure all `.on('presence', ...)` handlers are registered before `.subscribe()`.
- Use a reference counter to only remove the channel when all components using it unmount.

## Implementation Steps

### Database (RLS Fix)
1. Create a migration with:
   - `public.is_conversation_participant(_conversation_id uuid, _user_id uuid)` (SECURITY DEFINER)
   - `public.can_access_conversation(_conversation_id uuid, _user_id uuid)` (SECURITY DEFINER)
   - Update `conversations` policies.
   - Update `conversation_participants` policies.

### Frontend (Presence Fix)
1. Modify `src/hooks/use-chat-presence.ts`:
   - Create a global `Map` to track active channels and their consumer counts.
   - Refactor the `useEffect` to check the map before creating a new channel.
   - Properly handle `.on()` calls before `.subscribe()`.
   - Implement reference counting in the cleanup function.

## Verification Plan
1. Run `build:dev` to check for syntax/type errors.
2. Use a Playwright script to:
   - Verify dashboard loads without errors.
   - Check console for RLS recursion or Presence duplication errors.
   - Verify chat widget presence.
3. Manual verification of chat functionality (reading/sending messages).
