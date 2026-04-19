-- Notifications: RLS + safe RPC for creating rows (self or Admin).
-- Run in Supabase SQL Editor after 001.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

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

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- Optional: Realtime (Dashboard → Database → Replication). Enable for `notifications` if you want live updates.
