import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Catalog, inBounds, matchesFormat, parseCaltrans, parseTfl, parseWindyCamera, publicHttps } from '../server/catalog';
import { approvedStreamUrl, rewritePlaylist } from '../server/stream';
import { buildApp } from '../server/app';

const caltrans = {
  data: [{ cctv: { index: '7', inService: 'true', location: { locationName: 'Bay Bridge', nearbyPlace: 'Oakland', latitude: '37.82', longitude: '-122.3' }, imageData: { streamingVideoURL: 'https://wzmedia.dot.ca.gov/D4/camera.stream/playlist.m3u8', static: { currentImageURL: 'https://cwwp2.dot.ca.gov/data/camera.jpg', currentImageUpdateFrequency: '5' } } } }],
};
const tfl = [{ id: 'JamCams_001', commonName: 'Oxford Street', lat: 51.51, lon: -0.14, additionalProperties: [
  { key: 'available', value: 'true' }, { key: 'imageUrl', value: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/001.jpg' }, { key: 'videoUrl', value: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/001.mp4' },
] }];
const windy = { webcamId: 1234567890, title: 'Harbor', status: 'active', location: { latitude: 35, longitude: 139, city: 'Tokyo', country: 'Japan' }, images: { current: { preview: 'https://images-webcams.windy.com/a.jpg?token=expiring-public-image-token' } }, player: { live: 'https://webcams.windy.com/webcams/public/embed/player/1234567890/live' }, urls: { detail: 'https://www.windy.com/webcams/1234567890' } };

test('Caltrans exposes stable IDs, true stream format, and operator-provided update frequency', () => {
  const items = parseCaltrans(caltrans, 4);
  assert.equal(items.length, 1); assert.equal(items[0].id, 'caltrans:4:7');
  assert.equal(items[0].media?.kind, 'hls'); assert.equal(items[0].media?.live, true);
  assert.equal(items[0].refreshSeconds, 5);
  assert.equal(parseCaltrans({ data: [{ cctv: { ...caltrans.data[0].cctv, inService: 'false' } }] }, 4).length, 0);
});
test('TfL short clips cannot be mislabeled as live streams', () => {
  const items = parseTfl(tfl); assert.equal(items.length, 1);
  assert.equal(items[0].media?.kind, 'mp4'); assert.equal(items[0].media?.live, false);
  assert.equal(matchesFormat(items[0], 'live'), false); assert.equal(matchesFormat(items[0], 'video'), true);
});
test('provider media URLs reject internal, credentialed, or unrelated hosts', () => {
  for (const bad of ['http://127.0.0.1/image.jpg', 'https://dot.ca.gov.evil.example/image.jpg', 'https://user:secret@wzmedia.dot.ca.gov/stream', 'https://wzmedia.dot.ca.gov:8443/stream']) {
    assert.equal(approvedStreamUrl(bad), undefined);
    const input = structuredClone(caltrans); input.data[0].cctv.imageData.streamingVideoURL = bad;
    assert.equal(parseCaltrans(input, 4)[0].media, undefined);
  }
  assert.equal(publicHttps('not a URL', () => true), undefined);
});
test('Windy parsing separates live players, timelapses, and expiring image URLs', () => {
  const live = parseWindyCamera(windy)!; assert.equal(live.id, 'windy:1234567890'); assert.equal(live.media?.live, true);
  assert.equal(live.media?.url, 'https://webcams.windy.com/webcams/stream/1234567890', 'embed the actual operator stream rather than its clickable preview');
  assert.ok(live.imageUrl?.includes('token='));
  const lapse = parseWindyCamera({ ...windy, player: { day: 'https://webcams.windy.com/webcams/public/embed/player/1234567890/day' } })!;
  assert.equal(lapse.media?.live, false); assert.equal(lapse.media?.kind, 'embed');
  assert.equal(parseWindyCamera({ ...windy, status: 'inactive' }), null);
  assert.equal(parseWindyCamera({ ...windy, location: { latitude: 900, longitude: 0 } }), null);
});
test('bounds correctly handle antimeridian regions', () => {
  assert.equal(inBounds({ lat: 0, lng: 179 }, [170, -10, -170, 10]), true);
  assert.equal(inBounds({ lat: 0, lng: -179 }, [170, -10, -170, 10]), true);
  assert.equal(inBounds({ lat: 0, lng: 0 }, [170, -10, -170, 10]), false);
});

test('country discovery uses the provider country filter and returns only that country', async () => {
  const urls: URL[] = [];
  const catalog = new Catalog('test', async input => {
    urls.push(new URL(String(input)));
    return new Response(JSON.stringify({ webcams: [{ ...windy, location: { ...windy.location, country_code: 'JP' } }], total: 1 }));
  });
  await catalog.discover(undefined, 0, 'JP');
  assert.equal(urls[0].searchParams.get('countries'), 'JP');
  assert.equal(urls[0].searchParams.has('bbox'), false);
  assert.deepEqual(catalog.list(undefined, '', 'all', 150, 'JP').cameras.map(camera => camera.id), ['windy:1234567890']);
  assert.ok(catalog.list(undefined, '', 'all', 150, 'IN').cameras.every(camera => camera.country === 'India'));
  await assert.rejects(catalog.discover(undefined, 0, 'INVALID'), /Invalid country code/);
});

test('Windy discovery splits antimeridian bounds into two valid provider requests', async () => {
  const boxes: string[] = [];
  const catalog = new Catalog('test', async url => { boxes.push(new URL(String(url)).searchParams.get('bbox')!); return new Response(JSON.stringify({ webcams: [], total: 0 })); });
  await catalog.discover([170, -10, -170, 10]);
  assert.equal(boxes.length, 2);
  assert.ok(boxes.includes('10,180,-10,170')); assert.ok(boxes.includes('10,-170,-10,-180'));
});

test('provider deep links resolve immediately after startup instead of depending on background refresh', async () => {
  let calls = 0;
  const catalog = new Catalog(undefined, async url => { calls++; return new Response(JSON.stringify(String(url).includes('tfl') ? tfl : caltrans)); });
  assert.equal((await catalog.resolve('caltrans:4:7'))?.name, 'Bay Bridge');
  assert.equal((await catalog.resolve('tfl:001'))?.name, 'Oxford Street');
  assert.equal(calls, 2);
  assert.equal(await catalog.resolve('caltrans:99:1'), undefined);
  assert.equal(calls, 2, 'invalid districts must never trigger network requests');
});
test('Windy requests are coalesced, short-cached, and keep API keys out of responses', async () => {
  let calls = 0;
  const secret = 'test-server-only-credential';
  const fetcher: typeof fetch = async (url, init) => {
    calls++; assert.ok(String(url).startsWith('https://api.windy.com/'));
    assert.equal((init?.headers as Record<string, string>)['x-windy-api-key'], secret);
    return new Response(JSON.stringify({ webcams: [windy], total: 50000 }), { status: 200 });
  };
  const catalog = new Catalog(secret, fetcher);
  await Promise.all([catalog.discover(), catalog.discover()]);
  await catalog.discover(); assert.equal(calls, 1);
  await assert.rejects(catalog.discover(undefined, 1000), /Invalid discovery offset/);
  await assert.rejects(catalog.discover(undefined, 25), /Invalid discovery offset/);
  await catalog.discover(undefined, 50); assert.equal(calls, 2, 'pagination must use a separate cache key');
  const result = catalog.list(); assert.ok(result.cameras.some(cam => cam.id === 'windy:1234567890'));
  assert.ok(!JSON.stringify(result).includes(secret)); assert.ok(!JSON.stringify(catalog.summary()).includes(secret));
});
test('HLS relay rewrites segment, variant, and encryption-key references and blocks foreign hosts', () => {
  const source = 'https://wzmedia.dot.ca.gov/D4/camera/playlist.m3u8';
  const text = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nquality/index.m3u8\nsegment001.ts\n';
  const rewritten = rewritePlaylist(text, source, 'caltrans:4:7');
  assert.match(rewritten, /\/api\/stream\/caltrans%3A4%3A7\?part=/);
  assert.ok(!rewritten.includes('URI="key.bin"'));
  assert.throws(() => rewritePlaylist('#EXTM3U\nhttps://127.0.0.1/secret\n', source, 'caltrans:4:7'));
  assert.throws(() => rewritePlaylist('#EXTM3U\nhttp://wzmedia.dot.ca.gov/segment.ts\n', source, 'caltrans:4:7'));
});
test('catalog API validates map queries and resolves discovered provider IDs in private actions', async t => {
  const catalog = new Catalog('test', async () => new Response(JSON.stringify({ webcams: [windy], total: 1 })));
  await catalog.discover();
  const { app } = await buildApp({ dbPath: ':memory:', startWorker: false, catalog }); t.after(() => app.close());
  assert.equal((await app.inject('/api/cameras?bbox=-181,-90,180,90')).statusCode, 400);
  assert.equal((await app.inject('/api/cameras?limit=99999')).statusCode, 400);
  const detail = await app.inject('/api/cameras/windy%3A1234567890'); assert.equal(detail.statusCode, 200);
  assert.ok(!detail.body.includes('x-windy-api-key'));
  const token = (await app.inject('/api/session')).cookies[0].value;
  const saved = await app.inject({ method: 'POST', url: '/api/favorites', headers: { origin: 'http://localhost:5173' }, cookies: { glim_session: token }, payload: { cameraId: 'windy:1234567890', saved: true } });
  assert.equal(saved.statusCode, 200);
  const map = (await app.inject('/api/cameras/map')).json();
  assert.ok(map.features.some((item: { properties: { id: string } }) => item.properties.id === 'windy:1234567890'));
});
