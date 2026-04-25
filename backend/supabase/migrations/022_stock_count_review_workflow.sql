-- Stock count review / reconciliation workflow
-- Approve => apply adjustments (update inventory_items + insert adjustment movements) then mark reconciled.
-- Reject  => return to in_progress (recount) and keep items for audit.

CREATE OR REPLACE FUNCTION public.process_stock_count_review(
  p_count_id UUID,
  p_action TEXT,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS public.stock_counts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count public.stock_counts%ROWTYPE;
  v_action TEXT;
  v_item RECORD;
  v_delta INTEGER;
  v_location TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF public.current_role_name() NOT IN ('Admin', 'Management') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_action := lower(trim(coalesce(p_action, '')));
  IF v_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid action: %', p_action;
  END IF;

  SELECT * INTO v_count
  FROM public.stock_counts
  WHERE id = p_count_id
    AND organization_id = public.current_organization_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stock count not found';
  END IF;

  -- Only completed counts are reviewable.
  IF v_count.status <> 'completed' THEN
    RAISE EXCEPTION 'stock count is not ready for review';
  END IF;

  v_location := NULLIF(trim(coalesce(v_count.location, '')), '');

  IF v_action = 'approve' THEN
    FOR v_item IN
      SELECT sci.*
      FROM public.stock_count_items sci
      WHERE sci.count_id = v_count.id
        AND sci.organization_id = v_count.organization_id
    LOOP
      v_delta := COALESCE(v_item.counted_quantity, 0) - COALESCE(v_item.system_quantity, 0);
      IF v_delta <> 0 THEN
        -- Apply correction: set current_stock to counted_quantity.
        UPDATE public.inventory_items
        SET
          current_stock = COALESCE(v_item.counted_quantity, 0),
          updated_at = NOW()
        WHERE id = v_item.item_id
          AND organization_id = v_count.organization_id;

        -- Log adjustment movement (audit trail). Quantity is absolute delta.
        INSERT INTO public.stock_movements (
          item_id, movement_type, reference_type, reference_id, quantity,
          from_location, to_location, notes, created_by, organization_id
        )
        VALUES (
          v_item.item_id,
          'adjustment',
          'adjustment',
          v_count.id,
          ABS(v_delta),
          CASE WHEN v_delta < 0 THEN v_location ELSE NULL END,
          CASE WHEN v_delta > 0 THEN v_location ELSE NULL END,
          concat('Stock count adjustment: ', v_count.count_number, ' (', COALESCE(v_location, '—'), ')'),
          auth.uid(),
          v_count.organization_id
        );
      END IF;
    END LOOP;
  END IF;

  UPDATE public.stock_counts
  SET
    status = CASE
      WHEN v_action = 'approve' THEN 'reconciled'
      ELSE 'in_progress'
    END,
    approved_by = CASE WHEN v_action = 'approve' THEN auth.uid() ELSE NULL END,
    updated_at = NOW(),
    notes = concat_ws(
      E'\n',
      NULLIF(trim(coalesce(public.stock_counts.notes, '')), ''),
      CASE
        WHEN v_action = 'approve' THEN concat('Reconciled by ', auth.uid(), ' at ', NOW())
        ELSE concat('Recount requested by ', auth.uid(), ' at ', NOW())
      END,
      NULLIF(trim(coalesce(p_review_notes, '')), '')
    )
  WHERE id = v_count.id
  RETURNING * INTO v_count;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_stock_count_review(UUID, TEXT, TEXT) TO authenticated;

