#!/usr/bin/env bash
#
# The whole end-to-end battery, in the order it is meant to run.
#
#   npm run build && npm start        # in one terminal
#   bash scripts/run-e2e.sh           # in another
#
# The e2e-emails suite needs the server started with a mail transport pointed
# at its own stand-in, or it skips itself (which is a pass, not a silence — a
# shop with no mail configured is a valid state). To exercise it:
#
#   EMAIL_FROM="Shop <x@y.tn>" RESEND_API_KEY=test \
#   RESEND_API_URL=http://localhost:8788/emails npm start
#
# Run it against a production build, not `next dev`. Development mode injects
# stylesheets through JavaScript in a way the site's own Content-Security-Policy
# refuses, and React double-invokes effects there — both produce failures that
# do not exist in the built app, and chasing them wastes an afternoon.
#
# Every suite prints "N passed, M failed" and exits non-zero on a failure.
# Suites are independent and clean up after themselves; they run in series
# because several of them place real orders and move real stock.
#
# A suite reported as CRASHED or failing that passes on its own is usually a
# rate limiter, not a bug. The whole battery comes from one address, so it
# spends one caller's budget, and the limiters are doing exactly their job.
# Two of them bite:
#
#   checkout — 40 orders per 10 minutes. Trips inside a single long run,
#   because the battery places roughly that many orders.
#
#   signup — 20 accounts per hour, and this one counts ATTEMPTS, so a refused
#   signup still spends from it. Eight suites create accounts (a-to-z,
#   security and loop twice each), which is around a dozen per pass: one
#   battery is safely under, three back-to-back inside the hour are not. The
#   symptom is a suite that needs an account failing at the moment it asks for
#   one — server-cart "the account was not created", loop "it is stored with a
#   hashed password" — while every suite before it passed.
#
# The windows live in process memory, so restarting the server clears both;
# that is the confirmation step, not a fix. Re-run the named suite standalone
# before chasing it, and see lib/rate-limit.ts.
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PICS_DIR="${PICS_DIR:-.e2e-fixtures}"
ROUND="${1:-}"

# Five suites upload real files. Generate them if they are not there yet.
if [ ! -f "$PICS_DIR/pad-front.png" ]; then
  node scripts/make-test-fixtures.mjs "$PICS_DIR" >/dev/null
fi

# Put the stock back before starting.
#
# The battery buys ~25 real parts per pass and nothing replaces them, so the
# fixture products sell out over a few runs and suites begin failing on a shop
# that is working perfectly — the first symptom is a `null` product and a
# "Cannot read properties of null (reading 'slug')" three suites in.
#
# `SEED_RESET_STOCK=1` has existed for exactly this since the seed was written
# (see the comment on the product upsert) and restores only the demo
# quantities: prices, photos and anything edited in the admin are untouched.
# It was never wired in here, so it depended on somebody remembering, and
# nobody did — the database reached 11 of 55 products with any stock at all.
#
# Guarded to a local server. A battery is allowed to rewrite its own fixtures;
# it is not allowed to rewrite a real shop's stock, and BASE_URL is the only
# thing here that knows which one it is pointed at.
case "$BASE_URL" in
  http://localhost:*|http://127.0.0.1:*)
    SEED_RESET_STOCK=1 npm run db:seed >/dev/null 2>&1 \
      && echo "stock restored to the seeded quantities" \
      || echo "WARNING: could not restore stock — suites may fail on sold-out fixtures"
    ;;
  *)
    echo "non-local BASE_URL ($BASE_URL) — stock NOT restored"
    ;;
esac

SUITES=(
  smoke
  a-to-z client-area account-space account-edit
  catalog-admin catalog-pipeline product-photos
  discovery search search-coverage seo security trust server-cart
  banners category-images svg-uploads catalog-authoring storefront-fixes
  admin-crud simple-journey mobile nav catalog-filters local-search tax emails contact analytics
  product-depth product-page checkout cleanup loop
)

total=0; failed=0; bad=""
for s in "${SUITES[@]}"; do
  out=$(BASE_URL="$BASE_URL" PICS_DIR="$PICS_DIR" node "scripts/e2e-$s.mjs" 2>&1)
  [ -n "$ROUND" ] && printf '%s\n' "$out" > "e2e-$ROUND-$s.log"

  res=$(printf '%s\n' "$out" | grep -oE "[0-9]+ passed, [0-9]+ failed" | tail -1)
  if [ -z "$res" ]; then
    # The smoke test predates the shared reporter and just says it finished.
    if printf '%s\n' "$out" | grep -q "ALL CHECKS DONE"; then
      res="ok (smoke)"
    else
      res="CRASHED: $(printf '%s\n' "$out" | tail -2 | head -1 | cut -c1-90)"
      bad="$bad $s"
    fi
  fi

  p=$(printf '%s\n' "$res" | grep -oE "^[0-9]+")
  f=$(printf '%s\n' "$res" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+")
  total=$((total + ${p:-0}))
  failed=$((failed + ${f:-0}))
  [ "${f:-0}" != "0" ] && bad="$bad $s"
  printf '%-20s %s\n' "$s" "$res"
done

echo
echo "TOTAL: $total passed, $failed failed${bad:+ | needs work:$bad}"
[ -z "$bad" ] && [ "$failed" -eq 0 ]
