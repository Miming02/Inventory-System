-- Allow updating stock count sessions and deleting items during progress saves.
-- Needed for count session flow (not_started -> in_progress -> completed).

-- Stock counts: allow ops roles to update within org (creator or Admin).
DROP POLICY IF EXISTS "stock_counts_update_ops" ON public.stock_counts;
CREATE POLICY "stock_counts_update_ops" ON public.stock_counts
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.current_role_name() = 'Admin'
      OR (public.current_role_name() = 'Warehouse Staff' AND created_by = auth.uid())
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- Stock count items: allow delete within org for ops roles (to re-save progress).
DROP POLICY IF EXISTS "stock_count_items_delete_ops" ON public.stock_count_items;
CREATE POLICY "stock_count_items_delete_ops" ON public.stock_count_items
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff')
  );

