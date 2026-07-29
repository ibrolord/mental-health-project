-- Let a browser carry its own push channel across an identity change without
-- allowing an endpoint-only claim of another user's subscription.
CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth_key TEXT,
  p_user_agent TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_existing public.push_subscriptions%ROWTYPE;
  v_subscription_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required'
      USING ERRCODE = '42501';
  END IF;

  IF p_endpoint IS NULL
     OR char_length(p_endpoint) NOT BETWEEN 1 AND 2_000
     OR p_p256dh IS NULL
     OR char_length(p_p256dh) NOT BETWEEN 1 AND 500
     OR p_auth_key IS NULL
     OR char_length(p_auth_key) NOT BETWEEN 1 AND 500
     OR char_length(COALESCE(p_user_agent, '')) > 500 THEN
    RAISE EXCEPTION 'Invalid push subscription'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize claims for the same high-entropy browser endpoint.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_endpoint, 0)
  );

  SELECT *
  INTO v_existing
  FROM public.push_subscriptions
  WHERE endpoint = p_endpoint
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.user_id <> v_user_id
       AND (
         v_existing.p256dh IS DISTINCT FROM p_p256dh
         OR v_existing.auth_key IS DISTINCT FROM p_auth_key
       ) THEN
      RAISE EXCEPTION 'Push subscription ownership could not be verified'
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.push_subscriptions
    SET user_id = v_user_id,
        p256dh = p_p256dh,
        auth_key = p_auth_key,
        user_agent = COALESCE(p_user_agent, ''),
        failed_count = 0,
        updated_at = NOW()
    WHERE id = v_existing.id
    RETURNING id INTO v_subscription_id;
  ELSE
    INSERT INTO public.push_subscriptions (
      user_id,
      endpoint,
      p256dh,
      auth_key,
      user_agent
    )
    VALUES (
      v_user_id,
      p_endpoint,
      p_p256dh,
      p_auth_key,
      COALESCE(p_user_agent, '')
    )
    RETURNING id INTO v_subscription_id;
  END IF;

  RETURN v_subscription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(TEXT, TEXT, TEXT, TEXT)
TO authenticated;

COMMENT ON FUNCTION public.register_push_subscription(TEXT, TEXT, TEXT, TEXT) IS
  'Registers the caller push subscription. Reassignment requires possession of the stored browser keys.';
