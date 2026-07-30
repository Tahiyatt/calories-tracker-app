process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/ct-test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-aaaaaaaaaaaaaaaaaaaa';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-bbbbbbbbbbbbbbbbbbb';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

console.log('\n1. Every module imports cleanly');
const mods = [
  '../packages/server/src/app.js',
  '../packages/server/src/config/env.js',
  '../packages/server/src/utils/tokens.js',
  '../packages/server/src/utils/httpError.js',
  '../packages/server/src/middleware/requireAuth.js',
  '../packages/server/src/middleware/validate.js',
  '../packages/server/src/services/foodEntryService.js',
  '../packages/server/src/services/goalService.js',
  '../packages/server/src/services/weightLogService.js',
  '../packages/server/src/controllers/authController.js',
  '../packages/server/src/controllers/foodEntryController.js',
  '../packages/server/src/controllers/goalController.js',
  '../packages/server/src/controllers/weightLogController.js',
];
for (const m of mods) {
  try { await import(m); check(m.split('/src/')[1], true); }
  catch (e) { check(m.split('/src/')[1], false, '\n       ' + e.message); }
}

console.log('\n2. Token round-trip and revocation');
const t = await import('../packages/server/src/utils/tokens.js');
const fakeUser = { _id: { toString: () => '507f1f77bcf86cd799439011' }, refreshTokenVersion: 3 };
const access = t.signAccessToken(fakeUser);
const refreshTok = t.signRefreshToken(fakeUser);
check('access token verifies, sub matches', t.verifyAccessToken(access).sub === '507f1f77bcf86cd799439011');
check('refresh token carries version', t.verifyRefreshToken(refreshTok).ver === 3);
let crossed = false;
try { t.verifyAccessToken(refreshTok); } catch { crossed = true; }
check('refresh token rejected by access verifier (separate secrets)', crossed);
const opts = t.refreshCookieOptions();
check('refresh cookie is httpOnly', opts.httpOnly === true);
check('refresh cookie scoped to /api/auth', opts.path === '/api/auth');

console.log('\n3. bcrypt');
const bcrypt = (await import('bcrypt')).default;
const hash = await bcrypt.hash('correct-horse', 12);
check('correct password compares true', await bcrypt.compare('correct-horse', hash));
check('wrong password compares false', !(await bcrypt.compare('wrong', hash)));
check('hash cost factor is 12', hash.startsWith('$2b$12$'));

console.log('\n4. Zod schemas');
const s = await import('@ct/shared');
check('register rejects short password',
  !s.registerSchema.safeParse({ email: 'a@b.co', password: 'short' }).success);
check('register lowercases email',
  s.registerSchema.parse({ email: '  A@B.CO ', password: 'longenough1' }).email === 'a@b.co');
check('quickAdd requires kcal',
  !s.quickAddFoodEntrySchema.safeParse({ name: 'x', nutrients: {}, mealType: 'lunch', consumedAt: new Date() }).success);
const qa = s.quickAddFoodEntrySchema.parse({
  name: 'Toast', nutrients: { kcal: 120 }, mealType: 'breakfast', consumedAt: '2026-07-29T08:00:00Z' });
check('quickAdd defaults macros to 0', qa.nutrients.protein === 0 && qa.nutrients.fat === 0);
check('createFoodEntry needs servingLabel when unit=serving',
  !s.createFoodEntrySchema.safeParse({ foodId: '507f1f77bcf86cd799439011', quantity: 1, unit: 'serving', mealType: 'lunch', consumedAt: new Date() }).success);
check('listEntries rejects date+from together',
  !s.listFoodEntriesSchema.safeParse({ date: '2026-07-29', from: '2026-07-01' }).success);
check('update rejects empty patch', !s.updateFoodEntrySchema.safeParse({}).success);
check('goal rejects bad date format',
  !s.createGoalSchema.safeParse({ effectiveFrom: '29/07/2026', targets: { kcal: 2000, protein: 150, carbs: 200, fat: 60 } }).success);

console.log('\n5. Shared maths and date helpers');
check('scaleNutrients 59/100g x 170g = 100.3 kcal', s.scaleNutrients({ kcal: 59 }, 170).kcal === 100.3);
check('sumNutrients adds two entries',
  s.sumNutrients([{ nutrients: { kcal: 100.3 } }, { nutrients: { kcal: 100.3 } }]).kcal === 200.6);
check('shiftLocalDate crosses month boundary', s.shiftLocalDate('2026-08-01', -1) === '2026-07-31');
check('shiftLocalDate crosses year boundary', s.shiftLocalDate('2026-01-01', -1) === '2025-12-31');
check('shiftLocalDate handles leap day', s.shiftLocalDate('2028-02-28', 1) === '2028-02-29');
check('localDateFor respects timezone',
  s.localDateFor(new Date('2026-07-30T03:00:00Z'), 'America/New_York') === '2026-07-29');

console.log('\n6. HTTP layer (paths that do not touch the database)');
const { createApp } = await import('../packages/server/src/app.js');
const app = createApp();
const srv = app.listen(4999);
const base = 'http://127.0.0.1:4999';
const get = (p, h) => fetch(base + p, { headers: h });

check('GET /api/health responds', (await get('/api/health')).status === 503);
check('unknown route -> 404', (await get('/api/nope')).status === 404);
check('protected route without token -> 401', (await get('/api/entries/today')).status === 401);
check('protected route with garbage token -> 401',
  (await get('/api/entries/today', { Authorization: 'Bearer not.a.jwt' })).status === 401);
check('protected route with wrong-secret token -> 401',
  (await get('/api/entries/today', { Authorization: 'Bearer ' + refreshTok })).status === 401);

const badReg = await fetch(base + '/api/auth/register', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'not-an-email', password: 'x' }) });
const badBody = await badReg.json();
check('register with bad payload -> 400', badReg.status === 400);
check('400 lists the failing fields',
  Array.isArray(badBody.issues) && badBody.issues.some(i => i.path === 'email'),
  JSON.stringify(badBody));

const noCookie = await fetch(base + '/api/auth/refresh', { method: 'POST' });
check('refresh without cookie -> 401', noCookie.status === 401);

srv.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
