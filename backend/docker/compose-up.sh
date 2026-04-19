#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f upstream/docker-compose.yml ]]; then
  echo "Missing upstream/docker-compose.yml. Run ./fetch-upstream.sh first." >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  echo "Missing .env - copy .env.example to .env" >&2
  exit 1
fi
exec docker compose -f upstream/docker-compose.yml --env-file .env --project-name inventory-supabase "$@"
