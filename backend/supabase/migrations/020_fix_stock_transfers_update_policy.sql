-- Fix missing UPDATE policy for stock_transfers
-- The approve button needs to update the transfer status from 'pending' to 'completed'

DROP POLICY IF EXISTS "stock_transfers_write_ops" ON public.stock_transfers;

CREATE POLICY "stock_transfers_write_ops" ON public.stock_transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Production Staff')
  );

-- Add missing UPDATE policy for stock_transfers
CREATE POLICY "stock_transfers_update_ops" ON public.stock_transfers
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Production Staff')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Production Staff')
  );
