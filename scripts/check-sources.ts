import { cameras } from '../shared/cameras';

// Manual maintenance tool; does not scan for or discover devices.
let failures = 0;
for (let index = 0; index < cameras.length; index += 3) {
  await Promise.all(cameras.slice(index, index + 3).map(async camera => {
    for (const [kind, url] of [['page', camera.sourceUrl], ...(camera.imageUrl ? [['image', camera.imageUrl]] : [])]) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Glim-source-check/0.1 (manual directory maintenance)' } });
        const type = response.headers.get('content-type') ?? '';
        const okay = response.ok && (kind !== 'image' || type.startsWith('image/'));
        if (!okay) failures++;
        console.log(JSON.stringify({ id: camera.id, kind, status: response.status, contentType: type, okay, finalUrl: response.url, lastModified: response.headers.get('last-modified') }));
        await response.body?.cancel();
      } catch { failures++; console.log(JSON.stringify({ id: camera.id, kind, okay: false, error: 'Network request failed or timed out' })); }
    }
  }));
}
console.log(`${failures} source check(s) need review. A 200 response does not establish live capture freshness or embedding permission.`);
process.exitCode = failures ? 1 : 0;
