# Process checklist ↔ repository

This maps your template sections (0.1–0.7) to **where it is satisfied in this repo** and what is still **partial / external**.

| ID | Topic | Status | Where to find / notes |
|----|-------|--------|------------------------|
| 0.1.1 | System requirements | **Documented** | `docs/SYSTEM_REQUIREMENTS.md` — §8 optional for solo/academic; BRD + §9 revision history. |
| 0.1.2 | System architecture | **Documented** | `docs/SYSTEM_ARCHITECTURE.md`, `openapi/openapi.yaml` v2. |
| 0.2.1 | Development environment | **Documented** | `docs/DEVELOPER_SETUP.md` §1; run `frontend` with Node + npm. |
| 0.2.2 | IDE / editor | **Documented + tooling** | `docs/DEVELOPER_SETUP.md` §2; ESLint + Prettier in `frontend/`; optional `.vscode/extensions.json`. |
| 0.2.3 | Dependency management | **Applied** | `frontend/package-lock.json`; use `npm ci` in CI. |
| 0.2.4 | Environment variables | **Documented + template** | `frontend/.env.example`; client reads `VITE_*` in `frontend/src/lib/supabase.js`. |
| 0.3.1 | Version control | **Documented** | `docs/DEVELOPER_SETUP.md` §3 — initialize Git locally, connect remote, follow branch/PR rules. |
| 0.4.1 | Build / automation | **Applied + CI** | `frontend` scripts `build` / `lint`; `.github/workflows/frontend-ci.yml`. |
| 0.5.1 | Database setup | **Applied** | `backend/supabase/migrations/001_inventory_setup.sql`, `database-schema.md`. |
| 0.5.2 | Multi-tenancy | **Applied** | `organizations` + `organization_id` on profiles and tenant tables; RLS + triggers in `backend/supabase/migrations/008_multi_tenancy.sql`. See `SYSTEM_REQUIREMENTS.md` BR-14. |
| 0.5.3 | Authentication | **Applied** | Supabase Auth; `frontend/src/contexts/AuthContext.jsx`. |
| 0.5.4 | Authorization | **Applied** | RLS in migration; UI `frontend/src/lib/roleAccess.js` + `App.jsx`. |
| 0.5.5 | API base | **Applied** | PostgREST + Edge Functions; see `SYSTEM_ARCHITECTURE.md` §5 and OpenAPI. |
| 0.6.1 | Code quality / standards | **Documented + lint/format** | `docs/CODE_QUALITY_AND_SECURITY.md` §1; `npm run lint` / `npm run format`. |
| 0.6.2 | Error handling | **Applied** | `ErrorBoundary` + `frontend/src/lib/errors.js` (`getErrorMessage`) on login, inventory, audit, notifications. |
| 0.6.3 | Security | **Documented + platform** | `docs/CODE_QUALITY_AND_SECURITY.md` §3; RLS + server-side admin checks in Edge Functions. |
| 0.7.1 | Logging / audit | **DB + Admin UI** | `audit_logs` + triggers; Admin page `/audit-logs`. Apply migration `002_audit_logs_rls.sql` for secure reads. |
| 0.7.2 | Files / attachments | **Applied** | `storageUpload.js` + Receive batch modal; run **`004_storage_attachments.sql`**. |
| 0.7.3 | Notifications | **Applied** | RLS + `create_notification` (**`003`**, **`005`**); `NotificationBell`; optional Realtime. |

---

## Roadmap: “fully aligned” sa template (0.1–0.7)

### A. Verify / ops (last mile — walang bagong feature)

| # | Gawain | Bakit |
|---|--------|--------|
| 1 | **Supabase SQL:** na-run na ang **`001`** (o buong setup), **`002`**, **`003`**, **`004`**, **`005`** | Parehong tugma ang DB at ang docs. |
| 2 | **Edge Function:** `invite-user` naka-deploy (`supabase functions deploy invite-user`) kung ginagamit ang Users page | Hindi automatic ang invite kung hindi naka-deploy. |
| 3 | **GitHub:** `git push` ang latest; **Actions** → **Frontend CI** green | Proof ng build + lint sa remote. |
| 4 | **`.env`:** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` tama; **huwag** i-commit ang secrets | App tumatakbo sa lahat ng machine. |

### B. Documentation / school deliverable (opsyonal)

| # | Gawain |
|---|--------|
| 5 | **`SYSTEM_REQUIREMENTS.md` §9:** isang linya kung “v1.0 complete” + petsa (kung hiningi ng rubric). |
| 6 | **Staging:** hiwalay na Supabase project + `.env.staging` lang kung required ng subject (idagdag sa `DEVELOPER_SETUP.md`). |
| 7 | **Export PDF** ng `docs/` kung kailangan i-submit. |

### C. Lang kung kailangan ng course / enterprise

| Topic | Tanda |
|-------|--------|
| **0.5.2 Multi-tenancy** | Hindi kasama sa v1 (BR-14). Malaking schema change — gawin lang kung explicit na requirement. |
| **Realtime notifications** | Supabase → Database → **Replication** → i-enable ang `notifications` para live updates sa bell. |
| **Iba pang pages** (Purchase Orders, Receive, …) na i-wire sa Supabase | Hiwalay na sprint; hindi kasama sa checklist table kung mock UI pa. |

### D. I-lock ang release

Kung tama na sa subject: **Git tag** (hal. `v1.0.0`), archive ng repo ZIP + PDF docs.
