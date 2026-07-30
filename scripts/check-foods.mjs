process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/ct-test';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
process.env.OFF_TIMEOUT_MS = '600';

import http from 'node:http';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`)); };

// ---- Mock Open Food Facts, shaped from their documented field names ----
const NUTELLA = {
  code: '3017624010701', product_name: 'Nutella', brands: 'Ferrero,Nutella',
  quantity: '400 g', product_quantity: 400, serving_size: '15 g', serving_quantity: 15,
  nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5,
                fat_100g: 30.9, fiber_100g: 0, sugars_100g: 56.3, salt_100g: 0.107 },
};
const KJ_ONLY = { // European product with kilojoules only
  code: '1111111111111', product_name: 'Kilojoule Biscuit', brands: 'EuroBrand',
  quantity: '200 g', serving_size: '2 biscuits (25g)',
  nutriments: { 'energy-kj_100g': 2000, proteins_100g: 5, carbohydrates_100g: 60, fat_100g: 20, sodium_100g: 0.4 },
};
const DRINK = {
  code: '2222222222222', product_name: 'Orange Juice', brands: 'Juicy',
  quantity: '1 L', product_quantity: 1000, serving_size: '1 glass (250 ml)',
  nutriments: { 'energy-kcal_100g': 45, proteins_100g: 0.7, carbohydrates_100g: 10.4, fat_100g: 0.2, sugars_100g: 8.9 },
};
const NO_NUTRITION = { code: '3333333333333', product_name: 'Mystery Snack', brands: 'X', nutriments: {} };
const NO_NAME = { code: '4444444444444', product_name: '', nutriments: { 'energy-kcal_100g': 100 } };

let hits = 0, mode = 'ok';
const mock = http.createServer((req, res) => {
  hits++;
  if (mode === 'hang') return; // never responds -> exercises the timeout
  if (mode === '503') { res.writeHead(503); return res.end('busy'); }
  if (mode === 'garbage') { res.writeHead(200, {'Content-Type':'application/json'}); return res.end('{not json'); }

  const url = new URL(req.url, 'http://x');
  res.writeHead(200, { 'Content-Type': 'application/json' });

  if (url.pathname.startsWith('/api/v2/product/')) {
    const code = url.pathname.split('/').pop().replace('.json', '');
    const found = [NUTELLA, KJ_ONLY, DRINK, NO_NUTRITION].find(p => p.code === code);
    return res.end(JSON.stringify(found ? { status: 1, product: found } : { status: 0 }));
  }
  if (url.pathname === '/search') {
    return res.end(JSON.stringify({ hits: [NUTELLA, KJ_ONLY, NO_NUTRITION, NO_NAME] }));
  }
  res.end('{}');
});
await new Promise(r => mock.listen(4998, r));
process.env.OFF_PRODUCT_URL = 'http://127.0.0.1:4998';
process.env.OFF_SEARCH_URL = 'http://127.0.0.1:4998';

console.log('\n1. Normalizer — unit conversion and field mapping');
const N = await import('../packages/server/src/services/foodNormalizer.js');

const n1 = N.normalizeOffProduct(NUTELLA);
check('maps kcal straight through', n1.nutrients.kcal === 539);
check('takes first brand only, not "Ferrero,Nutella"', n1.brand === 'Ferrero', `got ${n1.brand}`);
check('converts salt 0.107 g -> sodium 42.8 mg', n1.nutrients.sodiumMg === 42.8, `got ${n1.nutrients.sodiumMg}`);
check('solid product -> basis 100g', n1.basis === '100g');
check('serving + whole package both offered', n1.servings.length === 2, JSON.stringify(n1.servings));
check('serving grams from serving_quantity', n1.servings[0].grams === 15);
check('package grams from product_quantity', n1.servings[1].grams === 400);
check('source tagged openfoodfacts', n1.source === 'openfoodfacts' && n1.sourceId === '3017624010701');

const n2 = N.normalizeOffProduct(KJ_ONLY);
check('converts 2000 kJ -> 478.01 kcal', n2.nutrients.kcal === 478.01, `got ${n2.nutrients.kcal}`);
check('converts sodium 0.4 g -> 400 mg', n2.nutrients.sodiumMg === 400, `got ${n2.nutrients.sodiumMg}`);
check('parses grams from "2 biscuits (25g)"', n2.servings[0].grams === 25, JSON.stringify(n2.servings));

const n3 = N.normalizeOffProduct(DRINK);
check('litre product -> basis 100ml', n3.basis === '100ml', `got ${n3.basis}`);
check('missing fiber defaults to 0', n3.nutrients.fiber === 0);
check('missing sodium defaults to 0', n3.nutrients.sodiumMg === 0);

console.log('\n2. Normalizer — quality gate');
check('rejects product with empty nutriments', N.normalizeOffProduct(NO_NUTRITION) === null);
check('rejects product with no name', N.normalizeOffProduct(NO_NAME) === null);
check('rejects null', N.normalizeOffProduct(null) === null);
check('rejects implausible kcal (>900/100g)',
  N.normalizeOffProduct({ code: '9', product_name: 'x', nutriments: { 'energy-kcal_100g': 5000 } }) === null);
check('normalizeMany drops the bad ones', N.normalizeMany([NUTELLA, NO_NUTRITION, NO_NAME, DRINK]).length === 2);

console.log('\n3. parseServingGrams');
const cases = [['38 g', 38], ['1 cup (240 ml)', 240], ['2 biscuits (25g)', 25],
               ['30,5 g', 30.5], ['1 slice', null], ['', null], [undefined, null]];
for (const [input, want] of cases) {
  check(`"${input}" -> ${want}`, N.parseServingGrams(input) === want, `got ${N.parseServingGrams(input)}`);
}

console.log('\n4. Client — happy path against mock');
const C = await import('../packages/server/src/services/offClient.js');
const prod = await C.fetchProductByBarcode('3017624010701');
check('fetches product by barcode', prod?.product_name === 'Nutella');
check('OFF status:0 becomes null, not a throw', (await C.fetchProductByBarcode('0000000000000')) === null);
const results = await C.searchProducts('nutella', { limit: 10 });
check('search returns hits array', Array.isArray(results) && results.length === 4);

console.log('\n5. Client — failure handling');
mode = '503';
let e503;
try { await C.fetchProductByBarcode('3017624010701'); } catch (err) { e503 = err; }
check('503 surfaces as retryable UpstreamError', e503?.retryable === true && e503.status === 503, e503?.message);

mode = 'garbage';
let eBad;
try { await C.fetchProductByBarcode('3017624010701'); } catch (err) { eBad = err; }
check('malformed JSON -> 502', eBad?.status === 502, eBad?.message);

mode = 'hang';
const before = hits;
let eTimeout;
const t0 = Date.now();
try { await C.fetchProductByBarcode('3017624010701'); } catch (err) { eTimeout = err; }
const elapsed = Date.now() - t0;
check('timeout -> 504 retryable', eTimeout?.status === 504 && eTimeout.retryable === true, eTimeout?.message);
check('timeout retried exactly once (2 requests)', hits - before === 2, `made ${hits - before}`);
check(`aborted near the 600ms budget, twice (${elapsed}ms)`, elapsed >= 1100 && elapsed < 2200);
mode = 'ok';

console.log('\n6. Token bucket');
const { TokenBucket } = await import('../packages/server/src/utils/rateLimiter.js');
const b = new TokenBucket({ capacity: 3, refillPerMinute: 60 });
check('allows up to capacity', b.tryTake() && b.tryTake() && b.tryTake());
check('blocks when empty', b.tryTake() === false);
check('reports seconds until refill', b.secondsUntilToken() >= 1);
await new Promise(r => setTimeout(r, 1100));
check('refills over time', b.tryTake() === true);

const exhausted = C.__buckets.searchBucket;
while (exhausted.tryTake()) { /* drain */ }
let eLimited;
try { await C.searchProducts('anything'); } catch (err) { eLimited = err; }
check('exhausted bucket blocks before any network call', eLimited?.status === 429, eLimited?.message);

mock.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
