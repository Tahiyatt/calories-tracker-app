import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const DEBOUNCE_MS = 250;

/**
 * Two-stage food search.
 *
 * Typing searches only our own cached Food collection — that is a local database
 * query, so debouncing it at 250ms is purely to avoid hammering our own server.
 *
 * Searching Open Food Facts is a separate, explicit button press. Their docs cap
 * search at 10 requests/minute per IP and say outright not to wire it to a
 * search-as-you-type box. So the fast path stays local, and the wider search is
 * something the user asks for when the cache came up short.
 */
export default function FoodSearch({ onPick }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');
  const [notice, setNotice] = useState(null);
  const [searchedRemote, setSearchedRemote] = useState(false);

  const requestId = useRef(0);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setStatus('idle');
      setNotice(null);
      return;
    }

    setSearchedRemote(false);
    const timer = setTimeout(async () => {
      const id = ++requestId.current;
      setStatus('loading');

      try {
        const data = await api.searchFoods(query.trim());
        // Ignore a response that arrived after a newer one — otherwise fast
        // typing can leave stale results on screen.
        if (id !== requestId.current) return;
        setResults(data.foods);
        setStatus('ready');
        setNotice(null);
      } catch (err) {
        if (id !== requestId.current) return;
        setStatus('error');
        setNotice(err.message);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const searchRemote = async () => {
    setStatus('loading');
    setNotice(null);
    try {
      const data = await api.searchFoods(query.trim(), { remote: true });
      setResults(data.foods);
      setSearchedRemote(true);
      setStatus('ready');

      if (data.remoteError) {
        setNotice(`${data.remoteError} — showing cached results only.`);
      } else if (data.discarded > 0) {
        setNotice(
          `${data.discarded} result${data.discarded === 1 ? '' : 's'} skipped for incomplete nutrition data.`,
        );
      } else if (data.foods.length === 0) {
        setNotice('Open Food Facts had nothing usable for that search.');
      }
    } catch (err) {
      setStatus('error');
      setNotice(err.message);
    }
  };

  return (
    <div className="food-search">
      <label className="field">
        <span className="field-label">Search foods</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="greek yogurt"
          autoComplete="off"
        />
      </label>

      {status === 'loading' && <p className="hint">Searching…</p>}

      {status === 'ready' && results.length === 0 && !searchedRemote && (
        <p className="hint">Nothing cached yet — try Open Food Facts.</p>
      )}

      {notice && <p className="hint">{notice}</p>}

      {results.length > 0 && (
        <ul className="entry-list search-results">
          {results.map((food) => (
            <li key={food._id}>
              <button className="result-button" onClick={() => onPick(food)}>
                <span className="entry-name">
                  {food.name}
                  {food.brand && <span className="muted"> · {food.brand}</span>}
                </span>
                <span className="entry-kcal">
                  {food.nutrients.kcal} kcal /{food.basis === '100ml' ? '100ml' : '100g'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length >= 2 && !searchedRemote && (
        <button type="button" className="secondary" onClick={searchRemote}>
          Search Open Food Facts
        </button>
      )}
    </div>
  );
}
