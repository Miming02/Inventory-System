# Inventory System

Web inventory operations UI backed by **Supabase** (PostgreSQL, Auth, RLS, Edge Functions).

## Quick start

1. Copy `frontend/.env.example` to `frontend/.env` and set your Supabase URL and anon key.  
2. `cd frontend` → `npm install` → `npm run dev`.

## Documentation (aligned with project checklist 0.1–0.7)

Start here: **[docs/README.md](docs/README.md)** — requirements, architecture, compliance table, developer setup, code quality, and system services.

## Repository layout

| Path | Purpose |
|------|---------|
| `frontend/` | React + Vite SPA |
| `backend/supabase/migrations/` | Canonical SQL migration |
| `supabase/functions/` | Edge Functions (e.g. `invite-user`) |
| `docs/` | BRD, architecture, compliance, setup |
| `openapi/openapi.yaml` | Supabase-facing API contract |
