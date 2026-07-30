import { TokenBucket } from '../utils/rateLimiter.js';
import { HttpError } from '../utils/httpError.js';

/**
 * Client for the Open Food Facts API.
 *
 * Chosen over USDA FoodData Central because it needs no API key, so anyone can
 * clone this repo and have food search work immediately. It also stores
 * nutrition per 100 g natively, which is exactly the shape this app's Food
 * documents use. The tradeoff is data quality: OFF is crowd-sourced and many
 * products have missing or wrong nutrition, which is why the normaliser rejects
 * incomplete records rather than storing them.
 *
 * Published limits (docs, checked July 2026):
 *   15 req/min/IP for product reads
 *   10 req/min/IP for search — and the docs explicitly say not to use it for
 *   search-as-you-type, or you will be blocked quickly.
 *
 * The buckets below sit under those numbers deliberately, leaving headroom
 * because the limit is per IP and a deployed instance shares one.
 */
const PRODUCT_BASE = process.env.OFF_PRODUCT_URL ?? 'https://world.openfoodfacts.org';
const SEARCH_BASE = process.env.OFF_SEARCH_URL ?? 'https://search.openfoodfacts.org';
const TIMEOUT_MS = Number(process.env.OFF_TIMEOUT_MS ?? 6000);

// OFF asks for AppName/Version (ContactEmail) so they can get in touch rather
// than silently banning an IP that misbehaves.
const USER_AGENT =
  process.env.OFF_USER_AGENT ?? 'CalorieTracker/0.2 (portfolio-project@example.com)';

const productBucket = new TokenBucket({ capacity: 12, refillPerMinute: 12, name: 'off-product' });
const searchBucket = new TokenBucket({ capacity: 6, refillPerMinute: 6, name: 'off-search' });

const FIELDS = [
  'code',
  'product_name',
  'brands',
  'quantity',
  'product_quantity',
  'serving_size',
  'serving_quantity',
  'nutrition_data_per',
  'nutriments',
].join(',');

/** Distinguishable so callers can decide whether to serve cached data instead. */
export class UpstreamError extends HttpError {
  constructor(status, message, { retryable = false } = {}) {
    super(status, message);
    this.retryable = retryable;
  }
}

async function fetchJson(url, { attempt = 1 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err.name === 'AbortError';
    // One retry for a transient network blip, then give up. Retrying more would
    // burn rate-limit tokens on a service that is probably actually down.
    if (attempt === 1) return fetchJson(url, { attempt: 2 });
    throw new UpstreamError(
      504,
      aborted ? 'Open Food Facts timed out' : 'Could not reach Open Food Facts',
      { retryable: true },
    );
  } finally {
    clearTimeout(timer);
  }

  // 429 is our own rate limiting failing; 503 is OFF's global abuse limit.
  // Neither is worth retrying immediately.
  if (res.status === 429 || res.status === 503) {
    throw new UpstreamError(503, 'Open Food Facts is rate limiting us — try again shortly', {
      retryable: true,
    });
  }

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new UpstreamError(502, `Open Food Facts returned ${res.status}`);
  }

  try {
    return await res.json();
  } catch {
    throw new UpstreamError(502, 'Open Food Facts returned malformed JSON');
  }
}

/** Look up one product by barcode. Returns the raw OFF product, or null. */
export async function fetchProductByBarcode(barcode) {
  if (!productBucket.tryTake()) {
    throw new UpstreamError(
      429,
      `Too many lookups — retry in ${productBucket.secondsUntilToken()}s`,
      { retryable: true },
    );
  }

  const url = `${PRODUCT_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const body = await fetchJson(url);

  // OFF answers 200 with status 0 for "not found" rather than a 404.
  if (!body || body.status === 0) return null;
  return body.product ?? null;
}

/**
 * Full-text search.
 *
 * Uses Search-a-licious rather than /api/v2/search, because full-text search
 * does not exist in v2 or v3 — v2 only does structured/faceted filtering. The
 * old /cgi/search.pl route does support keywords but is deprecated and has been
 * returning 503s. Search-a-licious is the project's stated replacement, and is
 * still in beta, which is another reason to cache aggressively rather than
 * depend on it being up.
 */
export async function searchProducts(query, { limit = 20 } = {}) {
  if (!searchBucket.tryTake()) {
    throw new UpstreamError(
      429,
      `Search is rate limited — retry in ${searchBucket.secondsUntilToken()}s`,
      { retryable: true },
    );
  }

  const params = new URLSearchParams({
    q: query,
    page_size: String(Math.min(limit, 50)),
    page: '1',
    fields: FIELDS,
  });

  const body = await fetchJson(`${SEARCH_BASE}/search?${params}`);
  return body?.hits ?? body?.products ?? [];
}

export const __buckets = { productBucket, searchBucket };
