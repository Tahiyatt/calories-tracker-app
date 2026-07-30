import { User } from '../models/index.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { unauthorized } from '../utils/httpError.js';

/**
 * Verifies the access token and attaches the user.
 *
 * The user document is loaded rather than trusted from the token payload,
 * because the timezone on the profile is needed to compute localDate on every
 * write. Stale timezone data would silently file entries under the wrong day.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';

  if (!header.startsWith('Bearer ')) {
    return next(unauthorized('Missing bearer token'));
  }

  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return next(unauthorized(expired ? 'Access token expired' : 'Invalid access token'));
  }

  const user = await User.findById(payload.sub);
  if (!user) return next(unauthorized('User no longer exists'));

  req.user = user;
  next();
}
