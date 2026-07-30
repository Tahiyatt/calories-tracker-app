import { Food } from '../models/index.js';
import { normalizeOffProduct, normalizeMany } from './foodNormalizer.js';
import { fetchProductByBarcode, searchProducts, UpstreamError } from './offClient.js';

/** How long a cached Food is considered current. */
const STALE_AFTER_DAYS = Number(process.env.FOOD_STALE_AFTER_DAYS ?? 30);
const STALE_AFTER_MS = STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;

const isStale = (food) =>
  !food.fetchedAt || Date.now() - new Date(food.fetchedAt).getTime() > STALE_AFTER_MS;

/** Insert or refresh one cached food. Unique on (source, sourceId). */
async function cacheFood(normalized) {
  return Food.findOneAndUpdate(
    { source: normalized.source, sourceId: normalized.sourceId },
    { $set: normalized },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function cacheMany(normalizedList) {
  return Promise.all(normalizedList.map((n) => cacheFood(n).catch(() => null))).then((r) =>
    r.filter(Boolean),
  );
}

/** Search only what we already hold. Always fast, always available. */
export async function searchLocal(query, limit) {
  // $text uses the (name, brand) text index. Falls back to a prefix regex,
  // because $text matches whole words only — "yog" would find nothing, and a
  // search box has to work while the user is still typing.
  const textHits = await Food.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } },
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();

  if (textHits.length >= limit) return textHits;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefixHits = await Food.find({
    _id: { $nin: textHits.map((f) => f._id) },
    name: { $regex: escaped, $options: 'i' },
  })
    .limit(limit - textHits.length)
    .lean();

  return [...textHits, ...prefixHits];
}

/**
 * Local-first search.
 *
 * The cache is consulted first and returned immediately. Open Food Facts is
 * only contacted when the caller explicitly asks (`remote: true`) — their search
 * endpoint permits 10 requests/minute per IP and the docs say plainly not to
 * wire it to a search-as-you-type box. So the UI searches locally on every
 * keystroke and offers a button for the remote lookup.
 *
 * A remote failure is never fatal: local results still return, with a note
 * saying the wider search was unavailable.
 */
export async function search({ q, limit, remote }) {
  const local = await searchLocal(q, limit);

  if (!remote) {
    return { foods: local, source: 'cache', remoteAttempted: false };
  }

  try {
    const raw = await searchProducts(q, { limit });
    const cached = await cacheMany(normalizeMany(raw));

    // Merge, preferring freshly cached records, then top up from local.
    const seen = new Set(cached.map((f) => String(f._id)));
    const merged = [...cached, ...local.filter((f) => !seen.has(String(f._id)))];

    return {
      foods: merged.slice(0, limit),
      source: 'openfoodfacts',
      remoteAttempted: true,
      // Worth surfacing: a search returning nothing new usually means OFF had
      // results but they all failed the normaliser's quality gate.
      discarded: raw.length - cached.length,
    };
  } catch (err) {
    if (!(err instanceof UpstreamError)) throw err;

    return {
      foods: local,
      source: 'cache',
      remoteAttempted: true,
      remoteError: err.message,
    };
  }
}

/**
 * Barcode lookup: cache first, then OFF.
 *
 * Stale entries are returned immediately and refreshed in the background, so a
 * scan never waits on a network call for data we already have. The refresh is
 * fire-and-forget by design — if it fails, the cached copy is still correct
 * enough to log, and the next lookup will try again.
 */
export async function findByBarcode(barcode) {
  const cached = await Food.findOne({ source: 'openfoodfacts', sourceId: barcode });

  if (cached && !isStale(cached)) {
    return { food: cached, source: 'cache' };
  }

  if (cached && isStale(cached)) {
    refreshInBackground(barcode);
    return { food: cached, source: 'cache', stale: true };
  }

  const product = await fetchProductByBarcode(barcode);
  if (!product) return { food: null, source: 'openfoodfacts' };

  const normalized = normalizeOffProduct(product);
  if (!normalized) {
    return {
      food: null,
      source: 'openfoodfacts',
      rejected: 'Open Food Facts has this product but its nutrition data is incomplete',
    };
  }

  return { food: await cacheFood(normalized), source: 'openfoodfacts' };
}

function refreshInBackground(barcode) {
  Promise.resolve()
    .then(async () => {
      const product = await fetchProductByBarcode(barcode);
      const normalized = product && normalizeOffProduct(product);
      if (normalized) await cacheFood(normalized);
    })
    .catch((err) => console.warn(`[food] background refresh of ${barcode} failed: ${err.message}`));
}

/** A food the user defines themselves. sourceId is scoped to them. */
export async function createUserFood(input, user) {
  return cacheFood({
    ...input,
    source: 'user',
    sourceId: `${user._id}:${input.name.toLowerCase()}`,
    createdBy: user._id,
    fetchedAt: new Date(),
  });
}

export function getById(id) {
  return Food.findById(id).lean();
}
