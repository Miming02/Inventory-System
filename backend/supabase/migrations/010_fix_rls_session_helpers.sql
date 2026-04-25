-- =============================================================================
-- Stabilize RLS helpers used in almost every policy (fixes PostgREST 500s when
-- the session re-enters profiles under RLS while evaluating another table).
--
-- Run in Supabase SQL Editor. Uses RETURN (SELECT ...) — no DECLARE/INTO so
-- parsers that mis-handle plpgsql variables (42P01 on "v_org") are avoided.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN (
    SELECT r.name
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_name() TO authenticated;
