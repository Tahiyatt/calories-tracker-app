import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, stopTestApp, clearDb, signUp, auth } from './helpers.mjs';

let request;

before(async () => { request = await startTestApp(); });
after(stopTestApp);
beforeEach(clearDb);

describe('registration', () => {
  test('creates an account and issues a session', async () => {
    const { res } = await signUp(request);

    assert.equal(res.status, 201);
    assert.ok(res.body.accessToken, 'expected an access token');
    assert.ok(res.body.user.id);
    assert.equal(res.body.user.email, res.body.user.email.toLowerCase());
  });

  test('never returns the password hash', async () => {
    const { res } = await signUp(request);
    assert.equal(JSON.stringify(res.body).includes('passwordHash'), false);
    assert.equal(res.body.user.passwordHash, undefined);
  });

  test('sets an httpOnly refresh cookie scoped to /api/auth', async () => {
    const { cookie } = await signUp(request);
    const refresh = cookie.find((c) => c.startsWith('ct_refresh='));

    assert.ok(refresh, 'expected a ct_refresh cookie');
    assert.match(refresh, /HttpOnly/i);
    assert.match(refresh, /Path=\/api\/auth/i);
  });

  test('rejects a duplicate email with 409', async () => {
    const { email } = await signUp(request);
    const res = await request
      .post('/api/auth/register')
      .send({ email, password: 'another-valid-password' });

    assert.equal(res.status, 409);
  });

  test('rejects a short password with a field-level 400', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: 'short@example.com', password: 'abc' });

    assert.equal(res.status, 400);
    assert.ok(res.body.issues.some((i) => i.path === 'password'));
  });
});

describe('login', () => {
  test('accepts the correct password', async () => {
    const { email, password } = await signUp(request);
    const res = await request.post('/api/auth/login').send({ email, password });

    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
  });

  test('gives the same error for a wrong password and an unknown email', async () => {
    const { email } = await signUp(request);

    const wrongPassword = await request
      .post('/api/auth/login')
      .send({ email, password: 'not-the-password' });

    const unknownEmail = await request
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'not-the-password' });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    // Identical wording, so the response cannot be used to discover which
    // email addresses have accounts.
    assert.equal(wrongPassword.body.error, unknownEmail.body.error);
  });
});

describe('protected routes', () => {
  test('401 without a token', async () => {
    assert.equal((await request.get('/api/entries/today')).status, 401);
  });

  test('401 with a malformed token', async () => {
    const res = await request.get('/api/entries/today').set(auth('not.a.jwt'));
    assert.equal(res.status, 401);
  });

  test('200 with a valid token', async () => {
    const { token } = await signUp(request);
    const res = await request.get('/api/entries/today').set(auth(token));
    assert.equal(res.status, 200);
  });
});

describe('refresh and revocation', () => {
  test('exchanges the cookie for a fresh access token', async () => {
    const { cookie } = await signUp(request);
    const res = await request.post('/api/auth/refresh').set('Cookie', cookie);

    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
  });

  test('401 with no cookie', async () => {
    assert.equal((await request.post('/api/auth/refresh')).status, 401);
  });

  test('logout-all invalidates outstanding refresh tokens', async () => {
    const { token, cookie } = await signUp(request);

    const before = await request.post('/api/auth/refresh').set('Cookie', cookie);
    assert.equal(before.status, 200);

    await request.post('/api/auth/logout-all').set(auth(token)).expect(204);

    // Same cookie, now carrying a stale refreshTokenVersion.
    const after = await request.post('/api/auth/refresh').set('Cookie', cookie);
    assert.equal(after.status, 401);
  });
});
