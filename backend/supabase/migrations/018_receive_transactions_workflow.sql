-- Receive transaction workflow (draft -> pending approval -> approved/rejected/returned/cancelled)

CREATE TABLE IF NOT EXISTS public.receive_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('scan', 'manual', 'batch')),
  supplier_name TEXT,
  received_by_text TEXT,
  received_date DATE,
  location TEXT,
  attachment_path TEXT,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'returned', 'cancelled')),
  submitted_by UUID REFERENCES public.profiles(id),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, transaction_number)
);

CREATE TABLE IF NOT EXISTS public.receive_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receive_transaction_id UUID NOT NULL REFERENCES public.receive_transactions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  po_id UUID REFERENCES public.purchase_orders(id),
  po_line_id UUID REFERENCES public.purchase_order_items(id),
  sku TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  unit_of_measure TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  condition_tag TEXT NOT NULL DEFAULT 'received' CHECK (condition_tag IN ('received', 'damaged', 'returned')),
  issue_quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (issue_quantity >= 0),
  issue_reason TEXT,
  issue_notes TEXT,
  location TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receive_transactions_org_status ON public.receive_transactions(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receive_transaction_items_txn ON public.receive_transaction_items(receive_transaction_id);

CREATE OR REPLACE FUNCTION public.enforce_receive_transaction_items_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn_org UUID;
BEGIN
  SELECT rt.organization_id INTO v_txn_org
  FROM public.receive_transactions rt
  WHERE rt.id = NEW.receive_transaction_id
  LIMIT 1;

  IF v_txn_org IS NULL THEN
    RAISE EXCEPTION 'receive transaction not found';
  END IF;
  IF v_txn_org IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'receive transaction is not in your organization';
  END IF;
  NEW.organization_id := v_txn_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_receive_transactions_org ON public.receive_transactions;
CREATE TRIGGER trg_receive_transactions_org
  BEFORE INSERT ON public.receive_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_organization_id();

DROP TRIGGER IF EXISTS trg_receive_transaction_items_org ON public.receive_transaction_items;
CREATE TRIGGER trg_receive_transaction_items_org
  BEFORE INSERT ON public.receive_transaction_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_receive_transaction_items_org();

ALTER TABLE public.receive_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receive_transaction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receive_transactions_select_org" ON public.receive_transactions;
CREATE POLICY "receive_transactions_select_org" ON public.receive_transactions
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "receive_transactions_insert_ops" ON public.receive_transactions;
CREATE POLICY "receive_transactions_insert_ops" ON public.receive_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff', 'Management')
  );

DROP POLICY IF EXISTS "receive_transactions_update_submitter_or_approver" ON public.receive_transactions;
CREATE POLICY "receive_transactions_update_submitter_or_approver" ON public.receive_transactions
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      created_by = auth.uid()
      OR public.current_role_name() IN ('Admin', 'Management')
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "receive_transaction_items_select_org" ON public.receive_transaction_items;
CREATE POLICY "receive_transaction_items_select_org" ON public.receive_transaction_items
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "receive_transaction_items_insert_ops" ON public.receive_transaction_items;
CREATE POLICY "receive_transaction_items_insert_ops" ON public.receive_transaction_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff', 'Management')
  );

CREATE OR REPLACE FUNCTION public.process_receive_transaction_review(
  p_receive_transaction_id UUID,
  p_action TEXT,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS public.receive_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn public.receive_transactions%ROWTYPE;
  v_action TEXT;
  v_item RECORD;
  v_approved_qty NUMERIC(12,3);
  v_po RECORD;
  v_all_received BOOLEAN;
  v_any_received BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF public.current_role_name() NOT IN ('Admin', 'Management') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_action := lower(trim(coalesce(p_action, '')));
  IF v_action NOT IN ('approve', 'reject', 'return') THEN
    RAISE EXCEPTION 'invalid action: %', p_action;
  END IF;

  SELECT * INTO v_txn
  FROM public.receive_transactions
  WHERE id = p_receive_transaction_id
    AND organization_id = public.current_organization_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'receive transaction not found';
  END IF;
  IF v_txn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'receive transaction already processed';
  END IF;

  IF v_action = 'approve' THEN
    FOR v_item IN
      SELECT rti.*
      FROM public.receive_transaction_items rti
      WHERE rti.receive_transaction_id = v_txn.id
    LOOP
      v_approved_qty := GREATEST(0, COALESCE(v_item.quantity, 0) - COALESCE(v_item.issue_quantity, 0));
      IF v_approved_qty > 0 THEN
        INSERT INTO public.stock_movements (
          item_id, movement_type, reference_type, reference_id, quantity, unit_cost,
          to_location, notes, created_by, organization_id
        )
        VALUES (
          v_item.item_id,
          'in',
          'purchase',
          v_txn.id,
          CEIL(v_approved_qty)::INTEGER,
          v_item.unit_cost,
          NULLIF(trim(coalesce(v_item.location, '')), ''),
          concat(
            'Receive approved: ', v_txn.transaction_number,
            CASE WHEN NULLIF(trim(coalesce(v_item.issue_reason, '')), '') IS NULL THEN '' ELSE ' | Issue: ' || trim(v_item.issue_reason) END,
            CASE WHEN NULLIF(trim(coalesce(v_item.issue_notes, '')), '') IS NULL THEN '' ELSE ' | Notes: ' || trim(v_item.issue_notes) END
          ),
          auth.uid(),
          v_txn.organization_id
        );
      END IF;

      IF v_item.po_line_id IS NOT NULL AND v_approved_qty > 0 THEN
        UPDATE public.purchase_order_items
        SET quantity_received = COALESCE(quantity_received, 0) + CEIL(v_approved_qty)::INTEGER
        WHERE id = v_item.po_line_id
          AND organization_id = v_txn.organization_id;
      END IF;
    END LOOP;

    FOR v_po IN
      SELECT DISTINCT po_id
      FROM public.receive_transaction_items
      WHERE receive_transaction_id = v_txn.id
        AND po_id IS NOT NULL
    LOOP
      SELECT
        bool_and(COALESCE(poi.quantity_received, 0) >= COALESCE(poi.quantity_ordered, 0)),
        bool_or(COALESCE(poi.quantity_received, 0) > 0)
      INTO v_all_received, v_any_received
      FROM public.purchase_order_items poi
      WHERE poi.po_id = v_po.po_id
        AND poi.organization_id = v_txn.organization_id;

      UPDATE public.purchase_orders
      SET status = CASE
          WHEN v_all_received THEN 'received'
          WHEN v_any_received THEN 'confirmed'
          ELSE status
        END
      WHERE id = v_po.po_id
        AND organization_id = v_txn.organization_id;
    END LOOP;
  END IF;

  UPDATE public.receive_transactions
  SET
    status = CASE
      WHEN v_action = 'approve' THEN 'approved'
      WHEN v_action = 'reject' THEN 'rejected'
      ELSE 'returned'
    END,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_notes = NULLIF(trim(coalesce(p_review_notes, '')), ''),
    updated_at = NOW()
  WHERE id = v_txn.id
  RETURNING * INTO v_txn;

  RETURN v_txn;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_receive_transaction_review(UUID, TEXT, TEXT) TO authenticated;
