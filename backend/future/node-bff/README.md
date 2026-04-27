# Node BFF (local starter)

Minimal Express API that connects to your external PostgreSQL database (managed via pgAdmin).

## Setup

1. Copy env file:
   - Copy `.env.example` to `.env`
   - Fill in your Postgres password (`PGPASSWORD`)

2. Install deps:
   - `npm install`

3. Run:
   - `npm run dev`

## Endpoints

- `GET /health` → basic server health
- `GET /health/db` → verifies Postgres connectivity (`SELECT 1`)
- `POST /api/db/query` → generic select endpoint for frontend data reads
- `POST /api/db/mutate` → generic insert/update/delete/upsert endpoint for frontend writes

## Frontend integration

The frontend now uses `frontend/src/lib/supabase.js` as a compatibility layer:

- Supabase Auth/Storage remains on Supabase.
- Simple table CRUD calls route to this Node API and external PostgreSQL.
- Complex nested selects and RPC calls temporarily fall back to Supabase until fully migrated.

