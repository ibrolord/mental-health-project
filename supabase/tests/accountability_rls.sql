\set ON_ERROR_STOP on

-- Run after the project migrations against a disposable local Supabase database.
-- Three permanent identities prove participant visibility, outsider isolation,
-- owner-only mutation, explicit note sharing, and immediate revocation.
INSERT INTO auth.users(id, email, is_anonymous, email_confirmed_at) VALUES
  ('00000000-0000-4000-8000-00000000000a', 'together-a@example.com', false, NOW()),
  ('00000000-0000-4000-8000-00000000000b', 'together-b@example.com', false, NOW()),
  ('00000000-0000-4000-8000-00000000000c', 'together-c@example.com', false, NOW());

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","is_anonymous":false}', false);
SELECT public.create_accountability_invite('together-b@example.com') AS invite \gset
SELECT :'invite'::jsonb->>'connectionId' AS connection_id,
       :'invite'::jsonb->>'inviteToken' AS invite_token \gset

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","is_anonymous":false}', false);
SELECT public.accept_accountability_invite(:'invite_token');
SELECT public.create_accountability_commitment(
  :'connection_id', 'Walk after lunch', 'daily', 'Private start', false
) AS b_commitment \gset

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","is_anonymous":false}', false);
SELECT public.create_accountability_commitment(
  :'connection_id', 'Read ten pages', 'daily', 'Share this note', true
) AS a_commitment \gset
SELECT public.create_accountability_check_in(:'a_commitment', CURRENT_DATE, 'Shared check-in', true);
SELECT public.update_accountability_scope(:'connection_id', true, true, true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.accountability_commitments) <> 2 THEN
    RAISE EXCEPTION 'A should see both shared commitments';
  END IF;
  IF (SELECT count(*) FROM public.accountability_commitment_notes) <> 1 THEN
    RAISE EXCEPTION 'A should see only their own explicitly shared commitment note';
  END IF;
  IF (SELECT count(*) FROM public.accountability_check_in_notes) <> 1 THEN
    RAISE EXCEPTION 'A should see their own check-in note';
  END IF;
END;
$$;

SELECT public.send_accountability_nudge(:'connection_id', :'b_commitment', 'encouragement');
SELECT public.create_accountability_comment(:'b_commitment', 'A-authored comment') AS a_comment \gset

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","is_anonymous":false}', false);
SELECT set_config('test.a_commitment', :'a_commitment', false);
DO $$
DECLARE changed INTEGER;
BEGIN
  BEGIN
    UPDATE public.accountability_commitments SET title = 'Partner tampered'
      WHERE id = current_setting('test.a_commitment')::UUID;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 0 THEN
      RAISE EXCEPTION 'Partner updated another owner commitment';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  IF (SELECT count(*) FROM public.accountability_commitment_notes) <> 2 THEN
    RAISE EXCEPTION 'B should see their private note and A explicitly shared note';
  END IF;
  IF (SELECT count(*) FROM public.accountability_check_in_notes) <> 1 THEN
    RAISE EXCEPTION 'B should see A explicitly shared check-in note';
  END IF;
END;
$$;
SELECT public.send_accountability_nudge(:'connection_id', :'a_commitment', 'celebrate_progress');

-- Progress sharing is independent from title sharing. B must not see A's
-- commitment row, but can still receive A's distinct check-in date through the
-- security-definer aggregate.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","is_anonymous":false}', false);
SELECT public.update_accountability_scope(:'connection_id', true, false, true);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","is_anonymous":false}', false);
SELECT set_config('test.connection_id', :'connection_id', false);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.accountability_commitments
      WHERE id = current_setting('test.a_commitment')::UUID) THEN
    RAISE EXCEPTION 'A commitment title remained visible after title sharing was disabled';
  END IF;
  IF (SELECT count(*) FROM public.get_accountability_check_in_dates(
      current_setting('test.connection_id')::UUID, CURRENT_DATE - 13, CURRENT_DATE)) <> 1 THEN
    RAISE EXCEPTION 'Shared progress disappeared when commitment titles were private';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","is_anonymous":false}', false);
SELECT public.update_accountability_scope(:'connection_id', true, true, true);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","is_anonymous":false}', false);
SELECT public.set_accountability_commitment_note_sharing(:'a_commitment', false);
SELECT public.set_accountability_check_in_note_sharing(
  (SELECT id FROM public.accountability_check_ins WHERE commitment_id = :'a_commitment'), false
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","is_anonymous":false}', false);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.accountability_commitment_notes
      WHERE commitment_id = current_setting('test.a_commitment')::UUID) THEN
    RAISE EXCEPTION 'Individually revoked commitment note remained visible';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_check_in_notes cin
      JOIN public.accountability_check_ins ci ON ci.id = cin.check_in_id
      WHERE ci.commitment_id = current_setting('test.a_commitment')::UUID) THEN
    RAISE EXCEPTION 'Individually revoked check-in note remained visible';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","is_anonymous":false}', false);
SELECT public.archive_accountability_commitment(:'a_commitment');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","is_anonymous":false}', false);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.accountability_commitments WHERE id = current_setting('test.a_commitment')::UUID) THEN
    RAISE EXCEPTION 'Archived commitment remained visible to the partner';
  END IF;
  IF (SELECT count(*) FROM public.accountability_commitments
      WHERE owner_id = current_setting('request.jwt.claim.sub')::UUID) <> 1 THEN
    RAISE EXCEPTION 'Partner lost their own commitment after counterpart archive';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000c', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","is_anonymous":false}', false);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.accountability_connections) <> 0 THEN
    RAISE EXCEPTION 'C saw a connection';
  END IF;
  IF (SELECT count(*) FROM public.accountability_commitments) <> 0 THEN
    RAISE EXCEPTION 'C saw commitments';
  END IF;
  IF (SELECT count(*) FROM public.accountability_comments) <> 0 THEN
    RAISE EXCEPTION 'C saw comments';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","is_anonymous":false}', false);
SELECT public.end_accountability_connection(:'connection_id', 'revoke');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', false);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","is_anonymous":false}', false);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.accountability_commitments
      WHERE owner_id <> current_setting('request.jwt.claim.sub')::UUID) <> 0 THEN
    RAISE EXCEPTION 'Revoked partner retained counterpart commitment access';
  END IF;
  IF (SELECT count(*) FROM public.accountability_commitments
      WHERE owner_id = current_setting('request.jwt.claim.sub')::UUID) <> 1 THEN
    RAISE EXCEPTION 'User lost their own commitment history after revocation';
  END IF;
END;
$$;

RESET ROLE;

-- Account deletion removes only A-authored Together data. B's authored
-- commitment remains attached to B even after A's auth row is removed.
SELECT public.delete_owned_data('00000000-0000-4000-8000-00000000000a', NULL);
DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-00000000000a';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.accountability_commitments
      WHERE owner_id = '00000000-0000-4000-8000-00000000000b') <> 1 THEN
    RAISE EXCEPTION 'Deleting A erased B-authored commitment history';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_commitments
      WHERE owner_id = '00000000-0000-4000-8000-00000000000a') THEN
    RAISE EXCEPTION 'Deleting A retained A-authored commitments';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_comments
      WHERE author_id = '00000000-0000-4000-8000-00000000000a') THEN
    RAISE EXCEPTION 'Deleting A retained A-authored comments';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_nudges
      WHERE sender_id = '00000000-0000-4000-8000-00000000000a'
         OR recipient_id = '00000000-0000-4000-8000-00000000000a') THEN
    RAISE EXCEPTION 'Deleting A retained nudges tied to A';
  END IF;
END;
$$;
