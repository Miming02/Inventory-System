-- Priority 1 foundation:
-- 1) explicit inventory item type classification
-- 2) unit conversion engine (global + per-item)
-- 3) bill of materials tables

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'ingredient';

ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_item_type_check;

ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_item_type_check
    CHECK (item_type IN ('ingredient', 'sub_material', 'finished_good'));

CREATE TABLE IF NOT EXISTS public.unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  from_unit VARCHAR(50) NOT NULL,
  to_unit VARCHAR(50) NOT NULL,
  factor NUMERIC(18,6) NOT NULL CHECK (factor > 0),
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, from_unit, to_unit)
);

CREATE INDEX IF NOT EXISTS idx_unit_conversions_org ON public.unit_conversions(organization_id);
CREATE INDEX IF NOT EXISTS idx_unit_conversions_from_to ON public.unit_conversions(organization_id, from_unit, to_unit);

CREATE TABLE IF NOT EXISTS public.item_unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  from_unit VARCHAR(50) NOT NULL,
  to_unit VARCHAR(50) NOT NULL,
  factor NUMERIC(18,6) NOT NULL CHECK (factor > 0),
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, from_unit, to_unit)
);

CREATE INDEX IF NOT EXISTS idx_item_unit_conversions_org ON public.item_unit_conversions(organization_id);
CREATE INDEX IF NOT EXISTS idx_item_unit_conversions_item ON public.item_unit_conversions(item_id);

CREATE TABLE IF NOT EXISTS public.boms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  code VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  finished_good_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  output_quantity NUMERIC(18,6) NOT NULL DEFAULT 1 CHECK (output_quantity > 0),
  output_unit VARCHAR(50) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code),
  UNIQUE (organization_id, finished_good_item_id, version)
);

CREATE INDEX IF NOT EXISTS idx_boms_org ON public.boms(organization_id);
CREATE INDEX IF NOT EXISTS idx_boms_finished_good ON public.boms(finished_good_item_id);

CREATE TABLE IF NOT EXISTS public.bom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  bom_id UUID NOT NULL REFERENCES public.boms(id) ON DELETE CASCADE,
  component_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(18,6) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(50) NOT NULL,
  waste_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (waste_percent >= 0 AND waste_percent <= 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bom_id, component_item_id, unit)
);

CREATE INDEX IF NOT EXISTS idx_bom_items_org ON public.bom_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_bom ON public.bom_items(bom_id);

CREATE OR REPLACE FUNCTION public.enforce_item_unit_conversions_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_org uuid;
BEGIN
  v_item_org := (
    SELECT i.organization_id
    FROM public.inventory_items i
    WHERE i.id = NEW.item_id
    LIMIT 1
  );
  IF v_item_org IS NULL THEN
    RAISE EXCEPTION 'inventory item not found';
  END IF;
  IF v_item_org IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'item is not in your organization';
  END IF;
  NEW.organization_id := v_item_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unit_conversions_org ON public.unit_conversions;
CREATE TRIGGER trg_unit_conversions_org
  BEFORE INSERT ON public.unit_conversions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_organization_id();

DROP TRIGGER IF EXISTS trg_item_unit_conversions_org ON public.item_unit_conversions;
CREATE TRIGGER trg_item_unit_conversions_org
  BEFORE INSERT ON public.item_unit_conversions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_item_unit_conversions_org();

DROP TRIGGER IF EXISTS trg_boms_org ON public.boms;
CREATE TRIGGER trg_boms_org
  BEFORE INSERT ON public.boms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_organization_id();

CREATE OR REPLACE FUNCTION public.enforce_bom_items_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bom_org uuid;
BEGIN
  v_bom_org := (
    SELECT b.organization_id
    FROM public.boms b
    WHERE b.id = NEW.bom_id
    LIMIT 1
  );
  IF v_bom_org IS NULL THEN
    RAISE EXCEPTION 'bom not found';
  END IF;
  IF v_bom_org IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'bom is not in your organization';
  END IF;
  NEW.organization_id := v_bom_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bom_items_org ON public.bom_items;
CREATE TRIGGER trg_bom_items_org
  BEFORE INSERT ON public.bom_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_bom_items_org();

ALTER TABLE public.unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unit_conversions_select_org" ON public.unit_conversions;
CREATE POLICY "unit_conversions_select_org" ON public.unit_conversions
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "unit_conversions_write_ops" ON public.unit_conversions;
CREATE POLICY "unit_conversions_write_ops" ON public.unit_conversions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff')
  );

DROP POLICY IF EXISTS "unit_conversions_update_ops" ON public.unit_conversions;
CREATE POLICY "unit_conversions_update_ops" ON public.unit_conversions
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff')
  )
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "item_unit_conversions_select_org" ON public.item_unit_conversions;
CREATE POLICY "item_unit_conversions_select_org" ON public.item_unit_conversions
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "item_unit_conversions_write_ops" ON public.item_unit_conversions;
CREATE POLICY "item_unit_conversions_write_ops" ON public.item_unit_conversions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff')
  );

DROP POLICY IF EXISTS "item_unit_conversions_update_ops" ON public.item_unit_conversions;
CREATE POLICY "item_unit_conversions_update_ops" ON public.item_unit_conversions
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff')
  )
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "boms_select_org" ON public.boms;
CREATE POLICY "boms_select_org" ON public.boms
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "boms_write_ops" ON public.boms;
CREATE POLICY "boms_write_ops" ON public.boms
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Procurement Staff', 'Production Staff')
  );

DROP POLICY IF EXISTS "boms_update_ops" ON public.boms;
CREATE POLICY "boms_update_ops" ON public.boms
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Procurement Staff', 'Production Staff')
  )
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "bom_items_select_org" ON public.bom_items;
CREATE POLICY "bom_items_select_org" ON public.bom_items
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "bom_items_write_ops" ON public.bom_items;
CREATE POLICY "bom_items_write_ops" ON public.bom_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Procurement Staff', 'Production Staff')
  );

DROP POLICY IF EXISTS "bom_items_update_ops" ON public.bom_items;
CREATE POLICY "bom_items_update_ops" ON public.bom_items
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Procurement Staff', 'Production Staff')
  )
  WITH CHECK (organization_id = public.current_organization_id());

CREATE OR REPLACE FUNCTION public.convert_item_quantity(
  p_item_id UUID,
  p_qty NUMERIC,
  p_from_unit TEXT,
  p_to_unit TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factor NUMERIC;
  v_org UUID;
BEGIN
  IF p_qty IS NULL THEN
    RETURN NULL;
  END IF;

  IF lower(trim(coalesce(p_from_unit, ''))) = lower(trim(coalesce(p_to_unit, ''))) THEN
    RETURN p_qty;
  END IF;

  v_org := public.current_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization not resolved';
  END IF;

  SELECT c.factor
  INTO v_factor
  FROM public.item_unit_conversions c
  WHERE c.item_id = p_item_id
    AND c.organization_id = v_org
    AND lower(c.from_unit) = lower(p_from_unit)
    AND lower(c.to_unit) = lower(p_to_unit)
  LIMIT 1;

  IF v_factor IS NULL THEN
    SELECT c.factor
    INTO v_factor
    FROM public.unit_conversions c
    WHERE c.organization_id = v_org
      AND lower(c.from_unit) = lower(p_from_unit)
      AND lower(c.to_unit) = lower(p_to_unit)
    LIMIT 1;
  END IF;

  IF v_factor IS NULL THEN
    RAISE EXCEPTION 'no conversion factor from "%" to "%" for item %', p_from_unit, p_to_unit, p_item_id;
  END IF;

  RETURN p_qty * v_factor;
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_item_quantity(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
