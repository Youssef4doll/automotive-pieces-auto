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
npm run db:migrate          # 24 migrations
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

36 Playwright suites, 1,422 checks at the last full green run, driving real
browsers against a real database. They are the main safety net and they have
caught more real bugs than they have cost.

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

Two things that bit, both worth knowing before writing another suite:

- **Never hard-code the thing you are going to buy.** Each pass places ~25 real
  orders and really decrements stock; nothing puts it back. Two suites walked
  to `/catalogue/filtres` and clicked the first "Ajouter au panier", and after a
  day of runs that family sat at zero on all sixteen products — the button was
  disabled and the suite crashed, reporting a stock problem as a mail problem.
  `scripts/lib/stocked-product.mjs` asks the database what is buyable.

  **The same trap has a second shape: over-constraining the fixture.**
  `e2e-product-page` opened by asking for a part with a brand, recorded
  fitment *and* three in stock. It passed alone and crashed as suite 30 of 32,
  because by then no part met all four. The stock clause was not only fragile,
  it was wrong — a part with an empty shelf is buyable now, the shop orders it
  in. Ask for what the test actually needs, and `orderBy` the rest.

- **The battery restocks itself now, and did not before.** Each pass buys ~25
  real parts and nothing replaced them, so the fixtures simply sold out: the
  database reached **11 of 55 products with any stock at all**, and three
  suites that asked for `stockQty > 3` started crashing on a shop that was
  working perfectly. `SEED_RESET_STOCK=1` had existed for exactly this since
  the seed was written — it restores only the demo quantities and leaves
  prices, photos and admin edits alone — but it was never wired in, so it
  depended on somebody remembering. `run-e2e.sh` now runs it before the first
  suite, **guarded to a localhost BASE_URL**: a battery may rewrite its own
  fixtures, never a real shop's stock.

- **A test that waits for the data to suit it is not a test.** Restoring stock
  immediately broke a check that had been passing for months: "buyable parts
  lead" skipped every family that was not *already* a mix of in and out of
  stock, so on a freshly restocked database it examined nothing and its own
  guard caught it — 0 of 13 families checked. It builds the condition now,
  emptying one shelf per family and restoring it on every path out, and
  examines 13 families instead of the 6 that happened to be mixed. Prefer a
  suite that creates its fixture to one that searches for it.

- **Write the rule, not the instance.** After the floating scroll-to-top
  button was caught sitting on the buy button, the obvious test was "that
  button does not overlap that bar". It would have been useless twice over: it
  passed the moment the button was hidden rather than removed, and it said
  nothing about the next floating thing somebody adds. `e2e-mobile` [19] walks
  every element at 390 and 1440, scrolling both ways on two pages, and fails on
  anything `position: fixed` that is not the header or the product page's own
  buy bar — which marks itself with `data-bottom-bar`. Three floating controls
  have now been removed from this site for the same reason; the fourth will be
  caught by a test rather than by somebody noticing in a screenshot. **Check a
  negative test is not vacuous before trusting it**: inject the thing it is
  meant to catch and watch it fail.

- **Staying on the URL is not proof the form worked.** `e2e-loop` called an
  account created because the browser was still on `/compte` after pressing
  the button — which is equally true when the signup is refused and the reason
  is printed above the form. It passed while the very next check, the one that
  looks in the database, failed. Ask for something only the succeeded state
  carries (here the greeting, and no password field left on the page) and pass
  the page text as the failure detail, so the refusal explains itself instead
  of arriving as a puzzle.

- **Two rate limiters bite the battery, and neither is a bug.** They live in
  process memory and count one caller, which is what the whole battery looks
  like from a loopback address. `checkout` allows 40 orders per 10 minutes and
  trips inside a single long run. `signup` allows 20 accounts an hour and
  counts **attempts**, so a refused one still spends from it; eight suites
  create accounts, about a dozen per pass, which means one battery is safely
  under and three inside the hour are not. The symptom is a suite failing at
  the exact moment it asks for an account while everything before it passed.
  Restarting the server clears both windows — that is how you confirm the
  diagnosis, not how you fix it. The header of `run-e2e.sh` says all of this
  where somebody staring at a red line will actually see it.

- **Assert on what was on screen, not on what is on screen now.** A flash is
  invisible to `expect(...).toBe(...)` after the fact: by the time the
  assertion runs, the wrong thing has been replaced by the right one.
  `e2e-checkout` installs a sampler in an init script that records the rendered
  text 125 times a second, and asks afterwards whether the sentence was *ever*
  shown. A slower machine makes that check stricter rather than flakier, which
  is the correct direction for a timing bug.
- **A suite that edits shared state must restore it on every path out.**
  `e2e-emails` sets `shop_email`, crashed before its cleanup once, and left a
  test address in the settings — which flipped the site's contact link from the
  store section to a `mailto:` and crashed a different suite in the next run.
  It now restores on an uncaught exception too.

---

## 3. How it is put together

```
src/app/(site)/     storefront          src/lib/data/    all database reads
src/app/admin/      admin               src/lib/         session, search, money,
src/app/actions/    server actions                       rate limits, shipping…
src/app/api/        images, part icons  prisma/          schema, 23 migrations
src/components/     UI                  scripts/         the 36 e2e suites
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

**TVA is a decomposition; the timbre fiscal is an addition.** `src/lib/tax.ts`.
Catalogue prices are TTC, so the "Sous-total HT" and "TVA 19 %" lines split
money that was already counted — the total on the document is the total that
was charged, and the lines sum to it exactly (the VAT line absorbs the
rounding of both HT figures, deliberately, so a column that does not add up is
impossible). The droit de timbre is the opposite: a real extra dinar, so it is
quoted in the cart and on the checkout summary before it is charged. Both are
switched on by one thing — the shop's matricule fiscal. Without one a trader
cannot charge la TVA and does not issue factures, which is already why the
printed document is titled "Reçu"; with the matricule empty the rate and the
stamp read as zero however they are filled in, and every total reads as it did
before any of this existed.

**The rate and the stamp are snapshotted onto each order.** `Order.vatRate`
and `Order.stampDuty`, written at checkout from the settings then in force.
A rate changed next year must not restate a facture filed this year, and every
order placed before the shop was registered honestly carries 0 — which is why
its document still prints no TVA line at all.

**Empty categories are hidden from shoppers and shown to admins.** A tile that
opens onto nothing is a dead end; but an admin who adds a category and sees the
home page unchanged assumes it failed. Admins see the whole catalogue with
empty families badged "masquée · vide". `getMegaMenu(includeEmpty)`.

**Out-of-stock parts sort last, never off.** They are real references the shop
carries and they say plainly that they are out. They just stop leading the
aisle.

**A card's labels live in one wrapping row, not in two corners.** A part can
fit your car *and* be down to its last few, and both labels are true. Pinned
to opposite corners of the picture they printed on top of each other at phone
width. They now share one flex row: side by side where there is room, stacked
where there is not. `e2e-mobile` [14] measures the bounding boxes rather than
trusting the CSS — with the old pinning restored by hand, 9 of 9 two-label
cards collide.

**The brand's own logo, or its name — never a stand-in.** `Brand.logoUrl` is
uploaded in /admin/catalogue/marques and shown on every card; with none
uploaded the name is set in type instead. A drawn placeholder would be an
invented maker's mark, which is a claim about a manufacturer.

**The list row is built the way the specialist parts catalogues build theirs**
— maker's mark above the picture, name, labels and the reference on one line,
then what the shop actually knows about the part (`Position`, `Réf. OE`, then
`specs`, first four, the rest behind a link), and a price block on the right
carrying the struck-through price, the discount, what the price includes, stock,
the delivery window and a quantity selector beside the button. Ordering in that
spec list is deliberate: a cross-reference is what a mechanic matches a part by,
a height in millimetres is what they check afterwards, so the number must not be
the row pushed off the card.

**Nothing in that block is rendered without data behind it.** `specs` is `{}`
and `oemRefs` is `[]` on every seeded product, so today the row falls back to
the description and prints no spec rows at all. Fill them in from /admin/stock
and they appear. The reference chip likewise appears only when the SKU is not
already inside the name — most of this catalogue is named "Filtre à air KAMOKA
F235701", and a Réf. line under that prints it twice.

**The grid card reserves a fixed height for every row; the list deliberately
does not.** A grid has to read across, so an out-of-stock card keeps the space
its delivery line would occupy. Stacked rows have no neighbour to line up with,
so reserving there is just a gap.

**`<main>` is `flex-1`, never `flex flex-col`.** A column flex container makes
every section a flex item, and `mx-auto` on a flex item does not centre it
inside its container — it shrink-wraps it to its own content and centres that.
Pages laid out as `mx-auto shell-w` therefore rendered at whatever width their
text happened to need: measured at 1920px, the home page's vehicle board came
out 809px instead of 1280 and an empty cart came out 225px. Invisible on a
phone, where content fills the width anyway, and the whole of "the site looks
small on a big screen". `e2e-mobile` [16] measures it.

**The width of the site is `.shell-w`, in one place** — and it follows the
screen rather than sitting at a fixed number. 85% of the viewport above 72rem,
capped at 96rem. A fixed max-width always eats more of a small screen than a
large one: 1280px is 89% of a 1440px laptop and 50% of a 27" monitor, so the
same site read edge-to-edge on one and comfortable on the other. Every band
measures against this, so they line up down the page and changing it is one
edit rather than thirty.

**Columns step where a card would get cramped, not at round viewport numbers.**
The shell follows the screen and the catalogue's sidebar takes a fixed 280px
off the grid, so `xl:grid-cols-4` (1280px) produced 172px cards — a two-up
phone card, on a desktop. Three columns there, four from 1536, five from
`3xl`, which is a custom 1800px breakpoint: about 230px at every desktop width
and never narrower as the screen grows. `3xl` is declared in **rem**, and that
is load-bearing — Tailwind sorts breakpoints by the literal it is given, so a
px value lands in a block ahead of the rem-valued built-ins and `lg:` then
wins at 1800px with the variant compiled and nothing happening.

**The home page's two boards are makes and manufacturers, side by side.**
Which car, then whose part — the two questions a parts shop is navigated by.
The vehicle board listed make+model pairs ("Peugeot 208"), which is a more
precise answer to a question nobody starts with; a shopper knows they drive a
Renault long before they can say which Clio, and the make page one tap on is
where that gets settled. The manufacturers board was an auto-scrolling marquee
of `<div>`s near the footer — nothing clickable, names set in type on navy
where every maker's mark is drawn for white, and you had to wait for the one
you wanted to come round. Both are still grids of links now.

**On a phone the filters are a tab on the edge of the screen.** They were a
button above the grid, which is several screens behind anyone who has scrolled
far enough to want them. `FilterSheet` holds the tab and the sheet; the panel
inside is the desktop sidebar's, passed in rather than rebuilt.

**Every sheet shares `lib/use-sheet.ts`** — scroll position preserved behind
the overlay, the device back button closing the sheet instead of the page, and
Escape. The cart had all three and the filter sheet needed the same three;
two copies would have drifted the first time one was fixed.

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

**The site carries no customer reviews, by decision.** It used to: a form for
customers with a delivered order, and a moderation queue at `/admin/avis` that
published them. The queue was the only control surface — nothing reached the
storefront without it, and nothing could be taken down except through it — so
the shop's request to drop the queue meant dropping the feature, because a
public-writable surface with no take-down path is worse than no reviews at all.
The form, the action, the product-page section, the `aggregateRating` in the
structured data and the `Review` table are all gone (migration
`20260918090000_drop_reviews`, applied against an empty table).

Bringing them back is a feature, not a revert: it needs the write path, the
queue and the table again. What survives is the principle the old code encoded
and `/sources` still states — no star rating is ever declared that the page
cannot show.

**Every listing read is bounded, and the aisle says how much it is showing.**
The category listing had no limit at all: it read every active part in the
family, with each one's fitment ids joined on, and serialised the lot into
`CatalogView` as props. Search has been capped at 40 since it was written, so
this was the one shopper-facing read that could grow without limit. It hands
over `CATALOG_PAGE_SIZE` (48) with a "voir plus" link carrying `?n=`, clamped
at `CATALOG_MAX_SHOWN` (480) so a hand-typed URL cannot ask for the table.

The in-stock-first rule survives the cap because it moved into the query. It
used to be a JavaScript sort *after* fetching everything, which a limit
silently breaks — the cap would take whichever forty-eight rows came back and
reorder only those, leaving a buyable part on row 200 unreachable. It is two
bounded queries now, one for the buyable and one for the rest, concatenated.

**The phrase table holds only phrases that are on a screen.** All three
languages ship in the client bundle — measured, and cheaper than sending the
active one down with every page response — which is exactly why a string
nobody renders is not free. 116 of 435 keys had outlived the screens that used
them; removing them took about 3KB gzipped off the JavaScript of every route.
`scripts/e2e-cleanup.mjs` fails if an unused key appears again. It understands
one indirection: `<T k={`trust.title${n}`} />` builds a family of keys from an
index, so a key whose name is a prefix plus a number counts as used.

**Counts are counted by Postgres.** Two places produced a handful of small
integers by reading whole tables into Node: the catalogue's brand sidebar
(every active product in the family, brand joined on, tallied into a Map) and
the car picker's per-make part counts (the entire `ProductFitment` table,
de-duplicated into a Map of Sets, on every open of the dialog). Both are
`GROUP BY` now. `scripts/e2e-cleanup.mjs` checks the source so the pattern
cannot come back unnoticed.

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
  timestamps, reorder. The checkout is three numbered decisions — who you are,
  how you receive it, how you pay — and **never claims the basket is empty
  until it has read the basket**: it lives in localStorage, so the server
  renders that page knowing nothing, and the empty-basket branch used to reach
  the screen for a measured 301ms on /panier and 35ms on /commande before the
  JavaScript could contradict it. Both now render an outline until the store
  has rehydrated, and a placed order outranks the emptied basket, so the gap
  between confirming and the receipt says "Commande enregistrée" with its
  reference rather than "votre panier est vide".
- Customer account: dashboard, orders, garage, previously-bought parts, profile
  with a change history, help.
- Admin: products with photos, categories with pictures, brands with logos,
  vehicles, stock, orders, customers, banners, CSV import, quality checks,
  analytics, settings.
- Order e-mail: confirmation to the customer, alert to the shop, a line when
  the status moves. Off until a transport is configured, and the admin says so.
- A printable receipt (or facture, with a matricule fiscal) for every order,
  shared by the customer and the packing bench. With the matricule filled in
  it carries the TVA and the timbre fiscal broken out — sous-total HT, frais de
  livraison HT, TVA, timbre, total TTC — and the same five lines appear in the
  order e-mail, on the customer's order page and on the admin's.
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

**The page is now ready for them and was not before.** The gallery used to
crop — `object-cover` inside a square — so every landscape photograph the shop
uploaded would have lost its ends, and on a wiper blade or a hose the shape is
the product. It contains now, on a white plate that never changes, so
photographs with the mixed backgrounds suppliers ship still read as one
catalogue. Upload one and it takes the slot; nothing else has to change.

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
| Manufacturer details | 0 of 19 brands | Catalogue → Marques → Informations fabricant | no manufacturer panel on the product page |

Category pictures are the cheapest win of the four: sixteen images put a real
photograph on every row of the phone menu and the desktop flyout, which is the
first screen most shoppers touch.

### 5.2 The catalogue is thin

55 active products across 16 families and 128 subcategories — 99 of those
subcategories hold nothing. Empty ones are hidden from shoppers so there are
no dead ends, but a customer who opens two categories sees the same handful of
parts. **The home page now prints these figures rather than an invented one**
(§5.aa), so how thin the catalogue is is visible on the front page instead of
being covered up by it. That is the right way round, and it is also the
argument for filling it: the number goes up the moment parts are uploaded. Vehicle coverage is 10 makes / 22 models / 25 engines, which
is narrow for Tunisia. Fitment data itself is good: 1,159 rows covering 52 of
55 products.

### 5.3 The catalogue has no part references — 0 of 55

Every product has an empty `oemRefs`, and `PartReference` holds nothing. The
"J'ai la référence" search — how a mechanic, or anyone holding the old part,
actually shops — therefore finds nothing, and the product page's Références
block is absent on every part. **The admin form already takes them**
(Stock → a product → "Références OEM" / "Références équipementier"); this is
data entry, not code.

OE numbers are entered one carmaker per line, which is how the page groups
them and how the reference page names the maker of a number:

```
RENAULT: 77 01 234 567, 8200123456
PEUGEOT: 1611349280
CITROËN: 1611349280
```

The same number under two carmakers is two rows on purpose — PSA really does
stamp one part for both. A line with no name still works and is published
unattributed rather than filed under a guess. The CSV importer accepts the
same shape in its `oem` column.

### 5.3a No brand says who made the part — 0 of 19

`Brand` now carries manufacturer information — registered name, address,
phone, e-mail, website — and every field is empty. A part whose brand has
none prints no manufacturer panel, which is correct and is also a gap: a
buyer holding a defective part has no manufacturer to write to, and a shop
that ever sells into the EU is obliged to publish it. Catalogue → Marques →
edit a brand → "Informations fabricant". Copy it from what the manufacturer
publishes; nothing here is looked up for you, deliberately.

### 5.4 The home page is long on a phone

About 7,000px, roughly eight screens. The top-seller row swipes and the vehicle
shortcuts show 6 of 12 on a phone, which took roughly 1,300px out of it.
Cutting further means removing content rather than rearranging it, which is a
merchandising decision, not an engineering one.

### 5.5 Smaller things

- **Lint has 13 pre-existing errors**, nearly all the newer
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

### 5.w Availability depends on one field nobody has reviewed yet

Every product now carries `Product.supply`, and it defaults to **ON_ORDER** —
"nothing on the shelf means we order it in". That is how the shop said it
works, and it is why an empty shelf no longer takes the buy button away.

It is a claim, though, and it is made on all 55 products without anyone having
gone through them. Two things to do when there is a spare hour:

1. Mark anything genuinely unsourceable as **UNAVAILABLE** in Admin → Stock →
   the product → "Quand le stock est à zéro". That is the only setting that
   removes the buy button, and it is the honest answer for a discontinued
   reference.
2. Fill in **Délai fournisseur** in Admin → Paramètres. Left empty — which is
   the default, on purpose — a sur-commande part says it is ordered in and says
   nothing about when. Filled in, every one of them quotes it.

Orders for a part with an empty shelf are recorded with `OrderItem.backorder`
set, and the admin order screen marks those lines **À commander** so the
picking bench knows before it starts rather than when it reaches the shelf.

### 5.x No dispatch date is printed anywhere, on purpose

The reference pages this shop is measured against say *Ready for dispatch
Friday (18.09)*. This one says the delivery window instead, and that is a
decision rather than an omission.

A date needs two things nobody has given: a **daily dispatch cut-off** and a
**working calendar** (Sunday, jours fériés). Without them "vendredi 18.09" is
arithmetic wearing the clothes of a commitment — and on cash on delivery a
missed date is not a disappointed customer, it is a courier at a door with
nobody expecting him and an order that comes back. Every figure on the product
page today is one the shop has actually stated: the two delivery windows and
the free-delivery threshold from /admin/parametres, the flat fee from
`lib/shipping` (the same number the cart charges).

Add a cut-off time to the settings and a date can be derived honestly. Until
then the window is the strongest true thing available.

### 5.y Reviews are not coming back by accident

The brief for the product page listed "Reviews" among the sections below the
fold. There are none, and that is not an oversight: the whole review feature
was removed by decision, table included — see the note further down. Re-adding
it means re-adding the moderation queue with it, because that queue was the
only publish *and* take-down path, and a public writable surface with neither
is worse than no reviews.

### 5.z Cloudflare — looked at, and not added

Asked for directly. The answer is no, for a reason that is not a judgement
call: **Cloudflare proxies domains whose nameservers you control, and this
shop is on `automotive-pieces-auto.vercel.app`.** That subdomain belongs to
Vercel. There is nothing to put Cloudflare in front of until the shop buys a
domain and points it here.

If that changes, here is the whole picture, so the decision is not re-derived
from scratch:

**What it would actually buy.** Not caching — every route is `ƒ` dynamic
because `proxy.ts` mints a per-request CSP nonce, so a CDN in front has
nothing to hold. Not DDoS cover that isn't already there; Vercel mitigates
at the edge on every plan. The real gain is narrower and worth naming:
**TLS would terminate in Tunis instead of Europe**, saving a Tunisian shopper
a round trip or two on the first connection of a session. On a phone over
3G that is not nothing. Everything after that first handshake still travels
to Vercel and back.

**What it would cost, concretely — two failure modes, both nameable.**

1. **The rate limiter goes global.** `callerKey()` reads the leftmost
   `x-forwarded-for` hop. Behind a second proxy that hop can become
   Cloudflare's edge rather than the shopper, and then the limits in `LIMITS`
   stop being per-visitor: the whole country shares one bucket and the shop
   starts refusing genuine orders at 40 checkouts per ten minutes *between
   them*. The fix is already in the file and is off by default —
   `TRUST_CLOUDFLARE_IP=1` makes it read `CF-Connecting-IP` instead. It is
   opt-in because that header is only meaningful when Cloudflare wrote it:
   set it on a directly reachable origin and anyone can spoof a fresh bucket
   per request, which switches the limiter off while leaving it looking on.
   **Set the flag in the same change that turns the proxy on, not after.**
2. **A redirect loop, if the SSL mode is wrong.** `proxy.ts` 308s any request
   arriving with `x-forwarded-proto: http` up to https. Cloudflare's
   "Flexible" mode speaks https to the browser and **http to the origin**, so
   the origin redirects, Cloudflare re-fetches over http, and round it goes.
   **Full (strict)** is the only correct setting here.

Neither is a reason it can't be done; both are reasons not to do it by
flipping a switch in a dashboard on a Friday.

---

### 5.aa The shop has not said how long it has been trading

The home page used to end with **"9 ans au service des garages"**, and three
other places claimed **"12 000+ références"**. Neither number came from
anywhere: they were typed into `dictionaries.ts` in all three languages when
the page was laid out, and a shopper who read 12 000 and then opened a family
holding eleven parts had caught the site out on the first screen.

The counts are read from the database now (`getCatalogueScale`, cached on the
catalogue tag like the menu), and the families subtitle counts the tiles
rendered underneath it, so the sentence and the tiles cannot disagree. Today
that reads 55 références, 16 familles, 16 marques. Small, and true, and it
grows on its own as the shop uploads — there is nothing to remember to change.

The years are the one figure the database cannot produce, so there is now a
`shop_founded_year` setting in `/admin/parametres`, **empty by default**. Left
empty the page says nothing about the shop's age and shows the number of
brands carried instead; filled in, it counts the years and keeps counting, and
refuses anything that is not a plausible four-digit year so a typo cannot put
"202 ans" on the front page. **This is the one open item here: ask the owner
what year they opened and enter it.** It is a genuine selling point going
unused, and it is the only one of these numbers that needed a human.

`e2e-storefront-fixes` section [5] holds it in place — twelve checks that
compare what is printed against `prisma.product.count`, including that none of
the three old spellings of 12 000 has come back.

---

### 5.bb The shop's own details are still blank, and the site now says so

An audit scored trust 4.5/10, and most of the reasons are one missing field
each in `/admin/parametres`. **None of them can be fixed from the code, and
none of them should be guessed.**

| Setting | What is missing today | What the site does about it |
|---|---|---|
| `shop_whatsapp` | no number | every WhatsApp button is not rendered |
| `shop_phone` | placeholder | no tap-to-call link anywhere |
| `shop_address` | placeholder | "Passez nous voir" and collection at the counter are both hidden |
| `shop_email` | a personal Gmail in production | shown as-is; a shop address would read better |
| `shop_tax_id` | `5555` in production | the printable document is a reçu, not a facture, and no VAT is charged |

The rule the code follows is **fail closed: a missing setting removes the
offer, it never ships a dead one.** That came out of the worst case found —
`216` and `+216` are not blank, not the default and not a run of zeros, so
every guard passed them and the site shipped live `wa.me/216` buttons on eight
pages. `isDiallable()` in `lib/contact-link.ts` wants eight digits now, and
`e2e-trust` drives it from both sides so the rule cannot rot into a
switched-off feature.

`/conditions`, `/livraison-retours` and `/confidentialite` exist and read
their figures from the settings, so they cannot drift away from the checkout.
They are **not a lawyer's work** and say so at the foot of each page; the
mentions légales of a Tunisian trader — matricule fiscal, registre du
commerce, adresse du siège — are the owner's to supply, and an accountant
should see the invoicing rules before the shop issues a real facture.

---

### 5.cc The search index is a database trigger, not application code

This is the most important thing in this file for anyone touching the
catalogue. An audit found exact product names — parts on the home page, in
stock — returning "0 résultat". Every symptom it listed had one cause:
`reindexProducts()` held the only copy of the blob definition and exactly one
caller invoked it, the CSV import. **A product created in the admin was born
with no index and could not be found by anything; a renamed one stayed
findable only under its old name.**

The comment above that function had predicted it word for word — "a helper
that each of those has to remember to call is a helper that will eventually be
forgotten, a part that exists, sells, and cannot be found" — and it was
forgotten anyway, for months, which is the whole argument for where the rule
lives now. Migration `20260920090000` defines the blob once and fires it on
every write to `Product`, `PartReference`, `Brand` and `Category`. There is no
"outside the app" any more: psql counts, the seed counts, a future script
counts.

**If you change what is searchable, change the migration, not TypeScript.**
`reindexProducts()` is a repair tool that asks the trigger to run
(`UPDATE "Product" SET name = name`) — that is not a hack to tidy up, it is
how you re-fire a BEFORE trigger without keeping a second copy of the rule.
`e2e-search-coverage` [1] compares every stored row against the function's own
output, so drift is caught the moment it starts, and checks the four triggers
are still installed.

A warning about the test that was there before: `e2e-search` section [9] used
to assert **"an edit made outside the app is not silently searchable — stale
index returns nothing, as expected"**. That was the bug written down as a
requirement, and it passed for months while the shop was unsearchable. If you
find yourself writing "as expected" next to behaviour you would not defend to
a customer, that is the moment to stop.

### 5.dd A second audit, nine findings, and the two lessons in them

All nine are fixed and all nine are now held by `scripts/e2e-audit-fixes.mjs`
— a suite that exists because every one of them would have passed the other
thirty-five. What it covers is worth reading before changing any of it:

| Reported as | What it actually was |
|---|---|
| "13 units of an item labelled 8 en stock" | the clamp lived in `add` and `setQty`; `replaceAll` and the localStorage rehydrate were the two paths without it, and are the two that produce this |
| "Validation is silent — nothing but an amber ring" | native validation **blocks the `submit` event**, so the form's own handler was unreachable and no French message could ever have run |
| "Ajouter au panier is fully enabled on parts the site just said don't fit" | true, and the confirm written to fix it was broken twice over — see below |
| "The confirmation page lands you at the footer" | the form collapses, the browser clamps the now-impossible scroll offset, and the navigation inherits it; Next resets scroll on a route change but not on the re-render that happens first |
| "Logout doesn't clear the session" | the session went; the basket and garage are localStorage, and a deleted cookie does nothing to them |
| "Guests cannot track their order, ever" | the footer's "Suivi de commande" pointed at a page behind a login, and checkout requires no account |
| "Zero analytics" | true |

**The fix for the third one was itself broken twice, and that is the lesson.**
A `useState` setter does not change what the current closure reads, so
`onClick={() => { setConfirmed(true); handleAdd(); }}` ran `handleAdd` with
`confirmedMismatch` still `false` — "Ajouter quand même" re-opened the panel
on itself and added nothing, every time. And `StickyBuyBar` called
`useCart().add` directly, so on a phone, where that bar is the only buy button
for four fifths of the scroll, the confirm did not exist at all.

Both are now structural rather than remembered. `handleAdd(force)` takes the
decision as an argument, the ordinary button is `onClick={() => handleAdd()}`
rather than `onClick={handleAdd}` (passing the function by reference hands the
click event in as `force`, and an event object is truthy), and the bar calls
the page's `onAdd` and reads its answer instead of owning a second route into
the cart. **If you add another control that buys a product, give it the page's
add — a second button that buys under different rules is the bug, not the
missing warning on it.**

**The other lesson is that "I saw it work" is not coverage.** Every one of
these was verified in a real browser when it was written. Two were still
wrong — one of them on the platform most of the shop's traffic uses — and the
nine had no test between them until this suite existed.

**And a third, about the suite itself.** The compatibility section needs a
part with fitment rows and a car outside them. It found one by taking the
first matching product, which standalone was fine and *inside the battery*
happened to be an oil filter listed for 24 of the shop's 25 engines — so the
section measured nothing, printed one grey line about it, and the battery
reported green. A sixty-line section certifying the most important fix in the
suite was, for one run, a no-op. It searches for a usable pair now (fewest
fitments first), and if it cannot find one it **fails** rather than notes it:
a shop where that gate cannot be tested is a shop whose gate is untested,
which is precisely the state it shipped broken in. Skips hide in a 36-suite
run; the same is true of every `console.log("(nothing to measure)")` in these
scripts, so prefer a FAIL wherever the missing data would mean the feature is
unverified rather than genuinely absent.

**There are two analytics on this site and they are not the same thing.**
`src/components/Analytics.tsx` is the shop's own page-view recorder — it
writes `AnalyticsEvent` rows that feed `/admin/analytics` and the unmet-demand
list, it survives ad blockers, and it is mounted once in the **root** layout.
`src/components/GoogleAnalytics.tsx` is GA4, off unless `NEXT_PUBLIC_GA_ID` is
set, mounted in the **storefront** layout so staff working in the admin are
not counted as shoppers. The GA component was originally written as
`Analytics.tsx` and silently overwrote the first one: the internal counter
went dead, `/admin/analytics` would have started reading zero, and
`/confidentialite` went on promising "une mesure d'audience interne" that no
longer existed. The whole battery passed. `e2e-audit-fixes` [7] now checks
both mountings *and* that a real visit still lands a `page_view` row, because
the source check alone would not have caught a mounted component that records
nothing.

Three things from that audit are deliberately *not* done, and only one of them
is code:

- **The home page's "les plus commandées" row rejects a shopper with a car
  saved.** `ProductGrid` already floats what fits to the top, so ordering is
  not the problem — the problem is that almost nothing carries fitment data.
  Filtering the row would make it a row of one. This is data (§5.5).
- **Per-SKU images.** `/api/part-icon/[slug]` draws a *family* line drawing,
  so every brake pad in the shop looks identical. Real photographs fix it
  (§5.1), and the per-SKU image and fitment ingestion format has to be settled
  before any bulk import. It has not been.
- **Whether Google Analytics needs a consent banner in Tunisia.** GA is off
  unless `NEXT_PUBLIC_GA_ID` is set, configured with `allow_google_signals:
  false` and ad personalisation off, and `/confidentialite` follows the same
  variable rather than describing a fixed state — so the privacy page cannot
  quietly go out of date the day someone turns it on. Whether a banner is
  required is a lawyer's question and the page does not pretend it has been
  answered.

### 5.ee The phone app's customer accounts, deletion, analytics, CI (September 2026)

The app (other repository, ARCHITECTURE.md §17 there) now signs customers in
with the website's own accounts. What changed on this side:

- **`CustomerSession`** (migration `20260924090000_customer_sessions`): the
  app's bearer session, built like `AdminSession` and kept in its own table
  so a customer token can never open `/api/v1/admin`. `lib/customer-session.ts`.
- **Routes**: `/api/v1/auth/signup`, `/auth/session` (POST sign in, GET, DELETE
  sign out), `/auth/password-reset` (sends this site's reset e-mail),
  `/api/v1/account` (GET, DELETE), `/account/orders`,
  `/account/orders/claim` (guest orders proven by their order tokens — never
  by e-mail), and `/api/v1/events` (the app's analytics into
  `AnalyticsEvent`, tagged `app: true`). None reads a cookie; see respond.ts.
  `GET /api/v1/orders/:ref` also opens an order for its owner's session, and
  `POST /api/v1/orders` attaches the order to the signed-in account.
- **Password changed or reset signs every phone out** (customer and staff
  sessions deleted in the same transaction).
- **Account deletion** — required by both stores — on `/compte/profil`
  ("Supprimer mon compte", password re-entered) and in the app, through one
  function (`lib/account-deletion.ts`). Orders are kept, detached: they are
  invoices. Admin accounts are refused. `/compte/profil` is the web address
  to give Google Play as the deletion route. Covered by `e2e-account-delete`.
- **Shared rules moved to `lib/`**: `signupSchema` (lib/validation — the
  website form and the app API), `startPasswordReset` (lib/password-reset),
  `claimOrderIds` (lib/orders/claim).
- **Lint is at zero errors.** The 13 were React Compiler rules; state that
  followed a prop or an action result is now adjusted while rendering
  (React's documented pattern) instead of reset in an effect.
- **Unit tests** — `npm test` (`node --test` through tsx) for the pure rules:
  names, phones, the signup schema, availability, references, VIN, tax,
  segments. **CI** — `.github/workflows/ci.yml`: lint, typecheck, unit tests,
  migrate a throwaway Postgres from zero, build. The Playwright battery stays
  a pre-release step.

**Battery status at this change**, on a production build: every suite
passes except three failures that reproduce identically on the code before
it (checked by stashing the change, rebuilding and rerunning): catalog-
authoring "no test category left", product-page "only an unsupplyable part
refuses an order", and loop "the toggle brings every reference back" plus
its two console-error checks. In this container the image optimiser also
hung on `storefront.png` at 1920px for a long-running server, which times
out any suite that waits for `networkidle` on the home page — a restart
clears it; worth watching on the real host.

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
- **A number in the copy is data too.** This is the one that got past everyone:
  "12 000+ références" and "9 ans au service des garages" sat in the
  dictionaries for months because marketing copy does not look like a claim
  about the database until you check it against one. If a sentence contains a
  figure, it comes from a query or from a setting the owner filled in — see
  §5.aa.
- **No fake urgency and no fake discounts.** A promotion appears only when it
  is backed by a real record. "Best seller" appears only when real sales data
  says so.
- **Say what is true about stock and fitment.** Out-of-stock says so.
  Compatibility is claimed only where the fitment table backs it, and parts with
  no fitment data are shown apart rather than hidden or claimed.
