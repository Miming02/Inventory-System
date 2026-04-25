-- Allow operational roles to delete inventory items within their organization.
-- Without this, DELETE is blocked by RLS even for valid users.

DROP POLICY IF EXISTS "Role-based inventory delete" ON public.inventory_items;

CREATE POLICY "Role-based inventory delete" ON public.inventory_items
  FOR DELETE TO authenticated
  USING (
    public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
  );
