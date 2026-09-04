#!/usr/bin/env bash
# Test MTN frontend flow: send OTP → verify OTP → subscribe → show DB row
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3002/api/v1}"
MSISDN="${MSISDN:-27123456789}"
PLAN_ID="${PLAN_ID:-26801220000007963}"
OTP="${OTP:-}"

echo "============================================"
echo " MTN Frontend Flow Test"
echo " baseUrl : $BASE_URL"
echo " msisdn  : $MSISDN"
echo " plan_id : $PLAN_ID"
echo "============================================"
echo ""

echo "=== Step 1: Send OTP ==="
SEND_RES=$(curl -s -X POST "$BASE_URL/mtn/otp/send" \
  -H "Content-Type: application/json" \
  -d "{\"msisdn\":\"$MSISDN\"}")
echo "$SEND_RES" | python -m json.tool 2>/dev/null || echo "$SEND_RES"
echo ""

if [ -z "$OTP" ]; then
  echo "Enter OTP from SMS (or re-run with OTP=1234):"
  read -r OTP
fi

echo "=== Step 2: Verify OTP ==="
VERIFY_RES=$(curl -s -X POST "$BASE_URL/mtn/otp/verify" \
  -H "Content-Type: application/json" \
  -d "{\"msisdn\":\"$MSISDN\",\"otp\":\"$OTP\"}")
echo "$VERIFY_RES" | python -m json.tool 2>/dev/null || echo "$VERIFY_RES"
echo ""

echo "=== Step 3: Subscribe ==="
SUB_RES=$(curl -s -X POST "$BASE_URL/mtn/subscribe" \
  -H "Content-Type: application/json" \
  -d "{\"msisdn\":\"$MSISDN\",\"plan_id\":\"$PLAN_ID\"}")
echo "$SUB_RES" | python -m json.tool 2>/dev/null || echo "$SUB_RES"
echo ""

echo "=== Step 4: DB check (subscription_misdns latest row) ==="
node -e "
const { Client } = require('pg');
const c = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'root',
  database: 'gameshub-local',
});
const msisdn = '$MSISDN';
c.connect()
  .then(() => c.query(
    'SELECT id, msisdn, plan_id, status_code, status_message, amount_charged, created_at FROM subscription_misdns WHERE msisdn = \$1 ORDER BY id DESC LIMIT 1',
    [msisdn]
  ))
  .then((r) => {
    if (!r.rows.length) console.log('No row found for msisdn yet.');
    else console.table(r.rows);
    return c.end();
  })
  .catch((e) => { console.error(e.message); process.exit(1); });
"
