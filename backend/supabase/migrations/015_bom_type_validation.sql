-- Priority 1: enforce BOM type rules
-- - BOM output must be finished_good
-- - BOM components must be ingredient or sub_material

CREATE OR REPLACE FUNCTION public.enforce_bom_output_item_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
BEGIN
  SELECT i.item_type
  INTO v_type
  FROM public.inventory_items i
  WHERE i.id = NEW.finished_good_item_id
  LIMIT 1;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'finished good item not found';
  END IF;

  IF v_type <> 'finished_good' THEN
    RAISE EXCEPTION 'BOM output item must be finished_good (got %)', v_type;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_bom_component_item_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
BEGIN
  SELECT i.item_type
  INTO v_type
  FROM public.inventory_items i
  WHERE i.id = NEW.component_item_id
  LIMIT 1;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'component item not found';
  END IF;

  IF v_type NOT IN ('ingredient', 'sub_material') THEN
    RAISE EXCEPTION 'BOM component item must be ingredient or sub_material (got %)', v_type;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_boms_output_type ON public.boms;
CREATE CONSTRAINT TRIGGER trg_boms_output_type
  AFTER INSERT OR UPDATE OF finished_good_item_id
  ON public.boms
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_bom_output_item_type();

DROP TRIGGER IF EXISTS trg_bom_items_component_type ON public.bom_items;
CREATE CONSTRAINT TRIGGER trg_bom_items_component_type
  AFTER INSERT OR UPDATE OF component_item_id
  ON public.bom_items
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_bom_component_item_type();

