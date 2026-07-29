-- Keep the accountability RLS checks compact and cover the composite link FK.

CREATE INDEX partner_celebrations_link_identity_idx
  ON public.partner_celebrations (link_id, owner_id, partner_id);

DROP POLICY IF EXISTS "Permanent owners read celebrations received"
  ON public.partner_celebrations;
DROP POLICY IF EXISTS "Permanent partners read celebrations sent"
  ON public.partner_celebrations;

CREATE POLICY "Permanent participants read celebrations"
  ON public.partner_celebrations
  FOR SELECT
  TO authenticated
  USING (
    (
      (SELECT auth.uid()) = owner_id
      OR (SELECT auth.uid()) = partner_id
    )
    AND COALESCE(
      ((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN,
      FALSE
    ) = FALSE
  );

DROP POLICY IF EXISTS "Permanent owners read their own links"
  ON public.partner_links;
DROP POLICY IF EXISTS "Permanent partners read links naming them"
  ON public.partner_links;

CREATE POLICY "Permanent participants read their links"
  ON public.partner_links
  FOR SELECT
  TO authenticated
  USING (
    (
      (SELECT auth.uid()) = owner_id
      OR (SELECT auth.uid()) = partner_id
    )
    AND COALESCE(
      ((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN,
      FALSE
    ) = FALSE
  );

DROP POLICY IF EXISTS "Permanent owners update their own links"
  ON public.partner_links;
DROP POLICY IF EXISTS "Permanent partners may end their own partnership"
  ON public.partner_links;

CREATE POLICY "Permanent participants update their links"
  ON public.partner_links
  FOR UPDATE
  TO authenticated
  USING (
    (
      (SELECT auth.uid()) = owner_id
      OR (SELECT auth.uid()) = partner_id
    )
    AND COALESCE(
      ((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN,
      FALSE
    ) = FALSE
  )
  WITH CHECK (
    (
      (SELECT auth.uid()) = owner_id
      OR (SELECT auth.uid()) = partner_id
    )
    AND COALESCE(
      ((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN,
      FALSE
    ) = FALSE
  );
