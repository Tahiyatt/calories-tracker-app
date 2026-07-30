import jwt from 'jsonwebtoken';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

export const REFRESH_COOKIE = 'ct_refresh';

/**
 * Short-lived access token. Sent in the Authorization header, held only in
 * memory on the client. The short TTL is what limits the damage if one leaks,
 * since there is no way to revoke an individual access token.
 */
export function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString() }, env.accessSecret, {
    expiresIn: env.accessTtl,
  });
}

/**
 * Long-lived refresh token, carrying the user's current refreshTokenVersion.
 * Incrementing that field on the User makes every outstanding refresh token
 * fail validation — the "log out everywhere" story for stateless JWTs.
 */
export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), ver: user.refreshTokenVersion },
    env.refreshSecret,
    { expiresIn: `${env.refreshTtlDays}d` },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.accessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.refreshSecret);
}

/**
 * The refresh token lives in an httpOnly cookie so JavaScript cannot read it.
 * An XSS bug therefore cannot steal a long-lived credential — the worst it can
 * do is use the in-memory access token until it expires. Scoping the path to
 * /api/auth keeps the cookie off every other request.
 */
export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: env.refreshTtlDays * 24 * 60 * 60 * 1000,
  };
}
