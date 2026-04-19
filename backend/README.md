# Backend (implemented): Supabase

This repository’s **live backend** is **Supabase**: PostgreSQL, Row Level Security (RLS), Auth, PostgREST, and Edge Functions. There is **no** separate Node HTTP server checked in here.

## Where things live

| Asset | Path |
|--------|------|
| Schema, RLS, triggers, seeds | `backend/supabase/migrations/001_inventory_setup.sql` |
| Duplicate / SQL editor script | `supabase-setup.sql` (keep in sync with migrations when possible) |
| Edge Function: invite user | `supabase/functions/invite-user/index.ts` |
| Architecture + API intent | `docs/SYSTEM_ARCHITECTURE.md` |
| Requirements (modules, roles, BR) | `docs/SYSTEM_REQUIREMENTS.md` |
| OpenAPI (PostgREST + invite-user) | `openapi/openapi.yaml` |

## Runtime model

1. **Browser** uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` and the user’s JWT from Supabase Auth.  
2. **Data** is accessed via PostgREST (`/rest/v1/...`); **policies** enforce access per role (`current_role_name()`).  
3. **Privileged flows** (e.g. inviting users with the service role) run in **Edge Functions**, not in the client.

Deploy functions with the Supabase CLI, for example:

`supabase functions deploy invite-user`

## Optional future: Node BFF / modular monolith

If you later add a Node layer (e.g. NestJS + Prisma) as a **Backend-for-Frontend** or integration hub, you can use a structure like the tree below. That is **not** part of the current codebase until `package.json` and source files exist under `backend/src/`.

```text
backend/   (future — illustrative only)
  src/
    app.ts
    modules/
      auth/
      inventory/
    ...
  prisma/
    schema.prisma
```

Until then, treat **Supabase migrations + RLS + Edge Functions** as the backend implementation.
