import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/db';
import { AlertEngine, matchesRule } from '../server/engine';
import type { AlertEvent, Weather } from '../shared/types';

const weather = (overrides: Partial<Weather> = {}): Weather => ({ observedAt: new Date().toISOString(), fetchedAt: Date.now(), temperature: 12, precipitation: 2, snowfall: 0, windSpeed: 26, weatherCode: 61, isDay: true, sunrise: new Date(Date.now() + 10 * 60000).toISOString(), sunset: new Date(Date.now() + 8 * 3600000).toISOString(), ...overrides });

test('rain, snow, and wind rules respect actual thresholds', () => {
  assert.equal(matchesRule({ kind: 'rain', threshold: 0 }, weather()), true);
  assert.equal(matchesRule({ kind: 'rain', threshold: 3 }, weather()), false);
  assert.equal(matchesRule({ kind: 'rain', threshold: 0 }, weather({ snowfall: 1 })), false);
  assert.equal(matchesRule({ kind: 'snow', threshold: 0 }, weather({ snowfall: 0.5 })), true);
  assert.equal(matchesRule({ kind: 'wind', threshold: 26 }, weather()), true);
  assert.equal(matchesRule({ kind: 'wind', threshold: 27 }, weather()), false);
});
test('stale, missing, or future observations cannot trigger fresh alerts', () => {
  for (const observedAt of ['invalid', new Date(Date.now() - 60 * 60000).toISOString(), new Date(Date.now() + 10 * 60000).toISOString()]) {
    assert.equal(matchesRule({ kind: 'rain', threshold: 0 }, weather({ observedAt })), false);
  }
});
test('solar alerts only fire during the 15 minutes before the event', () => {
  assert.equal(matchesRule({ kind: 'sunrise', threshold: 0 }, weather()), true);
  assert.equal(matchesRule({ kind: 'sunset', threshold: 0 }, weather()), false);
  assert.equal(matchesRule({ kind: 'sunrise', threshold: 0 }, weather({ sunrise: new Date(Date.now() - 1000).toISOString() })), false);
  assert.equal(matchesRule({ kind: 'sunrise', threshold: 0 }, weather({ sunrise: '' })), false);
});
test('worker groups requests, detects transitions, deduplicates, and persists state across restarts', async () => {
  const store = new Store(':memory:');
  const alice = store.session().owner;
  const bob = store.session().owner;
  store.addRule(alice, { cameraId: 'grca', kind: 'rain', threshold: 0, enabled: true });
  store.addRule(bob, { cameraId: 'grca', kind: 'rain', threshold: 0, enabled: true });
  let calls = 0;
  const delivered: AlertEvent[] = [];
  const service = { get: async () => { calls++; return weather(); } };
  const engine = new AlertEngine(store, service, async (_, event) => { delivered.push(event); });
  await engine.tick();
  assert.equal(calls, 1, 'one request for two users watching one camera');
  assert.equal(delivered.length, 2);
  await new AlertEngine(store, service, async (_, event) => { delivered.push(event); }).tick();
  assert.equal(delivered.length, 2, 'a worker restart must not repeat an unchanged condition');
  assert.equal(store.events(alice).length, 1);
  assert.equal(store.events(bob).length, 1);
  store.close();
});
test('paused rules and provider failures do not produce alerts', async () => {
  const store = new Store(':memory:');
  const owner = store.session().owner;
  const rule = store.addRule(owner, { cameraId: 'grca', kind: 'rain', threshold: 0, enabled: false });
  let calls = 0;
  const service = { get: async () => { calls++; throw new Error('offline'); } };
  const engine = new AlertEngine(store, service, async () => assert.fail('must not deliver'), () => {});
  await engine.tick();
  assert.equal(calls, 0);
  store.setRule(owner, rule.id, true);
  await engine.tick();
  assert.equal(calls, 1);
  assert.equal(store.events(owner).length, 0);
  assert.equal(store.activeRules()[0].matched, 0);
  store.close();
});
test('clearing conditions resets the edge, but the hourly cooldown still applies', async () => {
  const store = new Store(':memory:');
  const owner = store.session().owner;
  store.addRule(owner, { cameraId: 'grca', kind: 'rain', threshold: 0, enabled: true });
  let rain = 1;
  const engine = new AlertEngine(store, { get: async () => weather({ precipitation: rain }) }, async () => {});
  await engine.tick(); rain = 0; await engine.tick(); rain = 1; await engine.tick();
  assert.equal(store.events(owner).length, 1);
  rain = 0; await engine.tick();
  store.db.prepare('UPDATE rules SET triggered=?').run(Date.now() - 61 * 60000);
  rain = 1; await engine.tick();
  assert.equal(store.events(owner).length, 2);
  store.close();
});

test('stale observations do not reset a previously matched condition', async () => {
  const store = new Store(':memory:');
  const owner = store.session().owner;
  store.addRule(owner, { cameraId: 'grca', kind: 'rain', threshold: 0, enabled: true });
  let stale = false;
  const engine = new AlertEngine(store, { get: async () => weather({ observedAt: new Date(Date.now() - (stale ? 2 * 3600000 : 0)).toISOString() }) }, async () => {}, () => {});
  await engine.tick();
  store.db.prepare('UPDATE rules SET triggered=?').run(Date.now() - 61 * 60000);
  stale = true; await engine.tick();
  assert.equal(store.activeRules()[0].matched, 1);
  stale = false; await engine.tick();
  assert.equal(store.events(owner).length, 1);
  store.close();
});
