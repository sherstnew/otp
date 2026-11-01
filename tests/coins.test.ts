import test from 'node:test';
import assert from 'node:assert/strict';
import { seed, loadState, purchase, grant } from '../src/domain/model';
import { awardCoins, COIN_ACTIVITIES, COIN_POLICY, issuedCoins, policyDate, policyYear } from '../src/domain/coins';
const input = { id: 'award', actorId: 'e3', employeeId: 'e1', activity: 'community' as const, eventId: 'design-meetup', eventDate: policyDate(), reason: 'Участие подтверждено организатором' };
test('fixed tariffs credit coins with audit trail and preserve rating', () => {
  for (const rule of COIN_ACTIVITIES) {
    const s = seed(), n = awardCoins(s, { ...input, activity: rule.id });
    assert.equal(n.employees[0].coins, s.employees[0].coins + rule.amount);
    assert.equal(n.employees[0].rating, s.employees[0].rating);
    assert.equal(n.entries[0].amount, rule.amount);
    assert.equal(n.entries[0].authorId, 'e3');
    assert.equal(n.coinAwards[0].eventId, input.eventId);
    assert.deepEqual(loadState(JSON.stringify(n)), n);
    assert.equal(s.coinAwards.length, 0);
  }
});
test('same operation is idempotent; same event with a new operation or activity cannot be paid twice', () => {
  const n = awardCoins(seed(), input);
  assert.equal(awardCoins(n, input), n);
  assert.throws(() => awardCoins(n, { ...input, id: 'new' }), /уже оплачено/);
  assert.throws(() => awardCoins(n, { ...input, id: 'new', activity: 'birthday' }), /уже оплачено/);
  assert.doesNotThrow(() => awardCoins(n, { ...input, id: 'other', employeeId: 'e4' }));
});
test('four community events per year; rejection never mutates balances', () => {
  let s = seed();
  for (let i = 0; i < 4; i++) s = awardCoins(s, { ...input, id: `a${i}`, eventId: `event${i}` });
  const before = JSON.stringify(s);
  assert.throws(() => awardCoins(s, { ...input, id: 'fifth', eventId: 'fifth' }), /Лимит/);
  assert.equal(JSON.stringify(s), before);
});
test('once-per-year and lifetime limits survive reload', () => {
  for (const rule of COIN_ACTIVITIES.filter(a => a.limit === 1)) {
    const n = loadState(JSON.stringify(awardCoins(seed(), { ...input, activity: rule.id })));
    assert.throws(() => awardCoins(n, { ...input, id: 'new', eventId: 'another', activity: rule.id }), /Лимит/);
  }
  const n = awardCoins(seed(), { ...input, activity: 'first-login' });
  n.coinAwards[0].eventDate = `${policyYear() - 1}-01-01`;
  assert.throws(() => awardCoins(n, { ...input, id: 'next', eventId: 'next', activity: 'first-login' }), /Лимит/);
  n.coinAwards[0].activity = 'birthday';
  assert.doesNotThrow(() => awardCoins(n, { ...input, id: 'next', eventId: 'next', activity: 'birthday' }));
});
test('only HR and valid confirmed event data can issue coins; arbitrary coin grants blocked', () => {
  for (const change of [{ actorId: 'e1' }, { actorId: 'e2' }, { employeeId: 'missing' }, { reason: ' ' }, { eventId: ' ' }, { id: '' }, { eventDate: `${policyYear()}-02-30` }, { eventDate: `${policyYear() + 1}-01-01` }, { eventDate: `${policyYear() - 1}-01-01` }]) assert.throws(() => awardCoins(seed(), { ...input, ...change }));
  assert.throws(() => grant(seed(), { id: 'manual', actorId: 'e3', employeeId: 'e1', kind: 'coins', amount: 1, reason: 'Без тарифа' }), /событие/);
});
test('budget includes legacy issuance, accepts exact ceiling, and spending does not replenish it', () => {
  const s = seed();
  s.entries = [{ id: 'legacy', employeeId: 'e1', authorId: 'e3', kind: 'coins', amount: COIN_POLICY.annualCeiling - 1000, reason: 'Предыдущие выдачи', date: new Date().toISOString() }];
  const n = awardCoins(s, input);
  assert.equal(issuedCoins(n), COIN_POLICY.annualCeiling);
  const spent = purchase(n, { id: 'buy', employeeId: 'e1', productId: 'p1' });
  assert.equal(issuedCoins(spent), COIN_POLICY.annualCeiling);
  assert.throws(() => awardCoins(spent, { ...input, id: 'over', eventId: 'over' }), /лимит выпуска/);
});
test('v1 migration preserves balances, purchases, and processed ids', () => {
  const old = purchase(seed(), { id: 'old-buy', employeeId: 'e1', productId: 'p1' });
  const { coinAwards: _, ...v1 } = old;
  const loaded = loadState(JSON.stringify(v1));
  assert.equal(loaded.employees[0].coins, old.employees[0].coins);
  assert.deepEqual(loaded.orders, old.orders);
  assert.deepEqual(loaded.coinAwards, []);
  assert.equal(purchase(loaded, { id: 'old-buy', employeeId: 'e1', productId: 'p1' }), loaded);
});
test('catalog migration applies 5:1 to certificates while preserving order snapshots', () => {
  const s = seed();
  s.products.find(p => p.id === 'p4')!.price = 2000;
  s.products.find(p => p.id === 'p4')!.description = 'Новая история. Демонстрационный сертификат на 1 000 ₽.';
  const old = purchase(s, { id: 'old-certificate', employeeId: 'e1', productId: 'p4' });
  const loaded = loadState(JSON.stringify(old));
  assert.equal(loaded.products.find(p => p.id === 'p4')!.price, 5000);
  assert.equal(loaded.products.find(p => p.id === 'p4')!.description, 'Новая история. Сертификат на 1 000 ₽.');
  assert.equal(loaded.orders[0].price, 2000);
  assert.equal(loaded.employees[0].coins, 2250);
});
