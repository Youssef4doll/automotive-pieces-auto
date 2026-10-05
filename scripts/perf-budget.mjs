/**
 * The API's speed budget: p95 under BUDGET_MS for the calls a customer waits
 * on, measured against a running server (`npm run dev` or `npm start`).
 *
 *   node scripts/perf-budget.mjs            # localhost:3000, budget 300 ms
 *   BUDGET_MS=800 RUNS=30 node scripts/perf-budget.mjs
 *
 * Each endpoint is warmed once (a dev server compiles a route on its first
 * hit, which is not what a customer waits on in production), then called
 * RUNS times in a row. Exits 1 when any p95 is over budget, so CI or a
 * pre-release check can stop on it. Read-only: no order is placed.
 *
 * Refuses anything but localhost, like the e2e suites — this is not a load
 * test to point at the shop.
 */
const BASE = process.env.SHOP_URL ?? "http://localhost:3000";
const BUDGET_MS = Number(process.env.BUDGET_MS ?? 300);
const RUNS = Number(process.env.RUNS ?? 20);

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error(`perf-budget: refusing ${BASE} — localhost only.`);
  process.exit(2);
}

const json = async (path, init) => {
  const res = await fetch(BASE + path, init);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()).data;
};

// Real ids from the shop itself: a car, a family, a product.
const makes = await json("/api/v1/vehicles/makes");
const make = makes.find((m) => (m.modelCount ?? 1) > 0) ?? makes[0];
const models = await json(`/api/v1/vehicles/models?make=${encodeURIComponent(make.slug ?? make.id)}`).catch(() => []);
const engines = models[0] ? await json(`/api/v1/vehicles/engines?model=${encodeURIComponent(models[0].slug ?? models[0].id)}&make=${encodeURIComponent(make.slug ?? make.id)}`).catch(() => []) : [];
const engine = engines[0]?.id;
const families = await json("/api/v1/catalogue/families");
const family = families[0]?.slug;
const page = await json(`/api/v1/catalogue/products?family=${family}${engine ? `&engine=${engine}` : ""}`);
const product = page.products[0];

const q = engine ? `&engine=${engine}` : "";
const calls = [
  ["families", "/api/v1/catalogue/families"],
  ["settings", "/api/v1/settings/public"],
  ["family list", `/api/v1/catalogue/products?family=${family}${q}`],
  ...(engine ? [["fits my car", `/api/v1/catalogue/products?engine=${engine}&fits=1`]] : []),
  ["search", `/api/v1/search?q=filtre${q}`],
  ["product", `/api/v1/products/${product.slug}${engine ? `?engine=${engine}` : ""}`],
  [
    "cart quote",
    "/api/v1/cart/quote",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: [{ productId: product.id, qty: 1 }], ...(engine ? { engineId: engine } : {}) }) },
  ],
];

let over = 0;
for (const [name, path, init] of calls) {
  await fetch(BASE + path, init); // warm
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const res = await fetch(BASE + path, init);
    await res.arrayBuffer();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)];
  const ok = p95 <= BUDGET_MS;
  if (!ok) over += 1;
  console.log(`${ok ? "ok  " : "SLOW"}  ${name.padEnd(12)} p50 ${p50.toFixed(0).padStart(4)} ms   p95 ${p95.toFixed(0).padStart(4)} ms`);
}
console.log(over ? `\n${over} endpoint(s) over the ${BUDGET_MS} ms p95 budget` : `\nevery endpoint within the ${BUDGET_MS} ms p95 budget`);
process.exit(over ? 1 : 0);
