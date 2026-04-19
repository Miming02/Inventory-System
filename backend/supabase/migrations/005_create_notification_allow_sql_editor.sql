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
  v_superuser boolean;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_user_id IS DISTINCT FROM auth.uid() AND public.current_role_name() IS DISTINCT FROM 'Admin' THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  ELSE
    v_superuser := (SELECT r.rolsuper FROM pg_roles AS r WHERE r.rolname = session_user LIMIT 1);
    IF COALESCE(v_superuser, false) IS NOT TRUE THEN
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
