import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import supertest from 'supertest';

let mongod;

/**
 * Boot an isolated in-memory MongoDB and the real Express app against it.
 *
 * Environment has to be set before importing anything, because utils/tokens.js
 * calls loadEnv() at module scope — so app.js is imported dynamically here
 * rather than at the top of the file.
 */
export async function startTestApp() {
  // CI supplies a real MongoDB service container via MONGODB_TEST_URI, which is
  // faster and avoids downloading a mongod binary on every run. Locally, fall
  // back to an in-memory instance so `npm test` works with no setup.
  const uri = process.env.MONGODB_TEST_URI
    ?? (mongod = await MongoMemoryServer.create()).getUri();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = uri;
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-aaaaaaaaaaaaaaaaaaaaaaaa';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-bbbbbbbbbbbbbbbbbbbbbb';
  process.env.COOKIE_SECURE = 'false';

  await mongoose.connect(process.env.MONGODB_URI);

  const { createApp } = await import('../src/app.js');
  return supertest(createApp());
}

export async function stopTestApp() {
  await mongoose.disconnect();
  await mongod?.stop();
}

/** Drop every document between tests so they cannot leak into each other. */
export async function clearDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

let seq = 0;

/** Register a user and return their bearer token plus the raw response. */
export async function signUp(request, overrides = {}) {
  seq += 1;
  const payload = {
    email: `user${seq}@example.com`,
    password: 'correct-horse-battery',
    profile: { timezone: 'UTC', displayName: `User ${seq}` },
    ...overrides,
  };

  const res = await request.post('/api/auth/register').send(payload);
  return {
    token: res.body.accessToken,
    user: res.body.user,
    cookie: res.headers['set-cookie'],
    email: payload.email,
    password: payload.password,
    res,
  };
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });
