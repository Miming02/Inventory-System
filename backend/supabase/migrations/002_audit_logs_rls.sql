-- Audit logs: secure reads (Admin only). Trigger inserts run as SECURITY DEFINER so RLS does not block triggers.
-- Apply in Supabase SQL Editor or: supabase db push

ALTER FUNCTION public.audit_trigger() SECURITY DEFINER;
ALTER FUNCTION public.audit_trigger() SET search_path = public;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit_logs" ON public.audit_logs
  FOR SELECT USING (public.current_role_name() = 'Admin');
