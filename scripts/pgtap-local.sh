#!/usr/bin/env bash
# pgTAP local para Nexo Contable.
# Levanta un PostgreSQL desechable en /tmp, instala stubs mínimos de Supabase
# (auth, storage, pgtap), aplica TODAS las migraciones en orden y corre
# supabase/tests/*.sql sin tocar ningún proyecto remoto.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PG_PORT:-54339}"
DB="nexo_pgtap"

if [ "$(id -u)" -eq 0 ]; then
  PG_RUN_USER="${PG_RUN_USER:-postgres}"
  if ! id "$PG_RUN_USER" >/dev/null 2>&1; then
    echo "Como root hace falta el usuario '$PG_RUN_USER' (paquete postgresql)." >&2
    exit 1
  fi
  STAGE="$(mktemp -d /tmp/nexo-pgtap-stage.XXXXXX)"
  mkdir -p "$STAGE/repo/supabase" "$STAGE/repo/scripts"
  cp -a "$ROOT/supabase/migrations" "$ROOT/supabase/tests" "$STAGE/repo/supabase/" 2>/dev/null || true
  cp -a "${BASH_SOURCE[0]}" "$STAGE/repo/scripts/pgtap-local.sh"
  chmod -R a+rX "$STAGE"
  chown -R "$PG_RUN_USER":"$PG_RUN_USER" "$STAGE"
  echo "== Re-ejecutando como $PG_RUN_USER (escenificado en $STAGE)"
  exec setpriv --reuid "$PG_RUN_USER" --regid "$PG_RUN_USER" --clear-groups \
    env PG_PORT="$PORT" PGTAP_KEEP="${PGTAP_KEEP:-0}" \
    bash "$STAGE/repo/scripts/pgtap-local.sh" "$@"
fi

find_bindir() {
  local candidate
  if [ -n "${PG_BINDIR:-}" ] && [ -x "$PG_BINDIR/initdb" ]; then
    printf '%s\n' "$PG_BINDIR"
    return 0
  fi
  if command -v initdb >/dev/null 2>&1; then
    dirname "$(command -v initdb)"
    return 0
  fi
  for candidate in /usr/lib/postgresql/*/bin /usr/local/pgsql/bin; do
    if [ -x "$candidate/initdb" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  echo "No encuentro initdb. Instala postgresql o define PG_BINDIR." >&2
  return 1
}

BINDIR="$(find_bindir)"
PSQL="${PSQL_BIN:-$BINDIR/psql}"
WORK="$(mktemp -d /tmp/nexo-pgtap.XXXXXX)"
DATA="$WORK/data"
SOCK="$WORK/sock"
LOG="$WORK/postgres.log"
mkdir -p "$SOCK"

cleanup() {
  local status=$?
  if [ -f "$DATA/postmaster.pid" ]; then
    "$BINDIR/pg_ctl" -D "$DATA" -m immediate -w stop >/dev/null 2>&1 || true
  fi
  if [ "${PGTAP_KEEP:-0}" != "1" ]; then
    rm -rf "$WORK"
  fi
  exit "$status"
}
trap cleanup EXIT

"$BINDIR/initdb" -D "$DATA" -U postgres --auth=trust --no-instructions >/dev/null
"$BINDIR/pg_ctl" -D "$DATA" -l "$LOG" -w -o "-p $PORT -k $SOCK -c listen_addresses=''" start >/dev/null
"$PSQL" -h "$SOCK" -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -c "create database \"$DB\""

"$PSQL" -h "$SOCK" -p "$PORT" -U postgres -d "$DB" -X -q -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgtap with schema extensions;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz default now()
);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(auth.jwt() ->> 'sub', '')
  )::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(auth.jwt() ->> 'role', ''), current_user)
$$;
grant execute on function auth.jwt(), auth.uid(), auth.role() to anon, authenticated, service_role;

create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
SQL

"$PSQL" -h "$SOCK" -p "$PORT" -U postgres -d "$DB" -X -q -c "alter database \"$DB\" set search_path = \"\$user\", public, extensions"

echo "== Migraciones"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$migration")"
  "$PSQL" -h "$SOCK" -p "$PORT" -U postgres -d "$DB" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$migration"
done

echo "== Tests pgTAP"
failed=0
for test_file in "$ROOT"/supabase/tests/*_test.sql; do
  name="$(basename "$test_file")"
  out="$WORK/$name.out"
  set +e
  "$PSQL" -h "$SOCK" -p "$PORT" -U postgres -d "$DB" -X -q -v ON_ERROR_STOP=1 -f "$test_file" >"$out" 2>&1
  rc=$?
  set -e
  read -r ok bad < <(awk '/^[[:space:]]*not ok [0-9]+/ { bad++; next } /^[[:space:]]*ok [0-9]+/ { ok++ } END { printf "%d %d\n", ok+0, bad+0 }' "$out")
  echo "   $name: $ok ok, $bad fallidos (psql=$rc)"
  if [ "$rc" -ne 0 ] || [ "$bad" -ne 0 ] || [ "$ok" -eq 0 ]; then
    failed=1
    grep -E 'not ok [0-9]+|ERROR:|Looks like you failed' "$out" >&2 || true
  fi
done

if [ "$failed" -ne 0 ]; then exit 1; fi
echo "Todo en verde."
