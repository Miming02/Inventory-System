# Development environment, Git, and build

## 1. Development environment (0.2.1)

| Field | Value |
|-------|--------|
| **Programming language** | JavaScript (ES modules) for the SPA; SQL for migrations; TypeScript/Deno for Edge Functions under `supabase/functions/`. |
| **Framework** | React 18, Vite 5, React Router 7. |
| **SDKs / tools** | Node.js **18+** (LTS recommended), npm; [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations and functions deploy. |
| **Local setup** | From repo root: `cd frontend` → `npm install` → copy `frontend/.env.example` to `frontend/.env` → set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → `npm run dev`. |
| **Staging (optional)** | Create a separate Supabase project; point `frontend/.env.staging` or env-specific files at that project’s URL/keys; same build. |

**Verify:** app loads at Vite dev URL; login works against your Supabase project.

---

## 2. IDE and editor (0.2.2)

| Field | Recommendation |
|-------|------------------|
| **IDE** | VS Code or Cursor. |
| **Extensions** | ESLint, Prettier (optional: EditorConfig). Repository includes `.vscode/extensions.json` suggestions. |
| **Linter** | ESLint flat config: `frontend/eslint.config.js`. Run `npm run lint`. |
| **Formatter** | Prettier: `frontend/.prettierrc`. Run `npm run format`. |
| **Debugger** | Use VS Code “JavaScript Debug Terminal” or attach to Chrome for the Vite dev server. |

---

## 3. Version control (0.3.1)

| Field | Policy |
|-------|--------|
| **Tool** | Git. |
| **Repository** | Project root includes `.gitignore`; run `git init` once if you clone without `.git`, then add remote on GitHub/GitLab/Azure DevOps. |
| **Branch strategy** | `main` — production-ready; `develop` — integration (optional); `feature/<short-name>` — short-lived features; `fix/<short-name>` — bugfixes. |
| **Commits** | Conventional Commits encouraged, e.g. `feat:`, `fix:`, `docs:`, `chore:`. |
| **Pull requests** | Require description, linked checklist item or ticket, and green CI before merge to `main`. |

---

## 4. Build and automation (0.4.1)

| Field | Location |
|-------|----------|
| **Build tool** | Vite (`vite build`). |
| **Scripts** | `frontend/package.json` — `dev`, `build`, `preview`, `lint`, `format`. |
| **CI** | `.github/workflows/frontend-ci.yml` — install, lint, build on push/PR. |
| **Config** | `frontend/vite.config.js` (if present) or Vite defaults from `package.json`. |

---

## 5. Dependency and package management (0.2.3)

- **Package manager:** npm.  
- **Lock file:** commit `frontend/package-lock.json`.  
- **Install:** `npm ci` in CI; `npm install` locally when adding packages.

---

## 6. Revision

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-04-19 | Initial alignment doc for template 0.2–0.4. |
