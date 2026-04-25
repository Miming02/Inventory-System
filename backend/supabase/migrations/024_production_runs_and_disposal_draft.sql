-- Add draft status for disposal requests and a production run workflow.

ALTER TABLE public.stock_adjustments
  DROP CONSTRAINT IF EXISTS stock_adjustments_status_check;

ALTER TABLE public.stock_adjustments
  ADD CONSTRAINT stock_adjustments_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));

UPDATE public.stock_adjustments
SET status = CASE
  WHEN status IN ('draft', 'pending', 'approved', 'rejected') THEN status
  WHEN approved_by IS NULL THEN 'pending'
  ELSE 'approved'
END;

CREATE TABLE IF NOT EXISTS public.production_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  production_number TEXT NOT NULL,
  bom_id UUID NOT NULL REFERENCES public.boms(id),
  finished_good_item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  location VARCHAR(100) NOT NULL,
  target_quantity NUMERIC(14, 4) NOT NULL CHECK (target_quantity > 0),
  output_unit VARCHAR(30),
  finished_good_base_qty NUMERIC(14, 4) NOT NULL CHECK (finished_good_base_qty >= 0),
  add_finished_goods BOOLEAN NOT NULL DEFAULT TRUE,
  required_components JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_by UUID REFERENCES public.profiles(id),
  completed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT production_runs_org_number_unique UNIQUE (organization_id, production_number)
);

CREATE INDEX IF NOT EXISTS idx_production_runs_org_status
  ON public.production_runs(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_runs_bom
  ON public.production_runs(bom_id);

DROP TRIGGER IF EXISTS trg_production_runs_org ON public.production_runs;
CREATE TRIGGER trg_production_runs_org
  BEFORE INSERT ON public.production_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_organization_id();

ALTER TABLE public.production_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "production_runs_select_org" ON public.production_runs;
CREATE POLICY "production_runs_select_org" ON public.production_runs
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS "production_runs_write_ops" ON public.production_runs;
CREATE POLICY "production_runs_write_ops" ON public.production_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_role_name() IN ('Admin', 'Warehouse Manager', 'Warehouse Staff', 'Production Staff')
  );

DROP POLICY IF EXISTS "production_runs_update_ops" ON public.production_runs;
CREATE POLICY "production_runs_update_ops" ON public.production_runs
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

CREATE OR REPLACE FUNCTION public.process_production_run(
  p_run_id UUID,
  p_action TEXT,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS public.production_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.production_runs%ROWTYPE;
  v_action TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_action := lower(trim(coalesce(p_action, '')));
  IF v_action NOT IN ('complete', 'fail') THEN
    RAISE EXCEPTION 'invalid action: %', p_action;
  END IF;

  SELECT *
  INTO v_run
  FROM public.production_runs
  WHERE id = p_run_id
    AND organization_id = public.current_organization_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'production run not found';
  END IF;

  IF v_run.status <> 'in_progress' THEN
    RAISE EXCEPTION 'production run already processed';
  END IF;

  IF v_action = 'complete' THEN
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
    SELECT
      (comp->>'item_id')::uuid,
      'out',
      'production',
      v_run.id,
      GREATEST((comp->>'required_base_qty')::numeric, 0),
      v_run.location,
      NULL,
      concat('Production consume ', v_run.production_number),
      auth.uid(),
      v_run.organization_id
    FROM jsonb_array_elements(v_run.required_components) AS comp
    WHERE (comp->>'item_id') IS NOT NULL
      AND COALESCE((comp->>'required_base_qty')::numeric, 0) > 0;

    IF v_run.add_finished_goods AND v_run.finished_good_base_qty > 0 THEN
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
        v_run.finished_good_item_id,
        'in',
        'production',
        v_run.id,
        v_run.finished_good_base_qty,
        NULL,
        v_run.location,
        concat('Production output ', v_run.production_number),
        auth.uid(),
        v_run.organization_id
      );
    END IF;

    UPDATE public.production_runs
    SET status = 'completed',
        completed_at = now(),
        completed_by = auth.uid(),
        failure_reason = NULL,
        updated_at = now()
    WHERE id = v_run.id
    RETURNING * INTO v_run;
  ELSE
    UPDATE public.production_runs
    SET status = 'failed',
        failed_at = now(),
        completed_by = auth.uid(),
        failure_reason = NULLIF(trim(coalesce(p_failure_reason, '')), ''),
        updated_at = now()
    WHERE id = v_run.id
    RETURNING * INTO v_run;
  END IF;

  RETURN v_run;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_production_run(UUID, TEXT, TEXT) TO authenticated;
