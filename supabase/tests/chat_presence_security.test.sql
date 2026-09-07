BEGIN;
SET LOCAL search_path = public, extensions;

SELECT plan(8);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_user_presence'
      AND cmd = 'SELECT'
      AND qual = 'true'
  ),
  'presence has no blanket authenticated SELECT policy'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_user_presence'
      AND policyname = 'Users can view authorized presences'
  ),
  'presence uses the authorized relationship policy'
);

SELECT has_function('private', 'can_view_chat_presence', ARRAY['uuid'],
  'private presence authorization helper exists');

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.process_operational_alert(uuid,uuid,text,text,text,jsonb,text,text)',
    'EXECUTE'
  ),
  'signed-in users cannot execute the operational alert job directly'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated', 'public.update_conversation_last_message()', 'EXECUTE'
  ),
  'signed-in users cannot execute the conversation trigger directly'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.reset_daily_ai_usage()', 'EXECUTE'),
  'signed-in users retain access to the non-privileged reset wrapper'
);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('a4000000-0000-0000-0000-000000000001', 'presence-viewer@example.invalid', '{}'::jsonb),
  ('a4000000-0000-0000-0000-000000000002', 'presence-outsider@example.invalid', '{}'::jsonb);

INSERT INTO public.chat_user_presence (user_id)
VALUES
  ('a4000000-0000-0000-0000-000000000001'),
  ('a4000000-0000-0000-0000-000000000002');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a4000000-0000-0000-0000-000000000001';
SET LOCAL request.jwt.claim.role = 'authenticated';

SELECT is(
  (SELECT count(*)::integer FROM public.chat_user_presence
    WHERE user_id = 'a4000000-0000-0000-0000-000000000001'),
  1,
  'a signed-in user can view their own presence'
);

SELECT is(
  (SELECT count(*)::integer FROM public.chat_user_presence
    WHERE user_id = 'a4000000-0000-0000-0000-000000000002'),
  0,
  'an unrelated signed-in user presence is hidden'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
