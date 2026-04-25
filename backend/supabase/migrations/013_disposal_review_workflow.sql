-- Disposal approval/rejection workflow for stock adjustments.

ALTER TABLE public.stock_adjustments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS requested_location VARCHAR(100),
  ADD COLUMN IF NOT EXISTS requested_date DATE;

ALTER TABLE public.stock_adjustments
  DROP CONSTRAINT IF EXISTS stock_adjustments_status_check;

ALTER TABLE public.stock_adjustments
  ADD CONSTRAINT stock_adjustments_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

UPDATE public.stock_adjustments
SET status = CASE WHEN approved_by IS NULL THEN 'pending' ELSE 'approved' END
WHERE status IS NULL OR status NOT IN ('pending', 'approved', 'rejected');

DROP POLICY IF EXISTS "stock_adjustments_update_ops" ON public.stock_adjustments;
DROP POLICY IF EXISTS "stock_adjustments_update_admin_only" ON public.stock_adjustments;

CREATE POLICY "stock_adjustments_update_admin_only" ON public.stock_adjustments
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_role_name() = 'Admin'
  )
  WITH CHECK (organization_id = public.current_organization_id());

CREATE OR REPLACE FUNCTION public.process_stock_adjustment_review(
  p_adjustment_id UUID,
  p_action TEXT,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS public.stock_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adjustment public.stock_adjustments%ROWTYPE;
  v_action TEXT;
  v_location TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF public.current_role_name() IS DISTINCT FROM 'Admin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_action := lower(trim(coalesce(p_action, '')));
  IF v_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid action: %', p_action;
  END IF;

  SELECT *
  INTO v_adjustment
  FROM public.stock_adjustments
  WHERE id = p_adjustment_id
    AND organization_id = public.current_organization_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stock adjustment not found';
  END IF;

  IF v_adjustment.status <> 'pending' THEN
    RAISE EXCEPTION 'stock adjustment already processed';
  END IF;

  IF v_action = 'approve' THEN
    v_location := NULLIF(trim(coalesce(v_adjustment.requested_location, '')), '');
    IF v_location IS NULL THEN
      v_location := NULLIF(
        trim(
          substring(v_adjustment.reason FROM 'Location:\s*([^|]+)')
        ),
        ''
      );
    END IF;

    IF v_location IS NULL THEN
      RAISE EXCEPTION 'requested location is required to approve disposal';
    END IF;

    INSERT INTO public.stock_movements (
      item_id,
      movement_type,
      reference_type,
      reference_id,
      quantity,
      from_location,
      to_location,
      notes,
      created_by,
      organization_id
    )
    VALUES (
      v_adjustment.item_id,
      'out',
      'disposal',
      v_adjustment.id,
      v_adjustment.quantity,
      v_location,
      NULL,
      concat(
        'Approved disposal ',
        v_adjustment.adjustment_number,
        CASE
          WHEN NULLIF(trim(coalesce(p_review_notes, '')), '') IS NULL THEN ''
          ELSE ': ' || trim(p_review_notes)
        END
      ),
      auth.uid(),
      v_adjustment.organization_id
    );

    UPDATE public.stock_adjustments
    SET status = 'approved',
        approved_by = auth.uid(),
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = NULLIF(trim(coalesce(p_review_notes, '')), '')
    WHERE id = v_adjustment.id
    RETURNING * INTO v_adjustment;
  ELSE
    UPDATE public.stock_adjustments
    SET status = 'rejected',
        approved_by = NULL,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = NULLIF(trim(coalesce(p_review_notes, '')), '')
    WHERE id = v_adjustment.id
    RETURNING * INTO v_adjustment;
  END IF;

  RETURN v_adjustment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_stock_adjustment_review(UUID, TEXT, TEXT) TO authenticated;
