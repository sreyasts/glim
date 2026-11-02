import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Geocoder } from '../server/geocoder';

const geocoder = new Geocoder();
test('city search returns actual city coordinates without an oversized administrative bounding box', async () => {
  const [tokyo] = await geocoder.search('Tokyo');
  assert.match(tokyo.name, /Tokyo, Japan/); assert.ok(tokyo.lat > 35 && tokyo.lat < 36); assert.ok(tokyo.lng > 139 && tokyo.lng < 140);
  assert.equal(tokyo.bounds, undefined);
});
test('country search returns an overview with valid geographic bounds', async () => {
  const [india] = await geocoder.search('India');
  assert.equal(india.name, 'India'); assert.equal(india.id, 'country:IN'); assert.equal(india.bounds?.length, 4);
  assert.ok(india.bounds![0] < india.bounds![2]); assert.ok(india.bounds![1] < india.bounds![3]);
});
test('place search supports diacritics, city aliases, and empty results', async () => {
  assert.match((await geocoder.search('Zurich'))[0].name, /Zürich|Zurich/);
  assert.ok((await geocoder.search('Bangalore')).some(place => /Bengaluru|Bangalore/.test(place.name)));
  assert.deepEqual(await geocoder.search('xqzzno-such-place-729'), []);
  assert.deepEqual(await geocoder.search(' '), []);
});
