-- Fix: SQL Editor has no JWT, so auth.uid() is NULL. Allow create_notification
-- when run as database superuser (Dashboard SQL only) for testing/seeding.
-- Safe for PostgREST: anon/authenticated requests still have JWT when logged in.

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_action_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  v_sql_editor_ok boolean;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_user_id IS DISTINCT FROM auth.uid() AND public.current_role_name() IS DISTINCT FROM 'Admin' THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  ELSE
    -- No JWT: SQL Editor (Dashboard) or service_role. Supabase often sets postgres.rolsuper = false;
    -- use is_superuser + known dashboard roles + optional service_role claim.
    v_sql_editor_ok := (
      COALESCE(current_setting('is_superuser', true), '') = 'on'
      OR session_user IN ('postgres', 'supabase_admin')
      OR COALESCE((SELECT r.rolsuper FROM pg_roles r WHERE r.rolname = session_user), false)
      OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );
    IF v_sql_editor_ok IS NOT TRUE THEN
      RAISE EXCEPTION 'not authenticated';
    END IF;
    IF p_user_id IS NULL THEN
      RAISE EXCEPTION 'p_user_id required when using SQL Editor';
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, action_url)
  VALUES (
    p_user_id,
    p_title,
    p_message,
    COALESCE(NULLIF(trim(p_type), ''), 'info'),
    p_action_url
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
