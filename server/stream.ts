import { Readable } from 'node:stream';
import type { FastifyReply } from 'fastify';
import type { Camera } from '../shared/types';
import { publicHttps } from './catalog';

export function approvedStreamUrl(value: string): string | undefined {
  return publicHttps(value, url => url.hostname.endsWith('.dot.ca.gov'));
}
export function rewritePlaylist(text: string, upstream: string, cameraId: string): string {
  const proxied = (value: string): string => {
    const resolved = new URL(value, upstream).href;
    if (!approvedStreamUrl(resolved)) throw new Error('Stream references an unsupported host');
    return `/api/stream/${encodeURIComponent(cameraId)}?part=${Buffer.from(resolved).toString('base64url')}`;
  };
  return text.split(/\r?\n/).map(line => line.startsWith('#') ? line.replace(/URI="([^"]+)"/g, (_match, value: string) => `URI="${proxied(value)}"`) : line.trim() ? proxied(line.trim()) : line).join('\n');
}
export async function relayStream(camera: Camera, part: string | undefined, reply: FastifyReply) {
  if (camera.media?.kind !== 'hls') return reply.code(404).send({ error: 'Stream not found.' });
  let url = camera.media.url;
  if (part) {
    if (!/^[A-Za-z0-9_-]{1,6000}$/.test(part)) return reply.code(400).send({ error: 'Invalid stream segment.' });
    url = Buffer.from(part, 'base64url').toString('utf8');
  }
  if (!approvedStreamUrl(url)) return reply.code(403).send({ error: 'Unsupported stream source.' });
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.body) return reply.code(502).send({ error: 'The operator’s live stream is unavailable.' });
    const type = response.headers.get('content-type') ?? '';
    reply.header('Cache-Control', 'no-store');
    if (new URL(url).pathname.endsWith('.m3u8') || /mpegurl/i.test(type)) {
      const playlist = await response.text();
      if (playlist.length > 1024 * 1024 || !playlist.startsWith('#EXTM3U')) return reply.code(502).send({ error: 'The operator returned an invalid stream playlist.' });
      return reply.type('application/vnd.apple.mpegurl').send(rewritePlaylist(playlist, url, camera.id));
    }
    const size = Number(response.headers.get('content-length'));
    if (Number.isFinite(size) && size > 50 * 1024 * 1024) { await response.body.cancel(); return reply.code(502).send({ error: 'Stream segment exceeds the relay limit.' }); }
    if (!/^(video\/|audio\/|application\/(octet-stream|mp4))/.test(type)) { await response.body.cancel(); return reply.code(502).send({ error: 'Unsupported stream segment type.' }); }
    return reply.type(type).send(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream));
  } catch { return reply.code(502).send({ error: 'The operator’s live stream could not connect. Try the camera image or another nearby camera.' }); }
}
