-- =============================================================================
-- Organization alignment (multi-tenant sanity check)
-- =============================================================================
-- Tama ang intindi: parehong organization_id sa profiles = parehong data
-- (inventory_items, stock_movements, purchase_orders, etc.) under RLS.
--
-- Supabase Dashboard → SQL Editor. Palitan ang email sa LAHAT ng `ref` CTE.
-- =============================================================================

-- ----- 1) Reference admin (change email only) -----
WITH ref AS (
  SELECT
    p.id AS admin_profile_id,
    p.organization_id AS admin_organization_id,
    p.email AS admin_email
  FROM public.profiles p
  WHERE lower(trim(p.email)) = lower(trim('rommellibunao524@gmail.com'))  -- <-- EDIT
  LIMIT 1
)
SELECT * FROM ref;

-- ----- 2) Users whose organization_id is NOT the same as that profile -----
WITH ref AS (
  SELECT p.organization_id AS admin_organization_id, p.id AS admin_profile_id
  FROM public.profiles p
  WHERE lower(trim(p.email)) = lower(trim('rommellibunao524@gmail.com'))  -- <-- EDIT (same email)
  LIMIT 1
)
SELECT
  p.id,
  p.email,
  p.organization_id AS user_organization_id,
  r.name AS role_name,
  ref.admin_organization_id,
  (p.organization_id = ref.admin_organization_id) AS org_matches_admin
FROM public.profiles p
CROSS JOIN ref
LEFT JOIN public.roles r ON r.id = p.role_id
WHERE ref.admin_organization_id IS NOT NULL
  AND p.organization_id IS DISTINCT FROM ref.admin_organization_id
ORDER BY p.email;

-- ----- 3) Optional: single-tenant — set all other users to admin's org -----
-- I-review muna ang result ng query #2. I-uncomment lang kung sigurado ka.
/*
WITH ref AS (
  SELECT p.organization_id AS admin_organization_id, p.id AS admin_profile_id
  FROM public.profiles p
  WHERE lower(trim(p.email)) = lower(trim('rommellibunao524@gmail.com'))
  LIMIT 1
)
UPDATE public.profiles p
SET
  organization_id = ref.admin_organization_id,
  updated_at = now()
FROM ref
WHERE p.id IS DISTINCT FROM ref.admin_profile_id
  AND p.organization_id IS DISTINCT FROM ref.admin_organization_id;
*/
