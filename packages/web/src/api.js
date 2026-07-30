/**
 * The access token lives in a module variable, never localStorage.
 *
 * Anything in localStorage is readable by any script on the page, so an XSS bug
 * would hand an attacker a durable credential. In memory it dies with the tab,
 * and the httpOnly refresh cookie — which JavaScript cannot read at all — is
 * what survives a page reload.
 */
let accessToken = null;

export const setAccessToken = (token) => { accessToken = token; };
export const getAccessToken = () => accessToken;

let refreshInFlight = null;

/** Ask the server for a new access token using the refresh cookie. */
async function refreshAccessToken() {
  // Collapse concurrent refreshes: if three requests 401 at once, they should
  // wait on one refresh, not race three.
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json();
      setAccessToken(data.accessToken);
      return data;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function send(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.error ?? `Request failed (${res.status})`);
    error.status = res.status;
    error.issues = data?.issues;
    throw error;
  }

  return data;
}

/** Retries once after a silent token refresh, so a 15-minute expiry is invisible. */
async function request(path, options = {}) {
  try {
    return await send(path, options);
  } catch (err) {
    const isAuthPath = path.startsWith('/auth/');
    if (err.status !== 401 || isAuthPath) throw err;

    const refreshed = await refreshAccessToken();
    if (!refreshed) throw err;

    return send(path, options);
  }
}

export const api = {
  health: () => request('/health'),

  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  refresh: refreshAccessToken,

  searchFoods: (q, { remote = false, limit = 20 } = {}) =>
    request(`/foods/search?q=${encodeURIComponent(q)}&remote=${remote}&limit=${limit}`),
  foodByBarcode: (barcode) => request(`/foods/barcode/${encodeURIComponent(barcode)}`),

  dashboard: (days = 30) => request(`/analytics/dashboard?days=${days}`),

  today: () => request('/entries/today'),
  entriesFor: (date) => request(`/entries?date=${date}`),
  quickAdd: (payload) => request('/entries/quick', { method: 'POST', body: payload }),
  addEntry: (payload) => request('/entries', { method: 'POST', body: payload }),
  updateEntry: (id, patch) => request(`/entries/${id}`, { method: 'PATCH', body: patch }),
  deleteEntry: (id) => request(`/entries/${id}`, { method: 'DELETE' }),

  activeGoal: () => request('/goals/active'),
  goalHistory: () => request('/goals'),
  setGoal: (payload) => request('/goals', { method: 'POST', body: payload }),

  weights: (params = '') => request(`/weights${params}`),
  upsertWeight: (payload) => request('/weights', { method: 'PUT', body: payload }),
  deleteWeight: (localDate) => request(`/weights/${localDate}`, { method: 'DELETE' }),
};
