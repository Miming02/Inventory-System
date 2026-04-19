# System architecture

**Document ID:** ARCH-INV-001  
**Version:** 1.0  
**Applies to:** Repository state as of 2026-04-19  
**Companion:** `docs/SYSTEM_REQUIREMENTS.md` (BRD)  
**Process index:** [docs/README.md](./README.md) · [Checklist compliance](./CHECKLIST_COMPLIANCE.md) · [Developer setup](./DEVELOPER_SETUP.md)

This document replaces informal or aspirational descriptions elsewhere: the **implemented** system is **Supabase-first**. Any Node “modular monolith” tree described historically is **optional future** work (see appendix).

---

## 1. Executive summary

| Layer | Technology | Responsibility |
|-------|------------|------------------|
| Client | React 18, Vite 5, React Router 7 | SPA UI, client-side role guards, Supabase JS client |
| Auth | Supabase Auth (GoTrue) | Email/password, sessions, JWT access tokens |
| API | PostgREST (built into Supabase) + Row Level Security | CRUD on `public` tables; policy-enforced data access |
| Serverless | Supabase Edge Functions (Deno) | Privileged flows (e.g. `invite-user` with service role) |
| Data | PostgreSQL 15+ (managed by Supabase) | Schema, triggers, RLS, audit |

---

## 2. Logical architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React SPA)                      │
│  AuthContext ──► @supabase/supabase-js (anon key + JWT)      │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase project                        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Auth (JWT)   │  │ PostgREST    │  │ Edge Functions     │ │
│  │              │  │ /rest/v1/*   │  │ /functions/v1/*    │ │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘ │
│         │                 │                     │           │
│         └─────────────────┼─────────────────────┘           │
│                           ▼                                  │
│                    PostgreSQL + RLS                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend structure (implemented)

| Area | Location | Notes |
|------|----------|--------|
| Entry | `frontend/src/main.jsx`, `frontend/index.html` | Vite bootstrap; Tailwind via CDN per `frontend/README.md` |
| Routing | `frontend/src/App.jsx` | Public `/login`; protected routes; `RoleGuard` uses `canAccessPath` |
| Auth state | `frontend/src/contexts/AuthContext.jsx` | Session + `profiles` + `roles` join |
| RBAC helpers | `frontend/src/lib/roleAccess.js` | Canonical roles and path permissions |
| Data client | `frontend/src/lib/supabase.js` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Features | `frontend/src/pages/**` | Dashboard, inventory, warehouse flows, POs, users |

---

## 4. Backend / data structure (implemented)

| Area | Location | Notes |
|------|----------|--------|
| Schema + RLS + triggers | `backend/supabase/migrations/001_inventory_setup.sql` | Source of truth for DDL; copy also in `supabase-setup.sql` |
| Edge Function | `supabase/functions/invite-user/index.ts` (and duplicate under `backend/supabase/functions/` if present) | Admin invite; verifies JWT; uses service role server-side |
| Logical ERD narrative | `database-schema.md` | Documents domains; note `profiles` + `auth.users` supersede older `users` narrative where they differ |

**Key PostgreSQL artifacts**

- `public.current_role_name()` — stable helper for RLS policies.  
- `audit_trigger()` — writes to `audit_logs` on selected tables.  
- `update_inventory_stock()` — maintains `inventory_items.current_stock` from movements.

---

## 5. API design (actual)

There is **no** custom Node HTTP server in this repository. Client integration uses:

1. **Supabase Auth** — SDK methods (`signInWithPassword`, `signOut`, session refresh). REST shape is defined by Supabase; see [Supabase Auth docs](https://supabase.com/docs/guides/auth).  
2. **PostgREST** — Resource-oriented access to tables and views under `/rest/v1/`. Headers: `apikey` (anon or service), `Authorization: Bearer <access_token>`, optional `Prefer` for representation.  
3. **Edge Functions** — HTTPS `POST` (typical) to `/functions/v1/<name>` with `Authorization: Bearer <access_token>` unless deployed with `--no-verify-jwt` (still verified in code for `invite-user`).

**Machine-readable contract:** `openapi/openapi.yaml` in this repo describes the **current** integration surface (PostgREST resources + `invite-user`). It **does not** describe a separate `localhost:3000` REST server.

**Standard response patterns**

- PostgREST success: JSON array or object body; errors as JSON with `message` / `hint` / `code`.  
- Edge Function `invite-user`: JSON `{ ok, userId }` or `{ error }` with appropriate HTTP status.

**Status codes (typical)**

| Code | Meaning |
|------|---------|
| 200 | Read/update success; invite success |
| 201 | Created (PostgREST insert with return=representation) |
| 400 | Validation / invite failure |
| 401 | Missing/invalid JWT |
| 403 | RLS or Admin-only function denied |
| 404 | Resource not found (PostgREST) |

---

## 6. Data flow (examples)

**Login**

1. User submits email/password → `supabase.auth.signInWithPassword`.  
2. Supabase returns session with access token stored by client SDK.  
3. `AuthContext` loads `profiles` row and resolves `role_name` for guards.

**Read inventory**

1. Client `from('inventory_items').select(...)`.  
2. PostgREST evaluates RLS: authenticated read allowed; writes restricted by role.

**Admin invites user**

1. Client calls Edge Function with user JWT.  
2. Function validates Admin via `profiles` + `roles`.  
3. Function uses service role to `inviteUserByEmail` and updates `profiles`.

---

## 7. Technology stack

| Concern | Choice |
|---------|--------|
| Language (UI) | JavaScript (React) |
| Build | Vite |
| HTTP / realtime client | `@supabase/supabase-js` |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Policy layer | PostgreSQL RLS |
| Serverless | Deno on Supabase Edge |

---

## 8. Scalability and operations

- **Horizontal scale:** Supabase scales managed Postgres and connection pooling; client is stateless SPA.  
- **Security:** Secrets (`service_role`, etc.) only on server (Edge Function env); browser uses **anon** key + user JWT.  
- **Schema evolution:** Use Supabase migrations (`backend/supabase/migrations/`) for repeatable environments.

---

## 9. Revision history

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | 2026-04-19 | Architecture aligned with Supabase-first implementation; OpenAPI scope corrected. |

---

## Appendix A — Optional future Node backend (not implemented)

A layered Node (e.g. Nest/Express) **Backend-for-Frontend** could sit between the SPA and Postgres if you need opaque server logic, third-party integrations, or non-PostgREST contracts. That pattern is **not** required for the current MVP, which uses Supabase directly. The folder tree in an older `backend/README.md` narrative is a **template only** until code and `package.json` exist for that server.
