import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../server/app';
import { Store } from '../server/db';
import { cameras } from '../shared/cameras';

const origin = 'http://localhost:5173';
const fixture = () => buildApp({ dbPath: ':memory:', origin, startWorker: false });
const rule = { cameraId: 'grca', kind: 'rain', threshold: 0, enabled: true };

test('sessions use an HttpOnly cookie and store only a token hash', async t => {
  const { app, store } = await fixture(); t.after(() => app.close());
  const response = await app.inject('/api/session');
  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers['set-cookie']), /HttpOnly/);
  assert.match(String(response.headers['set-cookie']), /SameSite=Strict/);
  const raw = response.cookies[0].value;
  const saved = store.db.prepare('SELECT id FROM sessions').get() as { id: string };
  assert.notEqual(saved.id, raw);
  const repeated = await app.inject({ url: '/api/session', cookies: { glim_session: raw } });
  assert.deepEqual(repeated.json().favorites, []);
  assert.equal(repeated.cookies.length, 0);
});
test('cross-origin and missing-origin writes are denied', async t => {
  const { app } = await fixture(); t.after(() => app.close());
  for (const attacker of ['https://evil.example', 'null', undefined]) {
    const response = await app.inject({ method: 'POST', url: '/api/rules', headers: attacker ? { origin: attacker } : {}, payload: rule });
    assert.equal(response.statusCode, 403);
  }
});
test('favorites and rules are isolated; another session cannot modify them', async t => {
  const { app } = await fixture(); t.after(() => app.close());
  const alice = (await app.inject('/api/session')).cookies[0].value;
  const bob = (await app.inject('/api/session')).cookies[0].value;
  const created = await app.inject({ method: 'POST', url: '/api/rules', headers: { origin }, cookies: { glim_session: alice }, payload: rule });
  assert.equal(created.statusCode, 201);
  const id = created.json().id as string;
  await app.inject({ method: 'POST', url: '/api/favorites', headers: { origin }, cookies: { glim_session: alice }, payload: { cameraId: 'grca', saved: true } });
  const bobSession = (await app.inject({ url: '/api/session', cookies: { glim_session: bob } })).json();
  assert.deepEqual(bobSession.rules, []); assert.deepEqual(bobSession.favorites, []);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/rules/${id}`, headers: { origin }, cookies: { glim_session: bob } })).statusCode, 404);
  assert.equal((await app.inject({ method: 'PATCH', url: `/api/rules/${id}`, headers: { origin }, cookies: { glim_session: bob }, payload: { enabled: false } })).statusCode, 404);
  const aliceSession = (await app.inject({ url: '/api/session', cookies: { glim_session: alice } })).json();
  assert.equal(aliceSession.rules.length, 1); assert.deepEqual(aliceSession.favorites, ['grca']);
});
test('duplicate rules, unknown cameras, arbitrary fields, and invalid wind thresholds are rejected', async t => {
  const { app } = await fixture(); t.after(() => app.close());
  const token = (await app.inject('/api/session')).cookies[0].value;
  const post = (payload: object) => app.inject({ method: 'POST', url: '/api/rules', headers: { origin }, cookies: { glim_session: token }, payload });
  assert.equal((await post(rule)).statusCode, 201);
  assert.equal((await post(rule)).statusCode, 409);
  assert.equal((await post({ ...rule, cameraId: 'unknown' })).statusCode, 404);
  assert.equal((await post({ ...rule, owner: 'someone-else' })).statusCode, 400);
  assert.equal((await post({ ...rule, kind: 'wind', threshold: 0 })).statusCode, 400);
  assert.equal((await post({ ...rule, kind: 'face-recognition' })).statusCode, 400);
});
test('session data deletion cascades through favorites, rules, events, and push', async t => {
  const { app, store } = await fixture(); t.after(() => app.close());
  const { owner, token } = store.session();
  store.favorite(owner, 'grca', true);
  const savedRule = store.addRule(owner, rule as Parameters<Store['addRule']>[1]);
  store.recordEvaluation({ ...savedRule, owner }, true, { ruleId: savedRule.id, cameraId: 'grca', title: 'Rain', body: 'Test event' });
  store.savePush(owner, { endpoint: 'https://fcm.googleapis.com/test' });
  const response = await app.inject({ method: 'DELETE', url: '/api/session', headers: { origin }, cookies: { glim_session: token! } });
  assert.equal(response.statusCode, 200);
  for (const table of ['sessions', 'favorites', 'rules', 'events', 'push']) assert.equal((store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n, 0);
});
test('saved data and sessions survive database reopening', () => {
  const directory = mkdtempSync(join(tmpdir(), 'glim-test-'));
  let store = new Store(join(directory, 'data.sqlite'));
  try {
    const { owner, token } = store.session();
    store.favorite(owner, 'grca', true);
    store.close(); store = new Store(join(directory, 'data.sqlite'));
    assert.equal(store.session(token).owner, owner);
    assert.deepEqual(store.favorites(owner), ['grca']);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('provider failure is a useful 503 response; arbitrary camera URLs cannot reach the backend', async t => {
  const { app } = await buildApp({ dbPath: ':memory:', origin, startWorker: false, weather: { get: async () => { throw new Error('sensitive provider detail'); } } });
  t.after(() => app.close());
  const response = await app.inject('/api/weather/grca');
  assert.equal(response.statusCode, 503);
  assert.doesNotMatch(response.body, /sensitive provider/);
  assert.equal((await app.inject('/api/weather/http%3A%2F%2F127.0.0.1')).statusCode, 404);
});
test('catalog contains unique coordinates, source links, and explicit redistribution status', () => {
  assert.equal(new Set(cameras.map(camera => camera.id)).size, cameras.length);
  for (const camera of cameras) {
    assert.equal(new URL(camera.sourceUrl).protocol, 'https:');
    assert.ok(camera.lat >= -90 && camera.lat <= 90); assert.ok(camera.lng >= -180 && camera.lng <= 180);
    assert.ok(new Intl.DateTimeFormat('en', { timeZone: camera.timezone }));
    if (camera.imageUrl) { assert.equal(camera.permission, 'public-domain'); assert.ok(camera.permissionUrl); }
    else assert.ok(camera.permission === 'source-link' || (camera.permission === 'platform-embed' && camera.media?.kind === 'youtube'));
  }
});
