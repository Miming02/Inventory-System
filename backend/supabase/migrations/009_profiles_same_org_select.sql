-- =============================================================================
-- PostgREST embeds (e.g. stock_movements -> profiles for created_by) need SELECT
-- on related profile rows. The original RLS only allowed "own row" + admin,
-- so non-admin roles got 500s when the API embedded another user's profile.
--
-- This adds a permissive policy: users can read profiles in their organization.
-- Optional: enables richer UI (e.g. showing colleague names). Safe for internal tools.
-- =============================================================================

DROP POLICY IF EXISTS "profiles_select_same_organization" ON public.profiles;

CREATE POLICY "profiles_select_same_organization"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id = public.current_organization_id()
  );
