-- Delivery workflow table + stock count status workflow alignment

CREATE TABLE IF NOT EXISTS public.delivery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  delivery_date DATE NOT NULL,
  tracking_number TEXT,
  delivery_confirmation TEXT,
  attachment_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'pending_approval', 'scheduled', 'delivered', 'failed_delivery', 'cancelled')
  ),
  submitted_by UUID REFERENCES public.profiles(id),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, reference_no)
);

CREATE TABLE IF NOT EXISTS public.delivery_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_request_id UUID NOT NULL REFERENCES public.delivery_requests(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  sku TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_of_measure TEXT NOT NULL,
  from_location TEXT,
  to_location TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_requests_org_status
  ON public.delivery_requests(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_request_items_req
  ON public.delivery_request_items(delivery_request_id);

CREATE OR REPLACE FUNCTION public.enforce_delivery_request_items_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT dr.organization_id
    INTO v_org
  FROM public.delivery_requests dr
  WHERE dr.id = NEW.delivery_request_id
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'delivery request not found';
  END IF;
  IF v_org IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'delivery request is not in your organization';
  END IF;
  NEW.organization_id := v_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_requests_org ON public.delivery_requests;
CREATE TRIGGER trg_delivery_requests_org
  BEFORE INSERT ON public.delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_organization_id();

DROP TRIGGER IF EXISTS trg_delivery_request_items_org ON public.delivery_request_items;
CREATE TRIGGER trg_delivery_request_items_org
  BEFORE INSERT ON public.delivery_request_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_delivery_request_items_org();

ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_request_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_requests_select_org" ON public.delivery_requests;
CREATE POLICY "delivery_requests_select_org" ON public.delivery_requests
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "delivery_requests_insert_ops" ON public.delivery_requests;
CREATE POLICY "delivery_requests_insert_ops" ON public.delivery_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Production Staff', 'Management')
  );

DROP POLICY IF EXISTS "delivery_requests_update_submitter_or_approver" ON public.delivery_requests;
CREATE POLICY "delivery_requests_update_submitter_or_approver" ON public.delivery_requests
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      created_by = auth.uid()
      OR public.current_role_name() IN ('Admin', 'Management')
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "delivery_request_items_select_org" ON public.delivery_request_items;
CREATE POLICY "delivery_request_items_select_org" ON public.delivery_request_items
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "delivery_request_items_insert_ops" ON public.delivery_request_items;
CREATE POLICY "delivery_request_items_insert_ops" ON public.delivery_request_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Production Staff', 'Management')
  );

ALTER TABLE public.stock_counts
  DROP CONSTRAINT IF EXISTS stock_counts_status_check;

ALTER TABLE public.stock_counts
  ADD CONSTRAINT stock_counts_status_check
  CHECK (
    status IN (
      'not_started',
      'in_progress',
      'completed',
      'reconciled',
      'discrepancies_found'
    )
  );

UPDATE public.stock_counts
SET status = CASE
  WHEN status = 'draft' THEN 'not_started'
  WHEN status = 'approved' THEN 'reconciled'
  ELSE status
END
WHERE status IN ('draft', 'approved');
