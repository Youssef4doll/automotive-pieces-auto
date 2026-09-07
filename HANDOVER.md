# Handover — Automotive Pièces Auto

A parts shop for Tunisia: find the right part for your car, buy it, track it.
Next.js 16 App Router, Prisma, PostgreSQL, one deployable app that serves both
the storefront and the admin.

This document is for whoever picks the project up next. It says how to run it,
what the important decisions were and why, what is finished, and — the part
worth reading first — what is not.

---

## 1. Getting it running

```bash
npm install                 # postinstall runs `prisma generate`
cp .env.example .env        # then fill in the values below
npm run db:migrate          # 15 migrations
npm run db:seed             # catalogue, vehicles, demo customer, admin
npm run dev                 # http://localhost:3000
```

Use the `npm run` scripts rather than a bare `prisma …`: the CLI is a local
dependency, not a global command, so `prisma migrate deploy` in a fresh shell
gets "command not found" on every platform. `npx prisma …` works too.

**Environment.** `.env.example` is the reference and explains each one.

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Pooled connection — hostname carries `-pooler` on Neon, port 6543 + `?pgbouncer=true` on Supabase. |
| `DATABASE_URL_UNPOOLED` | Direct connection. Used only by `prisma migrate`. Required wherever `DATABASE_URL` is pooled — **Vercel included**; see below. |
| `SESSION_SECRET` | Signs the session cookie. Long and random. |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin, for sitemap/OG/canonicals. Falls back to `VERCEL_URL`. |

**Seeded logins.** These are development defaults committed in `prisma/seed.ts`
and printed when it runs. **Change the admin password before any real
deployment** — it is in a public repository.

- Admin: `admin@automotive-pieces-auto.tn` / `admin1234`
- Demo customer: `karim.bensalah@example.com` / `client1234`

`npm run build` runs `prisma migrate deploy` before `next build`, so a deploy
migrates itself.

**If a deploy fails with `P1012 — Environment variable not found:
DATABASE_URL_UNPOOLED`**, that variable is missing from the host, not from the
code. The schema declares it as the migration connection, and `prisma migrate
deploy` validates it up front before touching a database — `prisma generate`
does not need it and runs fine without it, so this only ever bites the migrate
step (which is the one `npm run build` runs). On Vercel: Settings →
Environment Variables → add it to Production, Preview and Development, then
redeploy. The value:

- **Neon** — the same string as `DATABASE_URL` with `-pooler` dropped from the
  hostname; same user, password, database and port.
- **Supabase** — same credentials on host `db.<ref>.supabase.co`, port 5432 —
  or the "Session pooler" string on port 5432 if your network is IPv4-only.

`scripts/prisma.mjs` wraps the CLI and takes one case off the table: when
`DATABASE_URL_UNPOOLED` is absent and `DATABASE_URL` is *not* pooled, the two
would be the same string, so it fills it in. When it can see a pooler in the
URL — `pgbouncer=true`, a `-pooler`/`pooler.` host, or port 6543 — it refuses
and prints what to set and where, because copying a pooled URL across would
trade a clear "variable not found" for a migration that fails half-way through
against a real database. It only applies this check ahead of `migrate`, for
the same reason: applying it to `generate` too would fail `npm install`'s
postinstall hook on any host whose `DATABASE_URL` is pooled, even though
`generate` had nothing to complain about — a real bug in an earlier draft of
this wrapper, caught by testing it standalone rather than only through `npm`.

---

## 2. The test battery

23 Playwright suites, ~900 checks, driving real browsers against a real
database. They are the main safety net and they have caught more real bugs
than they have cost.

```bash
npm run build && npm start     # one terminal
bash scripts/run-e2e.sh        # another
```

**Run it against a production build, not `next dev`.** Development mode
injects stylesheets through JavaScript in a way the site's own
Content-Security-Policy refuses, and React double-invokes effects there. Both
produce failures that do not exist in the built app. This cost an afternoon
once; the note is here so it does not cost another.

Five suites upload real files. `scripts/run-e2e.sh` generates them with
`scripts/make-test-fixtures.mjs` if they are missing — deterministic PNGs, no
image library, nothing to check in.

There is also a unit battery for the SVG upload gate, which is the one place
untrusted files are parsed:

```bash
npx tsx --require ./scripts/lib/server-only-shim.cjs scripts/test-svg-upload.mts
```

The shim exists because the module starts with `import "server-only"`, which
nothing outside Next resolves.

Suites are independent, run in series (several place real orders and move real
stock), and clean up after themselves.

---

## 3. How it is put together

```
src/app/(site)/     storefront          src/lib/data/    all database reads
src/app/admin/      admin               src/lib/         session, search, money,
src/app/actions/    server actions                       rate limits, shipping…
src/app/api/        images, part icons  prisma/          schema, 15 migrations
src/components/     UI                  scripts/         the 22 e2e suites
```

**26 Prisma models.** The ones worth knowing: `Product`, `Category` (two levels
— family then subcategory, and the storefront renders exactly two),
`ProductFitment` (which engines a part fits — the site's core promise),
`Order` + `OrderItem` + `OrderStatusEvent` (status history is events, not a
column), `MediaAsset` and `ProductImage` (uploaded images as `Bytes` in
Postgres, served by `/api/images/[id]`).

### Decisions that will look strange until you know why

**Images live in Postgres, not on disk.** The host has no persistent
filesystem. `/api/images/[id]` serves them with a one-year immutable cache;
replacing a picture means a new row with a new id, so the cache never needs
busting.

**A vector's URL ends in `.svg`.** `/api/images/<id>.svg`. That suffix is
load-bearing: `next/image` reads it and serves the file as-is instead of
sending it to the optimiser, which refuses SVG and answers 400. One character
is why every `<Image>` on the site renders an uploaded icon without knowing it
is one.

**SVG uploads are refused, not sanitised.** SVG is a document format that
happens to draw. A script element, an event handler, a `foreignObject`, an
entity declaration, a CDATA section, an external reference — any of them
refuses the file and names what caused it. A sanitiser that strips what it
recognises ships whatever it does not. `src/lib/image-upload.ts`.

**Product photos stay raster; category icons, brand logos and banners take
SVG.** A photograph gains nothing from a vector, and it is the one upload path
where the file is a picture rather than a drawing.

**Shipping is computed in one module.** `src/lib/shipping.ts`. It used to be
written out separately in the checkout form and in the action that charges it,
and not at all on the cart — which is how the cart came to show a "Total" that
was not the total. A quoted price and a charged price have to be the same
number by construction.

**Delivery is flat.** 8 DT anywhere in Tunisia, free over a threshold the admin
sets, free for pickup. Not governorate-dependent, which is what makes it safe
to state in the cart before an address is known.

**Empty categories are hidden from shoppers and shown to admins.** A tile that
opens onto nothing is a dead end; but an admin who adds a category and sees the
home page unchanged assumes it failed. Admins see the whole catalogue with
empty families badged "masquée · vide". `getMegaMenu(includeEmpty)`.

**Out-of-stock parts sort last, never off.** They are real references the shop
carries and they say plainly that they are out. They just stop leading the
aisle.

**The navigation carries a picture per category, and TecDoc is not in it.**
The phone menu is a drill-down list — families with pictures, tap one and the
screen becomes that family's subcategories — and the desktop flyout carries the
same pictures. Each comes from the category's own uploaded image, falling back
to `/api/part-icon/[slug]`, so the placeholder is already in place and a real
photo replaces it with no code change.

The vehicle sheet is shaped like the ones the big European catalogues run, and
that is all it borrows. Those are driven by TecDoc — a licensed commercial
vehicle and fitment database — with a number-plate box that queries a national
register. This shop has no TecDoc subscription and there is no consultable
register for Tunisian plates, so neither is here: the lists are the shop's own
`VehicleMake`/`VehicleModel`/`VehicleEngine` rows, and the picker says in one
line why there is no plate box rather than leaving people hunting for it. The
local equivalent is the carte grise, which is the first card on the "I don't
know" path. See the header comment in `VehiclePicker.tsx`.

**A "most popular makes" panel exists but is data-gated.** It only renders when
the sixth-ranked make genuinely holds more parts than the seventh. Today it
does not — seven of the ten makes cover 52 parts each, because most of the
catalogue is generic servicing kit — so the picker shows one alphabetical list
and the panel stays hidden. It turns itself on if the catalogue ever
specialises. Ranking seven tied numbers would have been an alphabetical
tie-break dressed as a recommendation.

**A part with no photo is drawn, not illustrated with something else.** Every
seeded product points at the hero artwork — a photograph of engine oil. So a
brake disc's page showed a bottle of oil. `/api/part-icon/[slug]` serves the
line drawing for the part's own family instead. It disappears the moment a real
photo is uploaded. Drawings live in `src/lib/part-icons.ts`, shared with the
category tiles so the two cannot drift.

**Forms are controlled, not uncontrolled.** React resets an uncontrolled form
once its action settles, so one rejected price used to hand back a blank form.
Actions echo the submitted values and the form repopulates from them.

**The rate limiter is one Node process and one map.** Honest about it in its
own doc comment: across several instances each keeps its own count, so the
ceiling multiplies by instance count. Moving to Redis means replacing `hit()`
and nothing else.

**`src/proxy.ts`, not `middleware.ts`.** Next 16 renamed it. It sets a
per-request nonce-based CSP. `api/images/` and `api/part-icon/` are excluded:
they serve no HTML, and they set their own stricter policy which the site-wide
one would otherwise overwrite.

---

## 4. What is actually finished

Working and covered by tests:

- Catalogue with two-level categories, brands, vehicle fitment, fuzzy search
  (pg_trgm + unaccent), reference lookup, search suggestions.
- Vehicle picker: "I know my car" / "I don't know which it is", saved to a
  garage, used to filter compatibility across the site.
- Cart, guest checkout, cash on delivery, order tracking with per-step
  timestamps, reorder.
- Customer account: dashboard, orders, garage, previously-bought parts, profile
  with a change history, help.
- Admin: products with photos, categories with pictures, brands with logos,
  vehicles, stock, orders, customers, banners, CSV import, quality checks,
  analytics, settings.
- Security: nonce CSP, HSTS, nosniff, frame-deny, permissions policy, bcrypt,
  `__Host-` session cookie, rate limits on login/signup/checkout/lookup,
  honeypot and timing checks on public forms, ownership checks on order access.
- SEO: per-page metadata, canonicals, sitemap, robots, llms.txt, structured
  data, breadcrumbs, OG images.

---

## 5. What is not — read this part

Ordered by what it costs the shop.

### 5.1 No product has a photograph — 0 of 55

This is the biggest single problem and it is data, not code. Every product
falls back to a family drawing, which is honest but is not a photograph. A
parts shop where nothing has a picture will not convert.

**The upload works and is tested.** Admin → Stock → open a product → Photos.
Up to 8 per product, JPEG/PNG/WebP/AVIF, 4 MB each. Nothing has been uploaded
yet.

The same is true everywhere else a picture can go, and every one of them has a
working upload form and an honest stand-in until it is used:

| Where | Uploaded | Admin page | Stand-in until then |
|---|---|---|---|
| Product photos | 0 of 55 | Stock → product → Photos | the family line drawing |
| Category pictures | 0 of 144 | Catalogue | the family line drawing |
| Parts-brand logos | 0 of 19 | Catalogue → Marques | the brand's name |
| Vehicle-make logos | 0 of 10 | Catalogue → Véhicules | the make's initials |

Category pictures are the cheapest win of the four: sixteen images put a real
photograph on every row of the phone menu and the desktop flyout, which is the
first screen most shoppers touch.

### 5.2 The catalogue is thin

55 active products, 44 in stock, across 16 families and 128 subcategories — 99
of those subcategories hold nothing. Empty ones are hidden from shoppers so
there are no dead ends, but a customer who opens two categories sees the same
handful of parts. Vehicle coverage is 10 makes / 22 models / 25 engines, which
is narrow for Tunisia. Fitment data itself is good: 1,159 rows covering 52 of
55 products.

### 5.3 The home page is long on a phone

About 7,000px, roughly eight screens. The top-seller row swipes and the vehicle
shortcuts show 6 of 12 on a phone, which took roughly 1,300px out of it.
Cutting further means removing content rather than rearranging it, which is a
merchandising decision, not an engineering one.

### 5.4 Smaller things

- **Lint has 14 pre-existing errors**, nearly all the newer
  `react-hooks/set-state-in-effect` rule firing on forms that clear themselves
  after a server action settles. No test or build step gates on them. Worth a
  dedicated pass; they are not bugs today.
- **The hero placeholder is still cut at 320px.** It fits from 390px up. A
  320px screen is a first-generation iPhone SE.
- **Analytics is first-party and minimal** (`AnalyticsEvent`). There is no
  funnel reporting beyond what `/admin/analytics` shows.
- **No automated CI.** The battery is run by hand. Wiring `scripts/run-e2e.sh`
  into CI needs a Postgres service and a built app.

---

## 6. Working on it

**Read the comments.** The codebase explains *why* far more than *what* —
most non-obvious lines say what was tried, what broke, and what a customer or
admin experienced. That is the fastest way in.

**`AGENTS.md` is written by `next dev`.** It re-appears if you delete it.
Commit it with your work rather than fighting it.

**Two traps that cost real time:**

1. **Building while a dev server is running** poisons the Turbopack cache and
   `next build` can silently produce the *old* component. If a change is not
   showing up in production, `rm -rf .next` and rebuild, then grep the build
   output for a distinctive string from your change before you believe it.
2. **A phone grows its layout viewport** to fit content wider than the screen,
   so a too-wide row zooms the whole page out instead of showing a scrollbar.
   Comparing `scrollWidth` to `innerWidth` cannot see this — both grow
   together. Assert `window.innerWidth === deviceWidth` instead.

**When you change a listing, a price or an upload, run the battery.** It is
fifteen minutes and it has repeatedly caught things that looked fine in a
browser.

---

## 7. House rules this project follows

These came from the shop owner and are worth keeping:

- **Never invent data.** No fake products, stock, reviews, sales, demand,
  delivery dates, payment status, compatibility, vehicle specs, tracking
  numbers, phone numbers or customer details. Render what exists; show an empty
  state when nothing does.
- **No fake urgency and no fake discounts.** A promotion appears only when it
  is backed by a real record. "Best seller" appears only when real sales data
  says so.
- **Say what is true about stock and fitment.** Out-of-stock says so.
  Compatibility is claimed only where the fitment table backs it, and parts with
  no fitment data are shown apart rather than hidden or claimed.
