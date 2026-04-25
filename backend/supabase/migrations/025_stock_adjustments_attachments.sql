ALTER TABLE public.stock_adjustments
ADD COLUMN IF NOT EXISTS attachment_paths JSONB NOT NULL DEFAULT '[]'::jsonb;

