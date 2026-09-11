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
npm run db:migrate          # 16 migrations
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
| `EMAIL_FROM` + `RESEND_API_KEY` *or* `SMTP_*` | Optional. Without them the shop takes orders and tells nobody — see §3. |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin, for sitemap/OG/canonicals — and for every link and picture in the order emails. Set it to the real domain. Falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL` (a per-deployment address, possibly behind deployment protection, where a mail client asking for the logo gets a sign-in page). |

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

26 Playwright suites, ~1000 checks, driving real browsers against a real
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
src/app/api/        images, part icons  prisma/          schema, 16 migrations
src/components/     UI                  scripts/         the 26 e2e suites
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

**The make list is one alphabetical list, and it was a ranked one.** There
used to be a "Marques les mieux fournies" panel of the top six by parts held,
then "Autres marques" — gated so it only appeared when the sixth make
genuinely outstocked the seventh, which on the production catalogue it did.
It was removed anyway. The ranking was real and it was still the wrong shape
for this screen: nobody opens this dialog to browse manufacturers, they open
it holding one specific car, and a coverage ranking obstructs that — you
cannot tell which of two panels your make landed in without reading both.
The part count stays on every row, so coverage is still on screen; it just no
longer decides the order.

**The vehicle picker does not focus its search box on a phone.** Focusing an
input summons the on-screen keyboard, which covers the bottom half of the
screen — and the sheet is bottom-anchored, so tapping "Je connais ma voiture"
opened a keyboard nobody asked for on top of the list of makes. It focuses
only when `matchMedia("(pointer: fine)")` matches, so a mouse or trackpad
still gets it and a phone does not. `e2e-nav.mjs` asserts `document.activeElement`
is not the search box on a touch-emulated context.

**Subcategory browsing is picture tiles, not text rows — one component, three
places.** The desktop mega-menu's flyout panel and the homepage's expanded
family card both answer the same question ("what does this family hold?"),
and used to answer it two different ways: the flyout listed small icons in a
row, the homepage panel listed bare text with a count. Both now use
`SubcategoryTile` — a bigger picture (56px / 48px) with the name below it, no
count on the tile itself. `grid-template-columns: repeat(auto-fill,
minmax(…, 1fr))`, not `auto-fit`: a family with two subcategories should leave
the rest of its row empty rather than stretching two tiles to fill it.

**The category page's filters are one URL, built in one place.** Brands are
checkboxes, OR'd together — it used to be `?brand=slug`, one at a time, and
picking a second replaced the first. `src/lib/catalog-filters.ts` holds the
whole filter state (`brands`, `sort`, `min`, `max`, `stock`) as a
`CatalogFilters` object: `parseFilters` reads it off `searchParams`,
`filterHref(basePath, filters)` writes it back, and every control — the
desktop sidebar, the phone's chip row, the "remove this filter" chips, the
sort select, the price slider — goes through it, so changing one filter can
never drop another. The price slider's ends and the "en stock" count come from
`getCategoryFacets`, for the whole category, so the scale never moves under
the shopper's finger.
`getProductsForCategory`'s `brandSlugs` filters with `{ slug: { in: [...] } }`
— a genuine OR, so ticking Bosch and Valeo shows both, not neither. The
per-brand counts shown beside each checkbox are the whole category's, never
recomputed for the current selection, so unticking one box never makes the
others' numbers move under the shopper's finger. `Checkbox.tsx` draws the
square; the row underneath it is a plain `<Link>`, so the filter still works
with JavaScript off.

**The shop sends mail, or says plainly that it does not.** `src/lib/email.ts`
picks a transport from the environment: `RESEND_API_KEY` talks to Resend over
plain `fetch` (no package to install), or `SMTP_*` uses nodemailer, imported
lazily so only shops that choose that path need `npm i nodemailer`. With
neither set, `sendMail` logs one line and returns `{ ok: false, skipped }`,
and `/admin/parametres` says so in as many words with the variables named.

**Sending is best-effort and may never fail a checkout.** An order already in
the database with its stock claimed is not undone, delayed, or hidden because
a mail server is unreachable. `notifyOrderPlaced` catches everything;
`e2e-emails.mjs` kills the mail server and asserts the order still completes
(it does, in ~120ms). It is awaited rather than left floating, because a
promise still in flight when a serverless function returns is a promise that
gets killed.

**The printable order document is a "Reçu" until the shop has a matricule
fiscal.** In Tunisia an invoice carries the seller's tax number; printing
"Facture" without one is a false claim on a piece of paper somebody may file
for their accounts. Fill `shop_tax_id` in /admin/parametres and the same
document becomes a facture with the matricule on it. It is one document, used
by the customer as their record and by the shop as the note in the box — two
that can disagree is worse than one. `/commande/[ref]/recu`.

**Printing hides chrome by `data-print-hide`, not by tag name.** The first
version of the print stylesheet said `header, footer, nav { display: none }`,
which also hid the receipt's own `<header>` and `<footer>` — the shop name,
the document title, the reference and the payment note all vanished from the
printout. Marking the chrome is the version that cannot reach into a page's
content.

**A review requires a delivered order for that exact part, and a human before
it is public.** `verified` is set by the server from the order history and can
never be sent by the form; `published` defaults to false and `/admin/avis` is
the queue. The product page and the `aggregateRating` in its structured data
both filter on `published`, so an unmoderated review cannot move the number a
search engine quotes. A unique index on `(productId, userId)` is what actually
stops a doubled submit.

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
  (pg_trgm + unaccent), reference lookup, search suggestions. The search
  understands how this shop's customers actually type: "debriyaj", "blaket",
  "zit", and Arabic — دبرياج، فلتر الزيت، بلاكات — all reach the French
  catalogue through the vocabulary in `src/lib/search/synonyms.ts`, including
  Arabic car names. Anything that keeps turning up in
  /admin/analytics → "Demande non satisfaite" belongs in that file. Category pages
  filter by brand (several, OR'd), price band, in-stock, and type, all in the
  URL (`?brand=a,b&min=20&max=120&stock=1&sort=price-asc`) so a filtered page
  can be shared and works with JavaScript off; grid or list view.
- Sign-in / sign-up with "Se souvenir de moi" (off: the session cookie dies
  with the browser) and a real "Mot de passe oublié ?": a one-hour, single-use
  link by e-mail, hashed at rest. Needs the mail transport; without one the
  page says so and shows the shop's contact details instead of a dead form.
- Vehicle picker: "I know my car" / "I don't know which it is", saved to a
  garage, used to filter compatibility across the site.
- Cart, guest checkout, cash on delivery, order tracking with per-step
  timestamps, reorder.
- Customer account: dashboard, orders, garage, previously-bought parts, profile
  with a change history, help.
- Admin: products with photos, categories with pictures, brands with logos,
  vehicles, stock, orders, customers, banners, CSV import, quality checks,
  analytics, settings.
- Order e-mail: confirmation to the customer, alert to the shop, a line when
  the status moves. Off until a transport is configured, and the admin says so.
- A printable receipt (or facture, with a matricule fiscal) for every order,
  shared by the customer and the packing bench.
- Reviews: written only by customers who took delivery of that part, published
  only after the shop reads them, moderated at /admin/avis.
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
| Part references | 0 of 55 | Stock → a product → Références | reference search finds nothing |
| Customer reviews | 0 | arrive from delivered orders | the section is simply absent |

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

### 5.3 The catalogue has no part references — 0 of 55

Every product has an empty `oemRefs`, and `PartReference` holds nothing. The
"J'ai la référence" search — how a mechanic, or anyone holding the old part,
actually shops — therefore finds nothing. **The admin form already takes them**
(Stock → a product → "Références OEM" / "Références aftermarket", comma
separated); this is data entry, not code.

### 5.4 The home page is long on a phone

About 7,000px, roughly eight screens. The top-seller row swipes and the vehicle
shortcuts show 6 of 12 on a phone, which took roughly 1,300px out of it.
Cutting further means removing content rather than rearranging it, which is a
merchandising decision, not an engineering one.

### 5.5 Smaller things

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
