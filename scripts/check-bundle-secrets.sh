#!/usr/bin/env bash
# Fails if a server-only secret reaches the browser bundle.
#
# Run after `pnpm build`. The publishable key is deliberately absent from
# .next/static as well because no client component reads Supabase yet; if that
# changes, the NEXT_PUBLIC_ inlining is expected and the check should be
# narrowed to server-only names.
set -euo pipefail

DIR="${1:-.next/static}"

if [ ! -d "$DIR" ]; then
  echo "error: $DIR not found. Run 'pnpm build' first." >&2
  exit 1
fi

# Names whose *values* are what matter. Read from .env.local when present so
# the check follows the real configuration rather than a hardcoded list.
declare -a NAMES=(
  SUPABASE_SERVICE_ROLE_KEY
  WEBHOOK_HMAC_SECRET
  JOB_SECRET
  GATEWAY_PASSWORD
  GATEWAY_USER
)

status=0
for name in "${NAMES[@]}"; do
  value="${!name:-}"
  if [ -z "$value" ] && [ -f .env.local ]; then
    # shellcheck disable=SC1091
    value="$(grep -E "^${name}=" .env.local | head -n1 | cut -d= -f2- || true)"
  fi

  if [ -z "$value" ]; then
    printf 'skip   %-26s not set, nothing to search for\n' "$name"
    continue
  fi

  hits="$(grep -rlF -- "$value" "$DIR" 2>/dev/null || true)"
  if [ -n "$hits" ]; then
    printf 'LEAK   %-26s found in:\n%s\n' "$name" "$hits"
    status=1
  else
    printf 'clean  %-26s absent from %s\n' "$name" "$DIR"
  fi
done

if [ "$status" -eq 0 ]; then
  echo "OK: no server-only secret in the client bundle"
else
  echo "FAILED: a server-only secret is in the client bundle" >&2
fi
exit "$status"
