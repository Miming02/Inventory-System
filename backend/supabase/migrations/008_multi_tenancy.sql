-- ========================================
-- Multi-tenancy: organizations + organization_id on tenant data
-- ========================================
-- Default org UUID (existing rows + signups without metadata land here).
-- Invited users receive organization_id via auth raw_user_meta_data (see invite-user Edge Function).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----- 1) Organizations -----
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.organizations (id, name, slug)
VALUES (
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'Default organization',
  'default'
)
ON CONFLICT (id) DO NOTHING;

-- ----- 2) Profiles: link every user to exactly one org (column must exist before current_organization_id()) -----
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

UPDATE public.profiles
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);

-- New signups: org from invite metadata, else default org
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default CONSTANT uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_org uuid;
BEGIN
  v_org := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'organization_id'), '')::uuid,
    NULLIF(trim(NEW.raw_user_meta_data ->> 'organizationId'), '')::uuid,
    v_default
  );

  INSERT INTO public.profiles (id, email, organization_id, created_at, updated_at)
  VALUES (NEW.id, NEW.email, v_org, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id),
      updated_at = NOW();

  RETURN NEW;
END;
$$;

-- ----- 3) Session helper (after profiles.organization_id exists) -----
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.organization_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;

-- ----- 4) Tenant columns (nullable first, then backfill, then NOT NULL) -----
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.stock_transfer_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.stock_counts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.stock_count_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.stock_adjustments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

UPDATE public.categories SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.suppliers SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid WHERE organization_id IS NULL;

UPDATE public.inventory_items i
SET organization_id = COALESCE(c.organization_id, 'a0000000-0000-4000-8000-000000000001'::uuid)
FROM public.categories c
WHERE i.organization_id IS NULL AND i.category_id = c.id;

UPDATE public.inventory_items
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS NULL;

UPDATE public.purchase_orders po
SET organization_id = s.organization_id
FROM public.suppliers s
WHERE po.organization_id IS NULL AND po.supplier_id = s.id;

UPDATE public.purchase_orders
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS NULL;

UPDATE public.purchase_order_items poi
SET organization_id = po.organization_id
FROM public.purchase_orders po
WHERE poi.organization_id IS NULL AND poi.po_id = po.id;

UPDATE public.stock_movements sm
SET organization_id = i.organization_id
FROM public.inventory_items i
WHERE sm.organization_id IS NULL AND sm.item_id = i.id;

UPDATE public.stock_movements
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS NULL;

UPDATE public.stock_transfers st
SET organization_id = p.organization_id
FROM public.profiles p
WHERE st.organization_id IS NULL AND st.created_by = p.id;

UPDATE public.stock_transfers
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS NULL;

UPDATE public.stock_transfer_items sti
SET organization_id = st.organization_id
FROM public.stock_transfers st
WHERE sti.organization_id IS NULL AND sti.transfer_id = st.id;

UPDATE public.stock_counts sc
SET organization_id = p.organization_id
FROM public.profiles p
WHERE sc.organization_id IS NULL AND sc.created_by = p.id;

UPDATE public.stock_counts
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS NULL;

UPDATE public.stock_count_items sci
SET organization_id = sc.organization_id
FROM public.stock_counts sc
WHERE sci.organization_id IS NULL AND sci.count_id = sc.id;

UPDATE public.stock_adjustments sa
SET organization_id = i.organization_id
FROM public.inventory_items i
WHERE sa.organization_id IS NULL AND sa.item_id = i.id;

UPDATE public.stock_adjustments
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS NULL;

UPDATE public.notifications n
SET organization_id = p.organization_id
FROM public.profiles p
WHERE n.organization_id IS NULL AND n.user_id = p.id;

UPDATE public.notifications
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS NULL;

UPDATE public.audit_logs a
SET organization_id = p.organization_id
FROM public.profiles p
WHERE a.organization_id IS NULL AND a.user_id = p.id;

ALTER TABLE public.categories ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.suppliers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.inventory_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.purchase_orders ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.purchase_order_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.stock_movements ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.stock_transfers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.stock_transfer_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.stock_counts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.stock_count_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.stock_adjustments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_organization_id ON public.categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_organization_id ON public.suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_organization_id ON public.inventory_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_organization_id ON public.purchase_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_organization_id ON public.purchase_order_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_organization_id ON public.stock_movements(organization_id);

-- ----- 5) Uniqueness per organization -----
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_org_sku_unique
  ON public.inventory_items(organization_id, sku);

ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_org_po_number_unique
  ON public.purchase_orders(organization_id, po_number);

ALTER TABLE public.stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_transfer_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS stock_transfers_org_transfer_number_unique
  ON public.stock_transfers(organization_id, transfer_number);

ALTER TABLE public.stock_counts DROP CONSTRAINT IF EXISTS stock_counts_count_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS stock_counts_org_count_number_unique
  ON public.stock_counts(organization_id, count_number);

ALTER TABLE public.stock_adjustments DROP CONSTRAINT IF EXISTS stock_adjustments_adjustment_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS stock_adjustments_org_adjustment_number_unique
  ON public.stock_adjustments(organization_id, adjustment_number);

-- ----- 6) BEFORE INSERT: default + enforce org on writer-owned rows -----
CREATE OR REPLACE FUNCTION public.enforce_insert_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.current_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No organization on profile';
  END IF;
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := v_org;
  ELSIF NEW.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'organization_id does not match your organization';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_org ON public.categories;
CREATE TRIGGER trg_categories_org
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_organization_id();

DROP TRIGGER IF EXISTS trg_suppliers_org ON public.suppliers;
CREATE TRIGGER trg_suppliers_org
  BEFORE INSERT ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_organization_id();

DROP TRIGGER IF EXISTS trg_inventory_items_org ON public.inventory_items;
CREATE TRIGGER trg_inventory_items_org
  BEFORE INSERT ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_organization_id();

DROP TRIGGER IF EXISTS trg_purchase_orders_org ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_org
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_organization_id();

DROP TRIGGER IF EXISTS trg_stock_transfers_org ON public.stock_transfers;
CREATE TRIGGER trg_stock_transfers_org
  BEFORE INSERT ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_organization_id();

DROP TRIGGER IF EXISTS trg_stock_counts_org ON public.stock_counts;
CREATE TRIGGER trg_stock_counts_org
  BEFORE INSERT ON public.stock_counts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_organization_id();

DROP TRIGGER IF EXISTS trg_stock_adjustments_org ON public.stock_adjustments;
CREATE TRIGGER trg_stock_adjustments_org
  BEFORE INSERT ON public.stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_organization_id();

CREATE OR REPLACE FUNCTION public.enforce_purchase_order_items_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_org uuid;
BEGIN
  v_po_org := (
    SELECT po.organization_id
    FROM public.purchase_orders po
    WHERE po.id = NEW.po_id
    LIMIT 1
  );
  IF v_po_org IS NULL THEN
    RAISE EXCEPTION 'purchase order not found';
  END IF;
  IF v_po_org IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'purchase order is not in your organization';
  END IF;
  NEW.organization_id := v_po_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_order_items_org ON public.purchase_order_items;
CREATE TRIGGER trg_purchase_order_items_org
  BEFORE INSERT ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_purchase_order_items_org();

CREATE OR REPLACE FUNCTION public.enforce_stock_movements_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_it_org uuid;
BEGIN
  v_it_org := (
    SELECT i.organization_id
    FROM public.inventory_items i
    WHERE i.id = NEW.item_id
    LIMIT 1
  );
  IF v_it_org IS NULL THEN
    RAISE EXCEPTION 'inventory item not found';
  END IF;
  IF v_it_org IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'item is not in your organization';
  END IF;
  NEW.organization_id := v_it_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_movements_org ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_org
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_stock_movements_org();

CREATE OR REPLACE FUNCTION public.enforce_stock_transfer_items_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_st_org uuid;
BEGIN
  v_st_org := (
    SELECT st.organization_id
    FROM public.stock_transfers st
    WHERE st.id = NEW.transfer_id
    LIMIT 1
  );
  IF v_st_org IS NULL THEN
    RAISE EXCEPTION 'transfer not found';
  END IF;
  IF v_st_org IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'transfer is not in your organization';
  END IF;
  NEW.organization_id := v_st_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_transfer_items_org ON public.stock_transfer_items;
CREATE TRIGGER trg_stock_transfer_items_org
  BEFORE INSERT ON public.stock_transfer_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_stock_transfer_items_org();

CREATE OR REPLACE FUNCTION public.enforce_stock_count_items_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sc_org uuid;
BEGIN
  v_sc_org := (
    SELECT sc.organization_id
    FROM public.stock_counts sc
    WHERE sc.id = NEW.count_id
    LIMIT 1
  );
  IF v_sc_org IS NULL THEN
    RAISE EXCEPTION 'stock count not found';
  END IF;
  IF v_sc_org IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'count is not in your organization';
  END IF;
  NEW.organization_id := v_sc_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_count_items_org ON public.stock_count_items;
CREATE TRIGGER trg_stock_count_items_org
  BEFORE INSERT ON public.stock_count_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_stock_count_items_org();

-- ----- 7) Organizations RLS -----
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations_select_same_org" ON public.organizations;
CREATE POLICY "organizations_select_same_org"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (id = public.current_organization_id());

-- ----- 8) Replace RLS on existing policies (001 + 007 + 002 + 003) -----

-- profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND organization_id IS NOT DISTINCT FROM public.current_organization_id()
  );

CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.current_role_name() = 'Admin'
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.current_role_name() = 'Admin'
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (
    public.current_role_name() = 'Admin'
    AND organization_id = public.current_organization_id()
  );

-- inventory_items
DROP POLICY IF EXISTS "Authenticated can read inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Role-based inventory write" ON public.inventory_items;
DROP POLICY IF EXISTS "Role-based inventory update" ON public.inventory_items;

CREATE POLICY "Authenticated can read inventory" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (
    auth.role() = 'authenticated'
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY "Role-based inventory write" ON public.inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY "Role-based inventory update" ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (
    public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- purchase_orders
DROP POLICY IF EXISTS "Purchase orders read by ops roles" ON public.purchase_orders;
DROP POLICY IF EXISTS "Procurement can create purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Procurement can update own purchase orders" ON public.purchase_orders;

CREATE POLICY "Purchase orders read by ops roles" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (
    public.current_role_name() IN ('Admin', 'Management', 'Warehouse Staff', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY "Procurement can create purchase orders" ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_role_name() IN ('Admin', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY "Procurement can update own purchase orders" ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.current_role_name() = 'Admin'
      OR (
        public.current_role_name() = 'Procurement Staff'
        AND created_by = auth.uid()
      )
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- stock_movements
DROP POLICY IF EXISTS "Stock movements read by ops roles" ON public.stock_movements;
DROP POLICY IF EXISTS "Stock movements write by warehouse/admin" ON public.stock_movements;

CREATE POLICY "Stock movements read by ops roles" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (
    public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Management', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY "Stock movements write by warehouse/admin" ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_role_name() IN ('Admin', 'Warehouse Staff')
    AND organization_id = public.current_organization_id()
  );

-- categories (007)
DROP POLICY IF EXISTS "categories_select_authenticated" ON public.categories;
DROP POLICY IF EXISTS "categories_write_ops" ON public.categories;
DROP POLICY IF EXISTS "categories_update_ops" ON public.categories;

CREATE POLICY "categories_select_authenticated" ON public.categories
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY "categories_write_ops" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY "categories_update_ops" ON public.categories
  FOR UPDATE TO authenticated
  USING (
    public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- suppliers (007)
DROP POLICY IF EXISTS "suppliers_select_authenticated" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert_procurement" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update_procurement" ON public.suppliers;

CREATE POLICY "suppliers_select_authenticated" ON public.suppliers
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY "suppliers_insert_procurement" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_role_name() IN ('Admin', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY "suppliers_update_procurement" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    public.current_role_name() IN ('Admin', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- purchase_order_items (007)
DROP POLICY IF EXISTS "po_items_select_ops" ON public.purchase_order_items;
DROP POLICY IF EXISTS "po_items_insert_procurement" ON public.purchase_order_items;
DROP POLICY IF EXISTS "po_items_update_procurement" ON public.purchase_order_items;
DROP POLICY IF EXISTS "po_items_delete_procurement" ON public.purchase_order_items;

CREATE POLICY "po_items_select_ops" ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      WHERE po.id = po_id
        AND po.organization_id = public.current_organization_id()
        AND public.current_role_name() IN (
          'Admin', 'Management', 'Warehouse Staff', 'Procurement Staff'
        )
    )
  );

CREATE POLICY "po_items_insert_procurement" ON public.purchase_order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_role_name() IN ('Admin', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = po_id
        AND po.organization_id = public.current_organization_id()
    )
  );

CREATE POLICY "po_items_update_procurement" ON public.purchase_order_items
  FOR UPDATE TO authenticated
  USING (
    public.current_role_name() IN ('Admin', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY "po_items_delete_procurement" ON public.purchase_order_items
  FOR DELETE TO authenticated
  USING (
    public.current_role_name() IN ('Admin', 'Procurement Staff')
    AND organization_id = public.current_organization_id()
  );

-- audit_logs (002)
DROP POLICY IF EXISTS "Admins can read audit_logs" ON public.audit_logs;

CREATE POLICY "Admins can read audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.current_role_name() = 'Admin'
    AND (
      organization_id IS NULL
      OR organization_id = public.current_organization_id()
    )
  );

-- notifications (003)
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- ----- 9) Operational tables: RLS + org -----
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_transfers_select_org" ON public.stock_transfers;
DROP POLICY IF EXISTS "stock_transfers_write_ops" ON public.stock_transfers;

CREATE POLICY "stock_transfers_select_org" ON public.stock_transfers
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY "stock_transfers_write_ops" ON public.stock_transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Production Staff')
  );

DROP POLICY IF EXISTS "stock_transfer_items_select_org" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "stock_transfer_items_write_ops" ON public.stock_transfer_items;

CREATE POLICY "stock_transfer_items_select_org" ON public.stock_transfer_items
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY "stock_transfer_items_write_ops" ON public.stock_transfer_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Production Staff')
  );

DROP POLICY IF EXISTS "stock_counts_select_org" ON public.stock_counts;
DROP POLICY IF EXISTS "stock_counts_write_ops" ON public.stock_counts;

CREATE POLICY "stock_counts_select_org" ON public.stock_counts
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY "stock_counts_write_ops" ON public.stock_counts
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff')
  );

DROP POLICY IF EXISTS "stock_count_items_select_org" ON public.stock_count_items;
DROP POLICY IF EXISTS "stock_count_items_write_ops" ON public.stock_count_items;

CREATE POLICY "stock_count_items_select_org" ON public.stock_count_items
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY "stock_count_items_write_ops" ON public.stock_count_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff')
  );

DROP POLICY IF EXISTS "stock_adjustments_select_org" ON public.stock_adjustments;
DROP POLICY IF EXISTS "stock_adjustments_write_ops" ON public.stock_adjustments;
DROP POLICY IF EXISTS "stock_adjustments_update_ops" ON public.stock_adjustments;

CREATE POLICY "stock_adjustments_select_org" ON public.stock_adjustments
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY "stock_adjustments_write_ops" ON public.stock_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff')
  );

CREATE POLICY "stock_adjustments_update_ops" ON public.stock_adjustments
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff')
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- ----- 10) create_notification: stamp organization_id -----
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
  v_org uuid;
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

  v_org := (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = p_user_id
    LIMIT 1
  );

  INSERT INTO public.notifications (user_id, organization_id, title, message, type, action_url)
  VALUES (
    p_user_id,
    v_org,
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

-- ----- 11) Optional: create org (authenticated) -----
CREATE OR REPLACE FUNCTION public.create_organization(org_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF trim(coalesce(org_name, '')) = '' THEN
    RAISE EXCEPTION 'org_name required';
  END IF;
  IF public.current_role_name() IS DISTINCT FROM 'Admin' THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (trim(org_name), 'org-' || replace(gen_random_uuid()::text, '-', ''))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization(text) TO authenticated;
