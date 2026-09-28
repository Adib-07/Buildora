#!/usr/bin/env bash
# Manual smoke test for the staff API. Not part of `pnpm test`; kept out of the
# suite because it needs a running dev server on a chosen port.
#
#   pnpm exec next dev --port 3199 &
#   bash scripts/smoke-api.sh 3199
#
# Several checks deliberately mutate rows (attendance version bumps, a resolved
# dispute, a triage). The database is reset first so the script is re-runnable
# and a second run asserts the same things as the first. Set SKIP_RESET=1 to
# reuse the current state, in which case the mutating checks may report 409s
# because their precondition is genuinely gone.
set -uo pipefail

BASE="http://127.0.0.1:${1:-3199}"
PW='buildora-dev-password'
pass=0; fail=0

if [ "${SKIP_RESET:-0}" != "1" ]; then
  echo "resetting the local database so this run starts from seed state..."
  pnpm db:reset >/tmp/buildora-db-reset.log 2>&1 \
    || { echo "db reset failed; see /tmp/buildora-db-reset.log" >&2; exit 1; }
  echo
fi

jar() { echo "/tmp/buildora-jar-$1"; rm -f "$(jar "$1")"; }
# Rebuild a Cookie header from the Set-Cookie lines curl wrote to the jar.
cookie() {
  grep -i '^set-cookie:' "$1" 2>/dev/null \
    | sed -E 's/^[Ss]et-[Cc]ookie:[[:space:]]*([^=;]+)=([^;]*).*/\1=\2/' \
    | paste -sd'; ' -
}

login() {
  local who="$1" file
  file="$(jar "$who")"
  curl -s -D "$file" -o /dev/null -X POST "$BASE/api/v1/auth/login" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$who\",\"password\":\"$PW\"}"
}

# check <label> <expected-status> <method> <path> [cookie-file] [body]
check() {
  local label="$1" want="$2" method="$3" path="$4" jarfile="${5:-}" body="${6:-}"
  local args=(-s -o /tmp/buildora-body.json -w '%{http_code}' -X "$method" "$BASE$path")
  [ -n "$jarfile" ] && args+=(-H "cookie: $(cookie "$jarfile")")
  [ -n "$body" ] && args+=(-H 'content-type: application/json' -d "$body")
  local got
  got="$(curl "${args[@]}")"
  if [ "$got" = "$want" ]; then
    printf '  ok   %-52s %s\n' "$label" "$got"; pass=$((pass+1))
  else
    printf '  FAIL %-52s want %s got %s\n     %s\n' \
      "$label" "$want" "$got" "$(head -c 300 /tmp/buildora-body.json)"; fail=$((fail+1))
  fi
}

TODAY="$(date -u +%F)"
SITE_B_HAZARD='5a000001-0000-4000-8000-000000000001'   # belongs to site A
SITE_B_WORKER='0c000001-0000-4000-8000-000000000001'   # belongs to site A
SITE_A_WORKER='0c000001-0000-4000-8000-000000000001'

echo "== authentication =="
login supervisor@quarryridge.test; SUP=/tmp/buildora-jar-supervisor@quarryridge.test
login engineer@quarryridge.test;   ENG=/tmp/buildora-jar-engineer@quarryridge.test
login owner@quarryridge.test;      OWN=/tmp/buildora-jar-owner@quarryridge.test
login supervisor@harbourworks.test; BSUP=/tmp/buildora-jar-supervisor@harbourworks.test
check 'me as supervisor' 200 GET /api/v1/me "$SUP"
check 'me without session' 401 GET /api/v1/me
check 'login bad password' 401 POST /api/v1/auth/login '' '{"email":"supervisor@quarryridge.test","password":"nope"}'
check 'login malformed email' 422 POST /api/v1/auth/login '' '{"email":"x","password":""}'

echo "== teams & workers =="
check 'teams' 200 GET /api/v1/teams "$SUP"
check 'workers' 200 GET /api/v1/workers "$SUP"
check 'workers filtered by team' 200 GET '/api/v1/workers?teamId=0a000001-0000-4000-8000-000000000001' "$SUP"
check 'workers active=true' 200 GET '/api/v1/workers?active=true' "$SUP"
check 'workers bad cursor ignored' 200 GET '/api/v1/workers?cursor=not-a-cursor' "$SUP"
check 'workers bad teamId rejected' 422 GET '/api/v1/workers?teamId=abc' "$SUP"
check 'create worker (supervisor)' 200 POST /api/v1/workers "$SUP" \
  '{"fullName":"Smoke Test Worker","phone":"+919812340001","teamId":"0a000001-0000-4000-8000-000000000001","lang":"en"}'
check 'create worker (engineer forbidden)' 403 POST /api/v1/workers "$ENG" \
  '{"fullName":"Should Not Exist","phone":"+919812340002","teamId":"0a000001-0000-4000-8000-000000000001","lang":"en"}'
check 'create worker bad phone' 422 POST /api/v1/workers "$SUP" \
  '{"fullName":"Bad Phone","phone":"98123","teamId":"0a000001-0000-4000-8000-000000000001","lang":"en"}'
check 'create worker cross-site team' 422 POST /api/v1/workers "$SUP" \
  '{"fullName":"Cross Site","phone":"+919812340003","teamId":"0b000001-0000-4000-8000-000000000001","lang":"en"}'

echo "== IDOR: site B must never reach site A =="
check 'site B lists workers' 200 GET /api/v1/workers "$BSUP"
check 'site B reads site A worker' 404 PATCH "/api/v1/workers/$SITE_B_WORKER" "$BSUP" '{"active":false}'
check 'site B reads site A hazard' 404 GET "/api/v1/hazards/$SITE_B_HAZARD" "$BSUP"
check 'site B reads site A attendance' 200 GET "/api/v1/days/$TODAY/attendance" "$BSUP"

echo "== attendance =="
check 'day attendance' 200 GET "/api/v1/days/$TODAY/attendance" "$SUP"
check 'day attendance bad date' 422 GET '/api/v1/days/28-09-2026/attendance' "$SUP"
check 'day attendance unknown date' 404 GET '/api/v1/days/2020-01-01/attendance' "$SUP"
check 'patch attendance (supervisor)' 200 PATCH /api/v1/attendance/2a000001-0000-4000-8000-000000000009 "$SUP" \
  '{"hours":8.5,"expectedVersion":1}'
check 'patch attendance stale version' 409 PATCH /api/v1/attendance/2a000001-0000-4000-8000-000000000010 "$SUP" \
  '{"hours":8,"expectedVersion":99}'
check 'patch attendance (engineer forbidden)' 403 PATCH /api/v1/attendance/2a000001-0000-4000-8000-000000000011 "$ENG" \
  '{"hours":8,"expectedVersion":1}'
check 'patch attendance bad hours' 422 PATCH /api/v1/attendance/2a000001-0000-4000-8000-000000000011 "$SUP" \
  '{"hours":7.3,"expectedVersion":1}'
check 'patch locked day' 423 PATCH /api/v1/attendance/2a000001-0000-4000-8000-000000000001 "$SUP" \
  '{"hours":8,"expectedVersion":1}'

echo "== tasks =="
check 'day tasks' 200 GET "/api/v1/days/$TODAY/tasks" "$SUP"
check 'draft tasks from text' 200 POST /api/v1/tasks/draft "$SUP" \
  '{"text":"Ask Ramesh to plaster Block B. Lakshmi Devi to fix the leaking pipe in Block A."}'
check 'draft tasks (engineer forbidden)' 403 POST /api/v1/tasks/draft "$ENG" '{"text":"do something"}'
check 'approve tasks' 200 POST /api/v1/tasks/approve "$SUP" \
  "{\"workDate\":\"$TODAY\",\"tasks\":[{\"title\":\"Smoke approved task\",\"location\":\"Block A\",\"ownerWorkerId\":\"$SITE_A_WORKER\"}]}"
check 'approve tasks unknown owner' 422 POST /api/v1/tasks/approve "$SUP" \
  "{\"workDate\":\"$TODAY\",\"tasks\":[{\"title\":\"Ghost owner\",\"location\":null,\"ownerWorkerId\":\"0d000001-0000-4000-8000-000000000001\"}]}"
check 'approve tasks on locked day' 423 POST /api/v1/tasks/approve "$SUP" \
  "{\"workDate\":\"$(date -u -v-2d +%F)\",\"tasks\":[{\"title\":\"Locked\",\"location\":null,\"ownerWorkerId\":\"$SITE_A_WORKER\"}]}"

echo "== disputes =="
check 'open disputes' 200 GET '/api/v1/disputes?status=open' "$SUP"
check 'all disputes' 200 GET '/api/v1/disputes?status=all' "$SUP"
check 'dispute detail' 200 GET /api/v1/disputes/3a000001-0000-4000-8000-000000000001 "$SUP"
check 'dispute unknown' 404 GET /api/v1/disputes/00000000-0000-4000-8000-000000000000 "$SUP"
check 'resolve dispute invalid outcome' 422 POST /api/v1/disputes/3a000001-0000-4000-8000-000000000001/resolve "$SUP" \
  '{"outcome":"nonsense"}'
check 'resolve dispute upheld needs note' 422 POST /api/v1/disputes/3a000001-0000-4000-8000-000000000001/resolve "$SUP" \
  '{"outcome":"upheld","note":""}'
check 'resolve dispute (engineer forbidden)' 403 POST /api/v1/disputes/3a000001-0000-4000-8000-000000000001/resolve "$ENG" \
  '{"outcome":"corrected","status":"present","hours":6,"late":false}'
check 'resolve dispute corrected' 200 POST /api/v1/disputes/3a000001-0000-4000-8000-000000000001/resolve "$SUP" \
  '{"outcome":"corrected","status":"present","hours":6,"late":false,"note":"Worker is right about leaving early."}'
check 'resolve same dispute twice' 409 POST /api/v1/disputes/3a000001-0000-4000-8000-000000000001/resolve "$SUP" \
  '{"outcome":"upheld","note":"Already handled."}'

echo "== hazards =="
check 'hazard list' 200 GET /api/v1/hazards "$SUP"
check 'hazard list filtered' 200 GET '/api/v1/hazards?status=reported' "$SUP"
check 'hazard list bad date filter' 422 GET '/api/v1/hazards?from=nope' "$SUP"
check 'hazard detail' 200 GET /api/v1/hazards/$SITE_B_HAZARD "$SUP"
check 'triage hazard severity' 200 PATCH "/api/v1/hazards/$SITE_B_HAZARD" "$SUP" '{"severity":1}'
check 'triage hazard assign owner' 200 PATCH "/api/v1/hazards/$SITE_B_HAZARD" "$SUP" \
  "{\"owner\":{\"type\":\"worker\",\"id\":\"$SITE_A_WORKER\"}}"
check 'triage hazard bad severity' 422 PATCH "/api/v1/hazards/$SITE_B_HAZARD" "$SUP" '{"severity":9}'
check 'triage hazard cross-site owner' 422 PATCH "/api/v1/hazards/$SITE_B_HAZARD" "$SUP" \
  '{"owner":{"type":"worker","id":"0d000001-0000-4000-8000-000000000001"}}'
check 'triage hazard (engineer forbidden)' 403 PATCH "/api/v1/hazards/$SITE_B_HAZARD" "$ENG" '{"severity":2}'
check 'triage hazard unknown id' 404 PATCH /api/v1/hazards/00000000-0000-4000-8000-000000000000 "$SUP" '{"severity":2}'

echo "== summaries =="
check 'summary (supervisor forbidden)' 403 GET "/api/v1/summaries/$TODAY" "$SUP"
check 'summary (engineer)' 200 GET "/api/v1/summaries/$TODAY" "$ENG"
check 'summary (owner)' 200 GET "/api/v1/summaries/$TODAY" "$OWN"
check 'summary unknown date' 404 GET '/api/v1/summaries/2020-01-01' "$ENG"

echo "== logout =="
check 'logout' 200 POST /api/v1/auth/logout "$OWN"
check 'me after logout' 401 GET /api/v1/me "$OWN"

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
