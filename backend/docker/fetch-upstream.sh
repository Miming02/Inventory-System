#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ -d upstream ]]; then
  echo "upstream/ already exists. Remove first to re-fetch."
  exit 0
fi

rm -rf supabase-git-tmp supabase-src.tgz

if ! command -v git >/dev/null 2>&1; then
  echo "Install git or use tarball path manually."
  exit 1
fi

echo "=== Git sparse: docker/ only ==="
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/supabase/supabase.git supabase-git-tmp
(
  cd supabase-git-tmp
  git sparse-checkout init --cone
  git sparse-checkout set docker
  git checkout
)
mv supabase-git-tmp/docker upstream
rm -rf supabase-git-tmp
[[ -f upstream/.env.example ]] && cp -f upstream/.env.example .env.example
echo "Done. Next: cp .env.example .env && docker compose up -d"
