# Code quality, errors, and security (0.6.x)

## 1. Code quality and standards (0.6.1)

| Field | Implementation |
|-------|----------------|
| **Standards** | React function components; hooks; keep modules under `frontend/src/pages` and `frontend/src/lib`; match existing file style (JSX + double quotes where already used). |
| **Linter** | ESLint with `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`. |
| **Formatter** | Prettier (single source of formatting truth). |
| **Config files** | `frontend/eslint.config.js`, `frontend/.prettierrc`. |

**Acceptance:** `npm run lint` passes; `npm run format` produces no diff on committed files.

---

## 2. Error handling (0.6.2)

| Field | Implementation |
|-------|----------------|
| **Global UI** | `frontend/src/components/ErrorBoundary.jsx` wraps the app in `main.jsx` to avoid white-screen crashes. |
| **API errors** | `frontend/src/lib/errors.js` — `getErrorMessage(err)` for consistent copy; used in `Login.jsx`, inventory load, audit page, notification bell. |
| **Logging** | Use browser devtools during development; production logging can be extended (Sentry, etc.) — not bundled by default. |

**Roadmap:** centralize HTTP/error shape if a Node BFF is added later.

---

## 3. Security (0.6.3)

| Field | Implementation |
|-------|----------------|
| **Input validation** | Form-level checks in UI; PostgreSQL constraints and enums on write; prefer parameterized queries via Supabase client (no raw string SQL in browser). |
| **Encryption** | Passwords handled by Supabase Auth; TLS in transit to Supabase; use **anon** key in browser, **never** service role in client. |
| **Auth protection** | `ProtectedRoute` / `RoleGuard` in `App.jsx`; RLS on tables in migration. |
| **API security** | JWT on every authenticated PostgREST call; Edge Function `invite-user` verifies Admin before service-role actions. |

**Platform:** Enable Supabase Auth rate limits, CAPTCHA if needed, and secure redirect URLs in project dashboard.

---

## 4. Revision

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-04-19 | Initial 0.6 alignment. |
