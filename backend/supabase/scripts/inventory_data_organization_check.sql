-- =============================================================================
-- Inventory / tenant data — alin ang organization_id ng rows?
-- =============================================================================
-- Kung pareho na ang profiles.organization_id pero walang KPI si Procurement:
--   (A) Walang rows sa inventory_items, O
--   (B) Nasa IBA ang organization_id ng data kaysa sa users (mali ang UUID sa items).
--
-- Default org mula sa migration 008 (madalas ito ang dapat tumugma sa admin):
--   a0000000-0000-4000-8000-000000000001
--
-- Supabase → SQL Editor. Run isa-isa; basahin ang Results bago mag-UPDATE.
-- =============================================================================

-- ----- A) Ilan ang inventory per organization? -----
SELECT organization_id, COUNT(*) AS item_count
FROM public.inventory_items
GROUP BY organization_id
ORDER BY item_count DESC;

-- ----- B) Sample rows (tingnan ang organization_id column) -----
SELECT id, sku, name, organization_id, current_stock
FROM public.inventory_items
ORDER BY created_at DESC
LIMIT 20;

-- ----- C) Procurement user — may role_id ba? (kung NULL, zero KPI sa dashboard) -----
-- Palitan ang email ng procurement account mo.
SELECT
  p.id,
  p.email,
  p.organization_id AS profile_org,
  p.role_id,
  r.name AS role_name
FROM public.profiles p
LEFT JOIN public.roles r ON r.id = p.role_id
WHERE lower(trim(p.email)) = lower(trim('PROCUREMENT_EMAIL_DITO'))  -- <-- EDIT
LIMIT 1;

-- ----- D) Dapat MAGKAPAREHO ang auth.users.id at profiles.id (kung hindi, walang profile sa app) -----
-- Palitan ang email. Kung walang profile_id o magkaiba ang UUID, ayusin ang profiles row.
SELECT
  au.id AS auth_user_id,
  p.id AS profile_id,
  (au.id = p.id) AS ids_match
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE lower(trim(au.email)) = lower(trim('procurement@gmail.com'));  -- <-- EDIT

-- =============================================================================
-- OPTIONAL FIX 1 — i-align ang inventory sa default org (single tenant)
-- =============================================================================
-- I-run LANG kung nakita mo sa (A) na may rows sa ibang UUID (hindi default),
-- at gusto mong ilipat lahat sa default org.
-- I-uncomment:

/*
UPDATE public.inventory_items
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS DISTINCT FROM 'a0000000-0000-4000-8000-000000000001'::uuid;
*/

-- =============================================================================
-- OPTIONAL FIX 2 — kaugnay na tables (kung nag-migrate ka ng lumang data)
-- =============================================================================
-- Kung may stock_movements / purchase_orders na ibang org pa rin, i-align din.
-- I-uncomment nang paisa-isa pagkatapos i-review ang (A) para sa bawat table.

/*
UPDATE public.stock_movements
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS DISTINCT FROM 'a0000000-0000-4000-8000-000000000001'::uuid;

UPDATE public.purchase_orders
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS DISTINCT FROM 'a0000000-0000-4000-8000-000000000001'::uuid;

UPDATE public.categories
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS DISTINCT FROM 'a0000000-0000-4000-8000-000000000001'::uuid;

UPDATE public.suppliers
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS DISTINCT FROM 'a0000000-0000-4000-8000-000000000001'::uuid;
*/
