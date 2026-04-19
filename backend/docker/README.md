# Docker: Supabase backend (self-hosted)

Ang backend ng app ay **Supabase** sa Docker. Walang Node API dito.

## 1. Kunin ang upstream (isang beses)

```powershell
cd C:\Users\romme\CascadeProjects\Inventory-System\backend\docker
```

**Kung may lumang `supabase-git-tmp` na masyadong malaki (maling full clone dati):**

```powershell
.\delete-supabase-git-tmp.ps1
```

**Fetch:**

```powershell
.\fetch-upstream.ps1
```

Gumagamit ito ng **Git** + sparse checkout ng `docker/` lang. Kailangan ng **Git for Windows**.

**Kung hindi ma-delete ang `supabase-src.tgz`:** `.\delete-supabase-tgz.ps1`

Makakakuha ka ng folder na **`upstream/`** at **`backend\docker\.env.example`**.

## 2. `.env`

```powershell
copy .env.example .env
```

Punan ang secrets: [Supabase self-hosting Docker](https://supabase.com/docs/guides/self-hosting/docker#configuring-and-securing-supabase)

## 3. Start

```powershell
docker compose up -d
```

Kung may error sa `include:`:

```powershell
.\compose-up.ps1 up -d
```

### Isang run: Docker + frontend (mula sa repo root)

```powershell
cd C:\Users\romme\CascadeProjects\Inventory-System
.\dev-all.ps1
```

Una **local Supabase** (`docker compose up -d`), susunod **`npm run dev`** sa `frontend/`. Ihinto: **Ctrl+C** (humihinto ang Vite; ang Docker containers ay naka-detached pa rin — `docker compose ... down` kung gusto mong patayin ang stack).

Kung **cloud** lang ang `frontend/.env` at ayaw mong mag-start ang Docker taun-taon: `.\dev-all.ps1 -SkipDocker`.

## 4. Frontend

Tingnan ang `env.frontend.example` - `VITE_SUPABASE_URL` at `VITE_SUPABASE_ANON_KEY` mula sa `.env`.

### "Invalid login credentials" (local Docker)

Ang **local** Postgres ay **walang** mga user mula sa hosted Supabase. Kailangan mo ng bagong account doon.

1. Siguraduhing tumatakbo ang stack (`.\compose-up.ps1 up -d`).
2. (Inirerekomenda) Ilapat ang schema: `.\apply-migrations.ps1` (type `YES`).
3. Lumikha ng dev user: `.\create-local-dev-user.ps1`  
   Default: email `dev@local.test`, password `LocalDev123!` — puwede mong baguhin:  
   `.\create-local-dev-user.ps1 -Email you@example.com -Password 'YourPass123!'`

Pagkatapos, **i-restart** ang Vite (`npm run dev`) kung binago mo ang `frontend/.env`.

## 5. SQL migrations (opsyonal)

Pagkatapos umandar ang DB, i-apply ang `backend\supabase\migrations\*.sql` o `.\apply-migrations.ps1` (type YES).

---

Troubleshooting: [Self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
