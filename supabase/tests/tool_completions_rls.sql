-- Run via scripts/verify-tool-completion-rls.sh against disposable Postgres.
CREATE FUNCTION pg_temp.assert_true(ok BOOLEAN, label TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'PASS: %', label;
END;
$$;

CREATE FUNCTION pg_temp.expect_error(statement TEXT, expected_state TEXT, label TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN
      RAISE NOTICE 'PASS: %', label;
      RETURN;
    END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'FAIL: % (statement unexpectedly succeeded)', label;
END;
$$;

INSERT INTO auth.users (id, is_anonymous, created_at) VALUES
  ('11111111-1111-4111-8111-111111111111', FALSE, NOW()),
  ('22222222-2222-4222-8222-222222222222', FALSE, NOW()),
  ('33333333-3333-4333-8333-333333333333', TRUE, NOW()),
  ('44444444-4444-4444-8444-444444444444', TRUE, NOW() - INTERVAL '60 days'),
  ('55555555-5555-4555-8555-555555555555', TRUE, NOW() - INTERVAL '60 days');
INSERT INTO public.anonymous_sessions (session_id, last_active_at) VALUES
  ('completion-legacy-a', NOW() - INTERVAL '60 days'),
  ('completion-legacy-b', NOW());

SELECT pg_temp.assert_true(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.tool_completions'::regclass),
  'completion table has RLS enabled');
SELECT pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.tool_completions', 'SELECT,INSERT,DELETE')
  AND NOT has_table_privilege('authenticated', 'public.tool_completions', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.tool_completions', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.tool_completions', 'INSERT'),
  'table grants are least privilege');
SELECT pg_temp.assert_true(
  NOT has_function_privilege('authenticated', 'public.delete_owned_data(uuid,text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.merge_anonymous_user_data(uuid,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.migrate_legacy_anonymous_data(text,uuid)', 'EXECUTE'),
  'privileged lifecycle RPCs remain inaccessible to clients');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', FALSE);
INSERT INTO public.tool_completions (id, user_id, kind, item_id, started_at, completed_at, source_step_id)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', auth.uid(), 'grounding', 'five-senses', NOW() - INTERVAL '3 minutes', NOW(), 'step-1');
INSERT INTO public.tool_completions (id, user_id, kind, item_id, started_at, completed_at)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', auth.uid(), 'meditation', 'changed-retry', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
SELECT pg_temp.assert_true(
  (SELECT COUNT(*) = 1 AND MIN(item_id) = 'five-senses' FROM public.tool_completions),
  'same ID retry is idempotent and cannot mutate recorded completion');
SELECT pg_temp.expect_error($sql$
  UPDATE public.tool_completions SET user_id = '22222222-2222-4222-8222-222222222222'
$sql$, '42501', 'clients cannot update or transfer rows');
SELECT pg_temp.expect_error($sql$
  INSERT INTO public.tool_completions (id, user_id, kind, item_id, started_at, completed_at)
  VALUES (gen_random_uuid(), '22222222-2222-4222-8222-222222222222', 'yoga', 'chair', NOW(), NOW())
$sql$, '42501', 'cannot insert for another owner');
SELECT pg_temp.expect_error($sql$
  INSERT INTO public.tool_completions (id, session_id, kind, item_id, started_at, completed_at)
  VALUES (gen_random_uuid(), 'completion-legacy-a', 'yoga', 'chair', NOW(), NOW())
$sql$, '42501', 'a supplied legacy session does not establish client ownership');
SELECT pg_temp.expect_error($sql$
  INSERT INTO public.tool_completions (id, user_id, kind, item_id, started_at, completed_at)
  VALUES (gen_random_uuid(), auth.uid(), 'unknown', 'chair', NOW(), NOW())
$sql$, '23514', 'unknown completion kind is rejected');
SELECT pg_temp.expect_error($sql$
  INSERT INTO public.tool_completions (id, user_id, kind, item_id, started_at, completed_at)
  VALUES (gen_random_uuid(), auth.uid(), 'yoga', repeat('x', 181), NOW(), NOW())
$sql$, '23514', 'item identifiers are bounded');
SELECT pg_temp.expect_error($sql$
  INSERT INTO public.tool_completions (id, user_id, kind, item_id, started_at, completed_at, source_step_id)
  VALUES (gen_random_uuid(), auth.uid(), 'yoga', 'chair', NOW(), NOW(), repeat('x', 257))
$sql$, '23514', 'source step identifiers are bounded');
SELECT pg_temp.expect_error($sql$
  INSERT INTO public.tool_completions (id, user_id, kind, item_id, started_at, completed_at)
  VALUES (gen_random_uuid(), auth.uid(), 'yoga', 'chair', NOW(), NOW() - INTERVAL '1 second')
$sql$, '23514', 'completion cannot precede its start');

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', FALSE);
SELECT pg_temp.assert_true((SELECT COUNT(*) = 0 FROM public.tool_completions), 'another owner cannot read rows');
DELETE FROM public.tool_completions WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
-- A conflict may be ignored, but must never replace the hidden owner's data.
INSERT INTO public.tool_completions (id, user_id, kind, item_id, started_at, completed_at)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', auth.uid(), 'yoga', 'collision', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tool_completions (id, user_id, kind, item_id, started_at, completed_at)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', auth.uid(), 'meditation', 'gentle-breath-reset', NOW(), NOW());
SELECT pg_temp.assert_true((SELECT COUNT(*) = 1 FROM public.tool_completions), 'cross-owner duplicate creates no visible foreign row');
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', FALSE);
SELECT pg_temp.assert_true(
  (SELECT COUNT(*) = 1 AND MIN(item_id) = 'five-senses' FROM public.tool_completions),
  'cross-owner delete and duplicate ID cannot change the original');

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', FALSE);
SELECT set_config('request.jwt.claim.is_anonymous', 'true', FALSE);
INSERT INTO public.tool_completions (id, user_id, kind, item_id, started_at, completed_at, partial)
VALUES ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', auth.uid(), 'focus', 'focus-session', NOW(), NOW(), TRUE);
SELECT pg_temp.assert_true((SELECT COUNT(*) = 1 AND bool_and(partial) FROM public.tool_completions), 'anonymous Auth owner can write and read only own completion');
SELECT set_config('request.jwt.claim.sub', '', FALSE);
SELECT pg_temp.assert_true((SELECT COUNT(*) = 0 FROM public.tool_completions), 'missing auth identity cannot read data');

RESET ROLE;
SET ROLE anon;
SELECT pg_temp.expect_error('SELECT * FROM public.tool_completions', '42501', 'unauthenticated role cannot read completion data');
SELECT pg_temp.expect_error($sql$
  INSERT INTO public.tool_completions (id, session_id, kind, item_id, started_at, completed_at)
  VALUES (gen_random_uuid(), 'completion-legacy-a', 'yoga', 'chair', NOW(), NOW())
$sql$, '42501', 'unauthenticated role cannot insert guessed-session rows');
RESET ROLE;

SET ROLE service_role;
INSERT INTO public.tool_completions (id, session_id, kind, item_id, started_at, completed_at)
VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', 'completion-legacy-a', 'journal', 'daily-note', NOW(), NOW()),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6', 'completion-legacy-b', 'reflection', 'reflection-1', NOW(), NOW());
SELECT pg_temp.expect_error($sql$
  INSERT INTO public.tool_completions (id, user_id, session_id, kind, item_id, started_at, completed_at)
  VALUES (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'completion-legacy-a', 'yoga', 'chair', NOW(), NOW())
$sql$, '23514', 'service-created rows also require exactly one owner');
SELECT pg_temp.expect_error($sql$
  INSERT INTO public.tool_completions (id, kind, item_id, started_at, completed_at)
  VALUES (gen_random_uuid(), 'yoga', 'chair', NOW(), NOW())
$sql$, '23514', 'ownerless rows are rejected');
SELECT public.merge_anonymous_user_data('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222');
SELECT pg_temp.assert_true(
  (SELECT user_id = '22222222-2222-4222-8222-222222222222' FROM public.tool_completions WHERE id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'),
  'anonymous account merge moves completion history');
SELECT public.migrate_legacy_anonymous_data('completion-legacy-a', '11111111-1111-4111-8111-111111111111');
SELECT pg_temp.assert_true(
  (SELECT user_id = '11111111-1111-4111-8111-111111111111' AND session_id IS NULL FROM public.tool_completions WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'),
  'legacy migration preserves completion history before removing session');
SELECT public.delete_owned_data(NULL, 'completion-legacy-b');
SELECT pg_temp.assert_true(
  NOT EXISTS (SELECT 1 FROM public.tool_completions WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6'),
  'legacy full data deletion removes completion rows');
SELECT public.delete_owned_data('11111111-1111-4111-8111-111111111111', NULL);
SELECT pg_temp.assert_true(
  NOT EXISTS (SELECT 1 FROM public.tool_completions WHERE user_id = '11111111-1111-4111-8111-111111111111')
  AND (SELECT COUNT(*) = 2 FROM public.tool_completions WHERE user_id = '22222222-2222-4222-8222-222222222222'),
  'full user data deletion preserves other owners');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', FALSE);
DELETE FROM public.tool_completions WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
SELECT pg_temp.assert_true((SELECT COUNT(*) = 1 FROM public.tool_completions), 'owner can delete own completion');
RESET ROLE;
DELETE FROM auth.users WHERE id = '22222222-2222-4222-8222-222222222222';
SELECT pg_temp.assert_true((SELECT COUNT(*) = 0 FROM public.tool_completions), 'account deletion cascades through all completion history');

INSERT INTO public.tool_completions (id, user_id, kind, item_id, started_at, completed_at)
VALUES ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', '44444444-4444-4444-8444-444444444444', 'game', 'attention', NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days');
SELECT public.reap_stale_anonymous_users(30, FALSE);
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM auth.users WHERE id = '44444444-4444-4444-8444-444444444444')
  AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '55555555-5555-4555-8555-555555555555'),
  'stale anonymous completion owner is retained while empty account is reaped');
