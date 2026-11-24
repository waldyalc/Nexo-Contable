#!/usr/bin/env bash
set -euo pipefail

# Enlaza .env.local y work/ desde la raíz del repo principal si existen (sin copiar secretos a git)
MAIN_ROOT="$(git rev-parse --path-format=absolute --git-common-dir | xargs dirname)"
if [ -f "$MAIN_ROOT/.env.local" ] && [ ! -f ".env.local" ]; then
  ln -s "$MAIN_ROOT/.env.local" ".env.local"
fi
if [ -d "$MAIN_ROOT/work" ] && [ ! -e "work" ]; then
  ln -s "$MAIN_ROOT/work" "work"
fi
if [ ! -d "node_modules" ] && [ -d "$MAIN_ROOT/node_modules" ]; then
  pnpm install --frozen-lockfile --prefer-offline || pnpm install
fi
