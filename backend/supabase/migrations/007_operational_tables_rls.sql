-- ========================================
-- RLS for tables that ship without policies in 001
-- ========================================
-- Bago: maraming table ang "UNRESTRICTED" (RLS disabled) sa Supabase UI.
-- Ito: nag-e-enable ng RLS + conservative policies para sa catalog at PO lines.
-- (Ang `006` seed ay tumatakbo bilang privileged role — hindi blocked.)

-- ----- categories -----
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_authenticated" ON public.categories;
DROP POLICY IF EXISTS "categories_write_ops" ON public.categories;
DROP POLICY IF EXISTS "categories_update_ops" ON public.categories;

CREATE POLICY "categories_select_authenticated"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "categories_write_ops"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff'));

CREATE POLICY "categories_update_ops"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff'));

-- ----- suppliers -----
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select_authenticated" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert_procurement" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update_procurement" ON public.suppliers;

CREATE POLICY "suppliers_select_authenticated"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "suppliers_insert_procurement"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (public.current_role_name() IN ('Admin', 'Procurement Staff'));

CREATE POLICY "suppliers_update_procurement"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (public.current_role_name() IN ('Admin', 'Procurement Staff'));

-- ----- purchase_order_items (same visibility as parent PO) -----
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_items_select_ops" ON public.purchase_order_items;
DROP POLICY IF EXISTS "po_items_insert_procurement" ON public.purchase_order_items;
DROP POLICY IF EXISTS "po_items_update_procurement" ON public.purchase_order_items;
DROP POLICY IF EXISTS "po_items_delete_procurement" ON public.purchase_order_items;

CREATE POLICY "po_items_select_ops"
  ON public.purchase_order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      WHERE po.id = po_id
        AND public.current_role_name() IN (
          'Admin', 'Management', 'Warehouse Staff', 'Procurement Staff'
        )
    )
  );

CREATE POLICY "po_items_insert_procurement"
  ON public.purchase_order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_role_name() IN ('Admin', 'Procurement Staff')
    AND EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = po_id
    )
  );

CREATE POLICY "po_items_update_procurement"
  ON public.purchase_order_items FOR UPDATE
  TO authenticated
  USING (
    public.current_role_name() IN ('Admin', 'Procurement Staff')
    AND EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = po_id
    )
  );

CREATE POLICY "po_items_delete_procurement"
  ON public.purchase_order_items FOR DELETE
  TO authenticated
  USING (
    public.current_role_name() IN ('Admin', 'Procurement Staff')
  );
