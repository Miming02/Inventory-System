import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

export async function dbPing() {
  const result = await pool.query("select 1 as ok");
  return result.rows?.[0]?.ok === 1;
}

export async function ensureCoreTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.users (
      id UUID PRIMARY KEY,
      email TEXT,
      first_name TEXT,
      last_name TEXT,
      avatar_url TEXT,
      role_name TEXT,
      organization_id UUID,
      organization_name TEXT,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Keep external schema aligned with existing frontend expectations.
  await pool.query(`
    ALTER TABLE public.inventory_items
    ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'ingredient'
  `);

  await pool.query(`
    ALTER TABLE public.inventory_items
    ALTER COLUMN current_stock TYPE DECIMAL(14,4) USING current_stock::DECIMAL(14,4),
    ALTER COLUMN current_stock SET DEFAULT 0
  `);

  // Per-location balances table used by Manage Locations page.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (organization_id, name)
    )
  `);

  // Per-location balances table used by Manage Locations page.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.inventory_item_locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      location VARCHAR(100) NOT NULL,
      quantity DECIMAL(14,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (item_id, location)
    )
  `);

  await pool.query(`
    ALTER TABLE public.inventory_item_locations
    ALTER COLUMN quantity TYPE DECIMAL(14,4) USING quantity::DECIMAL(14,4),
    ALTER COLUMN quantity SET DEFAULT 0
  `);

  // Backfill per-location rows from legacy inventory_items.location.
  await pool.query(`
    INSERT INTO public.inventory_item_locations (item_id, location, quantity, updated_at)
    SELECT i.id, TRIM(i.location), GREATEST(COALESCE(i.current_stock, 0), 0), NOW()
    FROM public.inventory_items i
    WHERE i.location IS NOT NULL
      AND TRIM(i.location) <> ''
    ON CONFLICT (item_id, location)
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      updated_at = NOW()
  `);

  // Backfill standalone locations from both modern and legacy sources.
  await pool.query(`
    INSERT INTO public.locations (organization_id, name, updated_at)
    SELECT DISTINCT i.organization_id, l.location, NOW()
    FROM public.inventory_item_locations l
    JOIN public.inventory_items i ON i.id = l.item_id
    WHERE l.location IS NOT NULL
      AND TRIM(l.location) <> ''
    ON CONFLICT (organization_id, name)
    DO UPDATE SET
      updated_at = NOW()
  `);

  await pool.query(`
    INSERT INTO public.locations (organization_id, name, updated_at)
    SELECT DISTINCT i.organization_id, TRIM(i.location), NOW()
    FROM public.inventory_items i
    WHERE i.location IS NOT NULL
      AND TRIM(i.location) <> ''
    ON CONFLICT (organization_id, name)
    DO UPDATE SET
      updated_at = NOW()
  `);
}

