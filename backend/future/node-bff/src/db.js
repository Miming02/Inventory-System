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

  // Per-location balances table used by Manage Locations page.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.inventory_item_locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      location VARCHAR(100) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (item_id, location)
    )
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
}

