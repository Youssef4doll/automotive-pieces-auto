# Automotive Pièces Auto — full-stack e-commerce platform

A real full-stack rebuild of the Claude Design prototype (`../project/Automotive Pieces Auto.dc.html` and its Admin
counterpart): one Next.js app, one Postgres database, serving both the public storefront and the admin CRM. Anything
an admin changes — order status, stock, prices, site settings — is read live from the database by the storefront, so
it shows up immediately for customers. No mock data pretending to be a backend.

## Stack

- **Next.js 16** (App Router, Server Actions, Route Handlers) + **TypeScript**
- **PostgreSQL** + **Prisma ORM**
- **Tailwind CSS v4** for styling (navy / gold / red brand system)
- **zustand** for client-side cart & vehicle-selection state (persisted to `localStorage`)
- Cookie-based JWT sessions (bcrypt password hashing) — no third-party auth provider

## What's built

**Storefront** (French default, with Arabic — full RTL — and English): hero + 4-way part finder (by
vehicle/carte-grise photo/VIN prefix/reference number), vehicle picker (make → model → engine) that drives a live
"✓ Compatible" / "? Vérifier" chip on every product, mega-menu catalog across the shop's real 16-family taxonomy,
brand marquee, best-sellers, trust badges, customer reviews, store info block — all reading from Postgres.
Cart (drawer + full page + sticky mobile bar), guest or logged-in checkout (COD live, card payment marked
"bientôt disponible" per the agreed scope), order confirmation, and a customer account with real order tracking
(4-step status timeline) that reflects whatever status the admin sets.

**Admin CRM** (`/admin`, French-only internal tool, admin-role-gated): dashboard with real KPIs (revenue, orders,
average basket, low-stock alerts, 7-day revenue chart, top products), full order management (filter, detail view,
status changes that instantly show up on the customer's tracking page), stock/product CRUD with prix d'achat /
prix de vente / margin, customers list with lifetime value, and a settings page for shop address/phone/WhatsApp/
email/delivery promise/free-shipping threshold — editing these updates the live site immediately.

## What's intentionally left as a placeholder

Per the agreed scope for this pass:

- **Card payment** is wired in the UI but disabled ("bientôt disponible") — no Tunisian payment gateway (Flouci /
  Paymee / Konnect) account was available to integrate. COD is fully functional and is how ~70–80% of Tunisian
  e-commerce orders are paid anyway.
- **Shop address, phone, WhatsApp number, email** are seeded as clearly-flagged placeholders
  (`⚠ à compléter`) everywhere they appear (footer, checkout, JSON-LD-ready settings) — edit them for real in
  `/admin/parametres` before launch. They must never be guessed.
- **Product photography** — there's no real product photography yet, so every item shares the supplied
  `parts-lineup.png` render. Swap `imageUrl` per product once real photos exist (the field is already there;
  `/admin/stock` doesn't yet have an image upload widget — add one, or set `imageUrl` directly via Prisma Studio).
- **Social login / phone-OTP** are not implemented — email + password only. The transcripts' original login mockup
  showed Google/Facebook/SMS, which need real provider credentials.
- **VIN decoding** is prefix-based (WMI → make) for the makes this shop stocks, not a real VIN database lookup.
- Symptom-based finder and pre-built maintenance packs (discussed at length in the earlier design transcripts) were
  not carried over — the final design iteration replaced the symptom finder with the family browser, and the packs
  need real bundle pricing from the shop owner, which wasn't provided.

## Getting started

```bash
cp .env.example .env          # then fill in DATABASE_URL / DATABASE_URL_UNPOOLED / SESSION_SECRET
npm install
npx prisma migrate deploy     # applies the schema (uses DATABASE_URL_UNPOOLED)
npm run db:seed               # taxonomy, brands, vehicles, ~50 products, demo orders/reviews
npm run dev
```

### Database: Supabase Postgres

This project targets [Supabase](https://supabase.com) Postgres in production, and the schema uses Prisma's
`directUrl` split — see `prisma/schema.prisma`:

- **`DATABASE_URL`** — the **Transaction pooler** connection string (port `6543`, host
  `aws-0-<region>.pooler.supabase.com`). Used for all normal app queries; required on serverless runtimes like
  Vercel, which open many short-lived connections that would otherwise exhaust Postgres's connection limit.
  Must include `?pgbouncer=true` at the end — this tells Prisma to skip prepared statements, which PgBouncer's
  transaction-pooling mode doesn't support.
- **`DATABASE_URL_UNPOOLED`** — the **direct** connection string (port `5432`). Used only for `prisma migrate`,
  which needs session-level features the pooled connection doesn't support.

Get both from the Supabase dashboard → **Project Settings → Database → Connection string** (it has tabs for
"Transaction pooler" and "Direct connection" — copy each into the matching env var). Set them in `.env` locally
and in your deploy platform's environment variables (e.g. Vercel → Project → Settings → Environment Variables).

One gotcha: Supabase's **direct** connection (`db.<project-ref>.supabase.co:5432`) requires IPv6. If migrations
fail to connect from a machine/network that's IPv4-only, use the **Session pooler** string instead for
`DATABASE_URL_UNPOOLED` (same `pooler.supabase.com` host as the transaction pooler, but port `5432`) — it
supports the session-level features migrations need and works over IPv4.

Any other standard Postgres works too (Neon, RDS, your own server, etc.) — just set `DATABASE_URL` to it and
either omit `DATABASE_URL_UNPOOLED` or point it at the same value; the pooled/direct split above is specifically
how to wire up Supabase.

Running `npm run db:seed` or `prisma migrate` against a fresh Supabase database works from any machine with
normal network access — no Supabase CLI required, just the connection strings in `.env`.

### Demo accounts (from the seed)

| Role     | Email                                | Password     |
|----------|---------------------------------------|--------------|
| Admin    | admin@automotive-pieces-auto.tn       | admin1234    |
| Customer | karim.bensalah@example.com            | client1234   |

### Scripts

- `npm run dev` — dev server
- `npm run build && npm run start` — production build/serve
- `npm run db:seed` — re-run the seed (upserts; safe to re-run)
- `npm run lint` — ESLint
- `npx prisma studio` — browse/edit the database visually
- `npx tsc --noEmit` — type-check
- `node scripts/e2e-smoke.mjs` — Playwright smoke test of the core loop (customer orders → admin updates
  status → customer sees it live); requires the app running on port 3500 and Playwright's Chromium installed

## Project structure

```
prisma/schema.prisma        Database schema (products, orders, vehicles, users, settings…)
prisma/seed.ts              Seed data: taxonomy, brands, vehicles, products, demo orders
src/app/(site)/             Public storefront routes
src/app/admin/              Admin CRM routes (role-gated in admin/layout.tsx)
src/app/actions/            Server Actions (auth, orders, admin mutations)
src/lib/data/               Server-only read queries (catalog, admin dashboard)
src/lib/                    Session/auth, settings, cart & vehicle client stores, i18n helpers
src/components/             Shared UI (storefront + admin)
src/i18n/                   FR/AR/EN dictionaries + locale context (catalog/category names
                             stay French — that's the shop's real catalog vocabulary, a decision
                             made explicitly in the original design pass)
```

## Notes on the rebuild

The original `.dc.html` files were a client-side-only prototype built in Claude Design's own templating tool —
useful for shaping the product, but with no real database, no persisted orders, and (per its own design
transcripts) a couple of structural bugs from that authoring environment. This rebuild keeps the visual language,
brand system, and every user-facing flow those transcripts converged on, but implements it as an idiomatic Next.js
app per the handoff bundle's own instruction to "recreate pixel-perfectly... in whatever technology makes sense,"
rather than porting the prototype's internal markup.
