# Backend — Supabase-first (recommended until deploy)

**Recommendation:** stay on **Supabase only** (Postgres + RLS + Auth + PostgREST + Edge Functions) through your first production deploy. It matches this repo today: the browser calls Supabase with `VITE_SUPABASE_URL` + anon key; **rules and triggers live in SQL migrations**, not in a custom Node `/api/v1` server.

**When to add a Node BFF later:** you need a long-lived integration (ERP webhooks, heavy PDF/CSV jobs, secrets you refuse to put in Edge Functions, or custom rate limits). Until then, a BFF is extra Docker images, auth bridging, and drift risk.

---

## Folder layout (modular, stable)

Run all **Supabase CLI** commands from the **repository root** (`Inventory-System/`) so `supabase/functions/` resolves correctly.

```text
backend/
  README.md                 ← this file
  modules/
    registry.json           ← which migration files belong to which domain (hint for humans/tools)
  docker/
    README.md               ← pointers for self-hosting Supabase in Docker
  future/
    node-bff/               ← empty placeholder; add package.json + src/ only when you adopt a BFF
  supabase/
    migrations/             ← numbered SQL — source of truth for schema + RLS (+ optional seeds)

supabase/                   ← repo root (sibling of backend/)
  functions/
    invite-user/            ← Edge Functions (Deno); deploy: supabase functions deploy invite-user
```

**Edge Functions live at repo root** `supabase/functions/` (not under `backend/supabase/`) so the default Supabase CLI layout works. SQL migrations stay under `backend/supabase/migrations/` as they are today.

---

## Where things live

| Asset | Path |
|--------|------|
| Schema, RLS, triggers, seeds | `backend/supabase/migrations/*.sql` |
| Optional monolithic SQL for SQL editor / legacy | `supabase-setup.sql` (keep aligned with migrations when you change DDL) |
| Edge Function: invite user | `supabase/functions/invite-user/index.ts` |
| Module → migration map | `backend/modules/registry.json` |
| Architecture + API intent | `docs/SYSTEM_ARCHITECTURE.md` |
| OpenAPI (PostgREST + invite-user) | `openapi/openapi.yaml` |

---

## Runtime model

1. **Browser** — `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + user JWT from Supabase Auth.  
2. **Data** — PostgREST `/rest/v1/...`; **RLS** enforces access (`current_role_name()`).  
3. **Privileged flows** — Edge Functions (e.g. invite-user with service role), not the client.

---

## Docker (self-hosted backend)

See **`backend/docker/README.md`**: `fetch-upstream` script → `.env` → `docker compose up` → apply `backend/supabase/migrations/*.sql` → point `frontend/.env` at Kong (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

---

## Optional future: Node BFF

If you add Node, create `backend/future/node-bff/package.json` and `src/modules/...` there, or promote `future/node-bff` → `services/bff`. Do **not** move `backend/supabase/migrations/`; the BFF should call the same Postgres or Supabase service role as needed.
