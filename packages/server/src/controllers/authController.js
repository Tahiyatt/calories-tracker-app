import bcrypt from 'bcrypt';
import { User } from '../models/index.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshCookieOptions,
  REFRESH_COOKIE,
} from '../utils/tokens.js';
import { conflict, unauthorized } from '../utils/httpError.js';

const BCRYPT_ROUNDS = 12;

/** Never leak passwordHash or internal counters to the client. */
const publicUser = (user) => ({
  id: user._id,
  email: user.email,
  profile: {
    displayName: user.profile?.displayName,
    dateOfBirth: user.profile?.dateOfBirth,
    heightCm: user.profile?.heightCm,
    timezone: user.profile?.timezone ?? 'UTC',
  },
});

function issueSession(res, user) {
  res.cookie(REFRESH_COOKIE, signRefreshToken(user), refreshCookieOptions());
  return { accessToken: signAccessToken(user), user: publicUser(user) };
}

export async function register(req, res) {
  const { email, password, profile } = req.body;

  if (await User.exists({ email })) {
    throw conflict('An account with that email already exists');
  }

  const user = await User.create({
    email,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    profile: { timezone: 'UTC', ...profile },
  });

  res.status(201).json(issueSession(res, user));
}

export async function login(req, res) {
  const { email, password } = req.body;

  // passwordHash is select:false on the model, so ask for it explicitly.
  const user = await User.findOne({ email }).select('+passwordHash');

  // Compare even when no user was found, so the response time does not reveal
  // whether an email is registered. The generic message serves the same end.
  const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid';
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) throw unauthorized('Incorrect email or password');

  res.json(issueSession(res, user));
}

/**
 * Exchange the httpOnly refresh cookie for a fresh access token.
 *
 * The version check is what makes logout-everywhere work: a token minted before
 * refreshTokenVersion was bumped no longer matches and is rejected.
 */
export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw unauthorized('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw unauthorized('Refresh token invalid or expired');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('User no longer exists');
  if (user.refreshTokenVersion !== payload.ver) {
    throw unauthorized('Session was revoked');
  }

  res.json(issueSession(res, user));
}

export async function logout(req, res) {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.status(204).end();
}

/** Invalidate every outstanding refresh token for this user. */
export async function logoutAll(req, res) {
  req.user.refreshTokenVersion += 1;
  await req.user.save();
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.status(204).end();
}

export async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

export async function updateProfile(req, res) {
  req.user.profile = { ...req.user.profile.toObject(), ...req.body };
  await req.user.save();
  res.json({ user: publicUser(req.user) });
}
