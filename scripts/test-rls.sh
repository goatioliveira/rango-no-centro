#!/usr/bin/env bash
# Sobe um Postgres temporário, aplica as migrations e roda os testes de RLS.
# Requer Postgres (initdb/pg_ctl/psql) instalado localmente.
set -eo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PATH="$PGBIN:$PATH"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"

# O Postgres não roda como root; nesse caso usa o usuário "postgres" do sistema.
AS=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$TMP"
  AS=(runuser -u postgres --)
fi

cleanup() { "${AS[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"${AS[@]}" "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"${AS[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null

PSQL=(psql -X -q -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$ROOT/supabase/tests/_stub_supabase.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ aplicando $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/rls_test.sql" 2>&1 | sed -E "s/^psql:[^ ]+ NOTICE:  /  /"
