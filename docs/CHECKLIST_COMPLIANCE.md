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
| 0.5.2 | Multi-tenancy | **Deferred (v1)** | Single-organization scope; see `SYSTEM_REQUIREMENTS.md` BR-14. No `tenant_id` in schema. |
| 0.5.3 | Authentication | **Applied** | Supabase Auth; `frontend/src/contexts/AuthContext.jsx`. |
| 0.5.4 | Authorization | **Applied** | RLS in migration; UI `frontend/src/lib/roleAccess.js` + `App.jsx`. |
| 0.5.5 | API base | **Applied** | PostgREST + Edge Functions; see `SYSTEM_ARCHITECTURE.md` §5 and OpenAPI. |
| 0.6.1 | Code quality / standards | **Documented + lint/format** | `docs/CODE_QUALITY_AND_SECURITY.md` §1; `npm run lint` / `npm run format`. |
| 0.6.2 | Error handling | **Applied** | `ErrorBoundary` + `frontend/src/lib/errors.js` (`getErrorMessage`) on login, inventory, audit, notifications. |
| 0.6.3 | Security | **Documented + platform** | `docs/CODE_QUALITY_AND_SECURITY.md` §3; RLS + server-side admin checks in Edge Functions. |
| 0.7.1 | Logging / audit | **DB + Admin UI** | `audit_logs` + triggers; Admin page `/audit-logs`. Apply migration `002_audit_logs_rls.sql` for secure reads. |
| 0.7.2 | Files / attachments | **Applied** | `storageUpload.js` + Receive batch modal; run **`004_storage_attachments.sql`**. |
| 0.7.3 | Notifications | **Applied** | RLS + `create_notification` (**`003`**); `NotificationBell` on dashboard; optional Realtime. |

---

## Roadmap: “fully aligned” sa template (0.1–0.7)

Sundin ang order na ito — **documentation** muna para tumugma ang papel, tapos **implementation** kung gusto mong isara ang natitirang partial.

### A. Verify / ops (walang bagong feature)

1. **Supabase:** Na-run na ba ang `002_audit_logs_rls.sql`? (Audit page + secure `audit_logs`.)
2. **GitHub:** Naka-push ang latest; green ba ang **Actions** tab para sa `Frontend CI`?
3. **Env:** `frontend/.env` may tamang `VITE_SUPABASE_*` (hindi i-commit ang secrets).

### B. Documentation only (kung kailangan ng “complete” na papel)

4. **Revision history:** Sa `SYSTEM_REQUIREMENTS.md` §9, magdagdag ng entry kapag may malaking release (petsa + summary).
5. **Staging (opsyonal):** Kung hinihingi ng rubric, magdagdag ng maikling seksyon sa `DEVELOPER_SETUP.md` o hiwalay na `docs/STAGING.md`: hiwalay na Supabase project + env file naming.
6. **Checklist:** Balikan ang table sa itaas pagkatapos ng bawat milestone; i-update ang **Status** column.

### C. Implementation — natitira (optional)

| ID | Status |
|----|--------|
| **0.7.2 / 0.7.3 / 0.6.2** | Implemented in repo — run SQL **`003_notifications_rls.sql`** and **`004_storage_attachments.sql`** sa Supabase. |
| **0.5.2** Multi-tenancy | Deferred maliban kung kailangan — BR-14. |

### D. Kung “tama na” na sa subject mo

Kung ang rubric ay **docs + running app + Git + DB**, maaari mong i-lock ang release: **i-tag ang Git**, i-export ang PDF mula sa `docs/`, at itala sa §9 na **v1.0 complete** na ang scope.
