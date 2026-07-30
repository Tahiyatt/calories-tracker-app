/**
 * Fail fast on missing configuration.
 *
 * A server that boots with no JWT secret and then throws on the first login
 * is far worse to debug than one that refuses to start and says why.
 */
const REQUIRED = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

export function loadEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`[env] missing required variables: ${missing.join(', ')}`);
    console.error('[env] copy .env.example to .env at the repo root and fill it in');
    process.exit(1);
  }

  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    console.error('[env] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
    process.exit(1);
  }

  const isProduction = process.env.NODE_ENV === 'production';

  return {
    port: Number(process.env.PORT ?? 4000),
    mongoUri: process.env.MONGODB_URI,
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),
    isProduction,

    // Cookie behaviour is configuration, not a hardcoded consequence of
    // NODE_ENV. Behind the Vercel rewrite the API is same-origin, so 'lax' is
    // correct and safer. Only a direct cross-origin setup needs 'none'.
    cookieSecure: (process.env.COOKIE_SECURE ?? String(isProduction)) === 'true',
    cookieSameSite: process.env.COOKIE_SAMESITE ?? 'lax',

    // Render terminates TLS at a proxy. Without this Express sees the proxy's
    // IP (breaking per-user rate limiting) and misjudges req.secure.
    trustProxy: process.env.TRUST_PROXY ?? (isProduction ? '1' : ''),
  };
}
