/**
 * Thin fetch wrapper. Vite proxies /api to the server in development,
 * so relative URLs work without configuration.
 */
async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(body?.error ?? `Request failed (${response.status})`);
    error.status = response.status;
    error.issues = body?.issues;
    throw error;
  }

  return body;
}

export const api = {
  health: () => request('/health'),
};
