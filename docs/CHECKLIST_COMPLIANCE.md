# Process checklist ↔ repository

This maps your template sections (0.1–0.7) to **where it is satisfied in this repo** and what is still **partial / external**.

| ID | Topic | Status | Where to find / notes |
|----|-------|--------|------------------------|
| 0.1.1 | System requirements | **Documented** | `docs/SYSTEM_REQUIREMENTS.md` — stakeholder table §8 to complete manually. |
| 0.1.2 | System architecture | **Documented** | `docs/SYSTEM_ARCHITECTURE.md`, `openapi/openapi.yaml` v2. |
| 0.2.1 | Development environment | **Documented** | `docs/DEVELOPER_SETUP.md` §1; run `frontend` with Node + npm. |
| 0.2.2 | IDE / editor | **Documented + tooling** | `docs/DEVELOPER_SETUP.md` §2; ESLint + Prettier in `frontend/`; optional `.vscode/extensions.json`. |
| 0.2.3 | Dependency management | **Applied** | `frontend/package-lock.json`; use `npm ci` in CI. |
| 0.2.4 | Environment variables | **Documented + template** | `frontend/.env.example`; client reads `VITE_*` in `frontend/src/lib/supabase.js`. |
| 0.3.1 | Version control | **Documented** | `docs/DEVELOPER_SETUP.md` §3 — initialize Git locally, connect remote, follow branch/PR rules. |
| 0.4.1 | Build / automation | **Applied + CI** | `frontend` scripts `build` / `lint`; `.github/workflows/frontend-ci.yml`. |
| 0.5.1 | Database setup | **Applied** | `backend/supabase/migrations/001_inventory_setup.sql`, `database-schema.md`. |
| 0.5.2 | Multi-tenancy | **Deferred (v1)** | Single-organization scope; see `SYSTEM_REQUIREMENTS.md` BR-14. No `tenant_id` in schema. |
| 0.5.3 | Authentication | **Applied** | Supabase Auth; `frontend/src/contexts/AuthContext.jsx`. |
| 0.5.4 | Authorization | **Applied** | RLS in migration; UI `frontend/src/lib/roleAccess.js` + `App.jsx`. |
| 0.5.5 | API base | **Applied** | PostgREST + Edge Functions; see `SYSTEM_ARCHITECTURE.md` §5 and OpenAPI. |
| 0.6.1 | Code quality / standards | **Documented + lint/format** | `docs/CODE_QUALITY_AND_SECURITY.md` §1; `npm run lint` / `npm run format`. |
| 0.6.2 | Error handling | **Partial** | `frontend/src/components/ErrorBoundary.jsx`; standardize API errors over time per doc. |
| 0.6.3 | Security | **Documented + platform** | `docs/CODE_QUALITY_AND_SECURITY.md` §3; RLS + server-side admin checks in Edge Functions. |
| 0.7.1 | Logging / audit | **DB: yes / UI: partial** | `audit_logs` + triggers in migration; no dedicated audit viewer page yet. |
| 0.7.2 | Files / attachments | **Partial** | UI upload affordances; wire to Supabase Storage when ready — see `SYSTEM_SERVICES.md`. |
| 0.7.3 | Notifications | **Partial** | `notifications` table in schema; in-app delivery pipeline not fully wired — see `SYSTEM_SERVICES.md`. |
