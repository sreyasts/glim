import { randomInt } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseCaltrans } from '../server/catalog';
import { approvedStreamUrl } from '../server/stream';
import type { Camera } from '../shared/types';

// Network diagnostics complement browser playback; they do not prove decoding.
const count = Math.min(200, Math.max(1, Number(process.argv[2]) || 100));
const cameras: Camera[] = [];
const failures: string[] = [];
for (let start = 1; start <= 12; start += 3) {
  await Promise.all(Array.from({ length: 3 }, (_, index) => start + index).map(async district => {
    try {
      const response = await fetch(`https://cwwp2.dot.ca.gov/data/d${district}/cctv/cctvStatusD${String(district).padStart(2, '0')}.json`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      cameras.push(...parseCaltrans(await response.json(), district).filter(camera => camera.media?.kind === 'hls'));
    } catch { failures.push(`district:${district}`); }
  }));
}
// Shuffle within districts, then interleave to avoid a sample dominated by LA.
const districts = Array.from({ length: 12 }, (_, index) => cameras.filter(camera => camera.id.startsWith(`caltrans:${index + 1}:`)));
for (const group of districts) for (let i = group.length - 1; i > 0; i--) { const j = randomInt(i + 1); [group[i], group[j]] = [group[j], group[i]]; }
const sample: Camera[] = [];
while (sample.length < count && districts.some(group => group.length)) for (const group of districts) { if (sample.length >= count) break; const camera = group.pop(); if (camera) sample.push(camera); }
type Result = { id: string; name: string; place: string; status: 'segments-received' | 'unavailable'; sequence?: number; refreshedSequence?: number; playlistUrl?: string; error?: string };
const results: Result[] = [];
async function playlist(url: string): Promise<string> {
  if (!approvedStreamUrl(url)) throw new Error('Unsupported upstream');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!text.startsWith('#EXTM3U') || text.length > 1024 * 1024) throw new Error('Invalid playlist');
  return text;
}
await Promise.all(Array.from({ length: 4 }, async (_, worker) => {
  for (let index = worker; index < sample.length; index += 4) {
    const camera = sample[index];
    let url = camera.media!.url;
    const result: Result = { id: camera.id, name: camera.name, place: camera.place, status: 'unavailable' };
    try {
      let text = await playlist(url);
      if (text.includes('#EXT-X-STREAM-INF')) {
        const variant = text.split(/\r?\n/).find(line => line.trim() && !line.startsWith('#'));
        if (!variant) throw new Error('Missing variant');
        url = new URL(variant, url).href; text = await playlist(url);
      }
      if (text.includes('#EXT-X-ENDLIST')) throw new Error('Ended recording');
      const segment = text.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#')).at(-1);
      if (!segment) throw new Error('Empty live window');
      const segmentUrl = new URL(segment, url).href;
      if (!approvedStreamUrl(segmentUrl)) throw new Error('Unsupported segment');
      const response = await fetch(segmentUrl, { redirect: 'error', signal: AbortSignal.timeout(10000) });
      const reader = response.body?.getReader();
      if (!response.ok || !reader) throw new Error(`Segment HTTP ${response.status}`);
      const first = await reader.read(); await reader.cancel();
      if (first.done || !first.value.length) throw new Error('Empty segment');
      result.status = 'segments-received'; result.sequence = Number(text.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/)?.[1]); result.playlistUrl = url;
    } catch (error) { result.error = (error as Error).message; }
    results.push(result);
  }
}));
// Recheck each successful live window after the initial batch has run.
await Promise.all(Array.from({ length: 4 }, async (_, worker) => {
  for (let index = worker; index < results.length; index += 4) {
    const result = results[index]; if (!result.playlistUrl) continue;
    try { result.refreshedSequence = Number((await playlist(result.playlistUrl)).match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/)?.[1]); } catch { /* Preserve initial segment result. */ }
    delete result.playlistUrl;
  }
}));
const report = { checkedAt: new Date().toISOString(), method: 'Random stratified Caltrans sample. Fetch live playlists and the first bytes of one segment, then recheck sequence. This is not browser playback verification.', catalogStreams: cameras.length, requested: count, sampled: results.length, segmentsReceived: results.filter(result => result.status === 'segments-received').length, advancingWindows: results.filter(result => Number.isFinite(result.sequence) && Number.isFinite(result.refreshedSequence) && result.refreshedSequence! > result.sequence!).length, catalogFailures: failures, results };
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/live-source-health.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, results: undefined }));
