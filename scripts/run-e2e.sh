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
# A suite reported as CRASHED that passes on its own is usually the checkout
# rate limiter, not a bug: it allows 40 orders per 10 minutes per caller, the
# whole battery comes from one address, and a long run legitimately spends
# that budget. The limiter is doing its job — 40 checkouts in ten minutes from
# one IP is abusive for a real shop. Re-run the named suite standalone to
# confirm before chasing it, and see lib/rate-limit.ts.
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PICS_DIR="${PICS_DIR:-.e2e-fixtures}"
ROUND="${1:-}"

# Five suites upload real files. Generate them if they are not there yet.
if [ ! -f "$PICS_DIR/pad-front.png" ]; then
  node scripts/make-test-fixtures.mjs "$PICS_DIR" >/dev/null
fi

SUITES=(
  smoke
  a-to-z client-area account-space account-edit
  catalog-admin catalog-pipeline product-photos
  discovery search seo security server-cart
  banners category-images svg-uploads catalog-authoring storefront-fixes
  admin-crud simple-journey mobile nav catalog-filters emails reviews loop
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
