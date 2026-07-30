process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/ct-test';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);

let pass = 0, fail = 0;
const check = (n, c, x = '') => { c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`)); };
const s = await import('@ct/shared');

console.log('\n1. macroSplit — Atwater factors and shares');
const ms = s.macroSplit({ protein: 100, carbs: 100, fat: 100 });
check('protein 100g -> 400 kcal', ms.kcalFrom.protein === 400);
check('carbs 100g -> 400 kcal', ms.kcalFrom.carbs === 400);
check('fat 100g -> 900 kcal (9/g, not 4)', ms.kcalFrom.fat === 900);
check('total macro kcal = 1700', ms.macroKcal === 1700);
check('fat share 52.9%', ms.share.fat === 52.9, `got ${ms.share.fat}`);
check('shares sum to ~100', Math.abs(ms.share.protein + ms.share.carbs + ms.share.fat - 100) < 0.2);
const zero = s.macroSplit({});
check('empty input -> zero shares, no NaN', zero.share.protein === 0 && zero.macroKcal === 0);

console.log('\n2. fillDateGaps');
const sparse = [{ date: '2026-07-28', kcal: 2000 }, { date: '2026-07-31', kcal: 1800 }];
const filled = s.fillDateGaps(sparse, '2026-07-28', '2026-08-01');
check('produces one row per day inclusive', filled.length === 5, `got ${filled.length}`);
check('dates are contiguous', filled.map(d => d.date).join(',') === '2026-07-28,2026-07-29,2026-07-30,2026-07-31,2026-08-01');
check('present days flagged logged', filled[0].logged === true && filled[3].logged === true);
check('missing days flagged not logged', filled[1].logged === false && filled[2].logged === false);
check('missing days zero-filled, not undefined', filled[1].kcal === 0 && filled[1].protein === 0);
check('existing values preserved', filled[3].kcal === 1800);
const monthCross = s.fillDateGaps([], '2026-01-30', '2026-02-02');
check('crosses month boundary', monthCross.length === 4 && monthCross[2].date === '2026-02-01');
const leap = s.fillDateGaps([], '2028-02-27', '2028-03-01');
check('handles leap year (2028-02-29 exists)', leap.length === 4 && leap[2].date === '2028-02-29', leap.map(d=>d.date).join(','));

console.log('\n3. computeStreaks');
const L = (logged) => logged.map((l, i) => ({ date: `2026-07-${String(i + 1).padStart(2, '0')}`, logged: l }));
const st1 = s.computeStreaks(L([true, true, true, false, true, true]));
check('longest run found', st1.longest === 3, `got ${st1.longest}`);
check('current run counts back from end', st1.current === 2, `got ${st1.current}`);
check('daysLogged counts all', st1.daysLogged === 5);
const st2 = s.computeStreaks(L([true, true, true, false]));
check('empty final day does not break current streak', st2.current === 3, `got ${st2.current}`);
const st3 = s.computeStreaks(L([true, false, false]));
check('two empty days at end does break it', st3.current === 0, `got ${st3.current}`);
check('all empty -> zeros', s.computeStreaks(L([false, false])).longest === 0);
check('empty array -> zeros, no crash', s.computeStreaks([]).longest === 0);

console.log('\n4. classifyDay / adherenceBreakdown');
check('unlogged day', s.classifyDay({ logged: false }) === 'unlogged');
check('logged with no goal -> untracked, not a failure',
  s.classifyDay({ logged: true, kcal: 2000, targetKcal: null }) === 'untracked');
check('within 5% -> on-target', s.classifyDay({ logged: true, kcal: 2040, targetKcal: 2000 }) === 'on-target');
check('6% over -> over', s.classifyDay({ logged: true, kcal: 2120, targetKcal: 2000 }) === 'over');
check('well under -> under', s.classifyDay({ logged: true, kcal: 1200, targetKcal: 2000 }) === 'under');
const ad = s.adherenceBreakdown([
  { logged: true, kcal: 2000, targetKcal: 2000 },
  { logged: true, kcal: 2000, targetKcal: 2000 },
  { logged: true, kcal: 2600, targetKcal: 2000 },
  { logged: false },
  { logged: true, kcal: 1500, targetKcal: null },
]);
check('counts on-target', ad['on-target'] === 2);
check('counts over', ad.over === 1);
check('tracked excludes untracked and unlogged', ad.tracked === 3, `got ${ad.tracked}`);
check('onTargetRate = 2/3 = 67%', ad.onTargetRate === 67, `got ${ad.onTargetRate}`);
check('no tracked days -> null rate, not NaN',
  s.adherenceBreakdown([{ logged: false }]).onTargetRate === null);

console.log('\n5. movingAverage');
const w = [80, 81, 79, 80, 82, 81, 80, 78].map((weightKg, i) => ({ date: `d${i}`, weightKg }));
const avg = s.movingAverage(w, 7);
check('first point averages itself', avg[0].trend === 80);
check('second averages two points', avg[1].trend === 80.5);
check('window caps at 7 documents', avg[7].trend === Math.round(((81+79+80+82+81+80+78)/7)*100)/100, `got ${avg[7].trend}`);
check('original values untouched', avg[4].weightKg === 82);
check('empty input -> empty output', s.movingAverage([], 7).length === 0);

console.log('\n6. Pipeline shape (structure only — no MongoDB in this sandbox)');
const A = await import('../packages/server/src/services/analyticsService.js');
check('analyticsService imports cleanly', typeof A.dashboard === 'function');
check('exports dailySeries/mealBreakdown/topFoods/weightSeries',
  ['dailySeries','mealBreakdown','topFoods','weightSeries'].every(f => typeof A[f] === 'function'));

const user = { _id: 'u1', profile: { timezone: 'America/New_York' } };
const r1 = A.resolveRange({ days: 7 }, user);
check('resolveRange(days:7) spans 7 days inclusive',
  s.fillDateGaps([], r1.from, r1.to).length === 7, JSON.stringify(r1));
const r2 = A.resolveRange({ from: '2026-01-01', to: '2026-01-31' }, user);
check('explicit from/to passes through', r2.from === '2026-01-01' && r2.to === '2026-01-31');
const r3 = A.resolveRange({}, user);
check('defaults to 30 days', s.fillDateGaps([], r3.from, r3.to).length === 30);

check('rangeQuery rejects days + from together',
  !s.rangeQuery.safeParse({ days: 7, from: '2026-01-01' }).success);
check('rangeQuery accepts days alone', s.rangeQuery.safeParse({ days: 30 }).success);
check('rangeQuery caps days at 366', !s.rangeQuery.safeParse({ days: 400 }).success);

console.log(`\n${pass} passed, ${fail} failed`);
console.log('NOTE: the aggregation pipelines themselves are unverified — no MongoDB here.\n');
process.exit(fail ? 1 : 0);
