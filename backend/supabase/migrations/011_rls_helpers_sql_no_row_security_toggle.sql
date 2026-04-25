-- =============================================================================
-- Replace 010 helpers: pure SQL + SECURITY DEFINER, NO "SET LOCAL row_security".
-- Some PostgREST/RLS setups return 400 on /profiles when plpgsql + row_security
-- toggle misbehaves. This matches the stable pattern from migration 008 for
-- current_organization_id (sql body, definer bypasses RLS on owned objects).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.organization_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.name
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.role_id
  WHERE p.id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_name() TO authenticated;
