-- Remove inherited Supabase defaults before restoring the minimum app privileges.
REVOKE ALL ON TABLE public.journal_entries
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.journal_entries
  TO authenticated, service_role;
