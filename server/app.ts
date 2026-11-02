import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import webpush from 'web-push';
import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cameras, cameraById } from '../shared/cameras';
import { ruleInputSchema } from '../shared/types';
import { Store } from './db';
import { WeatherService } from './weather';
import { AlertEngine } from './engine';
import { Catalog } from './catalog';
import { Geocoder } from './geocoder';
import { relayStream } from './stream';
import type { Bounds } from '../shared/types';

declare module 'fastify' { interface FastifyRequest { owner: string } }

export interface AppOptions {
  dbPath?: string;
  origin?: string;
  production?: boolean;
  startWorker?: boolean;
  weather?: Pick<WeatherService, 'get'>;
  logger?: boolean;
  catalog?: Catalog;
}

const subscriptionSchema = z.object({
  endpoint: z.url().max(2048).refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.port && !url.username && !url.password &&
      (url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' || url.hostname === 'web.push.apple.com');
  }, 'Use a supported Chrome, Firefox, or Safari push service.'),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}={0,1}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/) }).strict(),
}).strict();

export async function buildApp(options: AppOptions = {}) {
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const origin = new URL(options.origin ?? process.env.APP_ORIGIN ?? 'http://localhost:5173').origin;
  if (production && !origin.startsWith('https://')) throw new Error('Production APP_ORIGIN must use HTTPS.');
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 16384, trustProxy: false });
  const store = new Store(options.dbPath ?? process.env.DATABASE_PATH ?? './data/glim.sqlite');
  const weather = options.weather ?? new WeatherService(process.env.OPEN_METEO_API_KEY);
  const catalog = options.catalog ?? new Catalog(process.env.WINDY_WEBCAMS_API_KEY || process.env.WINDY_API_KEY);
  const geocoder = new Geocoder();
  const pushKey = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PUBLIC_KEY : null;
  if (pushKey) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com', pushKey, process.env.VAPID_PRIVATE_KEY!);
  const engine = new AlertEngine(store, weather, async (owner, event) => {
    const saved = store.push(owner);
    if (!saved || !pushKey) return;
    try {
      await webpush.sendNotification(JSON.parse(saved), JSON.stringify({ title: event.title, body: event.body, url: `/?camera=${encodeURIComponent(event.cameraId)}`, tag: event.ruleId }), { TTL: 900, timeout: 10000 });
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404 || (error as { statusCode?: number }).statusCode === 410) store.deletePush(owner);
      else app.log.warn('Browser push delivery failed; notification remains in the inbox.');
    }
  }, message => app.log.warn(message), id => catalog.resolve(id));

  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://www.nps.gov', 'https://volcanoes.usgs.gov', 'https://*.dot.ca.gov', 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/', 'https://*.windy.com', 'https://i.ytimg.com', 'https://tile.openstreetmap.org'],
      connectSrc: ["'self'", 'https://tile.openstreetmap.org', 'https://demotiles.maplibre.org'], workerSrc: ["'self'", 'blob:'], fontSrc: ["'self'"],
      frameSrc: ['https://www.youtube-nocookie.com', 'https://webcams.windy.com'],
      mediaSrc: ["'self'", 'blob:', 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/'],
      objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"],
      upgradeInsecureRequests: production ? [] : null,
    },
  }, crossOriginEmbedderPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' } });
  await app.register(rateLimit, { max: 120, timeWindow: 60000 });
  app.decorateRequest('owner', '');

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== origin) {
      return reply.code(403).send({ error: 'Request origin is not allowed.' });
    }
    if (['/api/health', '/api/catalog', '/api/cameras', '/api/places'].includes(request.url.split('?')[0]) || request.url.startsWith('/api/cameras/') || request.url.startsWith('/api/weather/') || request.url.startsWith('/api/stream/')) return;
    const session = store.session(request.cookies.glim_session);
    request.owner = session.owner;
    if (session.token) reply.setCookie('glim_session', session.token, { path: '/', httpOnly: true, secure: production, sameSite: 'strict', maxAge: 30 * 86400 });
  });

  app.get('/api/health', async () => ({ ok: true, version: '0.2.0', cameras: catalog.summary().indexed, worker: options.startWorker !== false }));
  app.get('/api/catalog', async () => catalog.summary());
  const cameraQuery = z.object({
    bbox: z.string().max(120).optional(), q: z.string().max(100).default(''),
      format: z.enum(['all', 'live', 'video', 'snapshot']).default('all'), country: z.string().regex(/^[A-Z]{2}$/).optional(), limit: z.coerce.number().int().min(1).max(250).default(150),
  });
  app.get<{ Querystring: unknown }>('/api/cameras', async request => {
    const query = cameraQuery.parse(request.query);
    let bounds: Bounds | undefined;
    if (query.bbox) {
      const values = query.bbox.split(',').map(Number);
      if (values.length !== 4 || !values.every(Number.isFinite) || values[0] < -180 || values[0] > 180 || values[2] < -180 || values[2] > 180 || values[1] < -90 || values[3] > 90 || values[1] > values[3]) throw new z.ZodError([{ code: 'custom', path: ['bbox'], message: 'Invalid map bounds.' }]);
      bounds = values as Bounds;
      await catalog.discover(bounds);
    }
      if (query.country) await catalog.discover(undefined, 0, query.country);
      return catalog.list(bounds, query.q, query.format, query.limit, query.country);
  });
  app.get('/api/cameras/map', async () => ({ type: 'FeatureCollection', features: catalog.all().filter(cam => cam.imageUrl || cam.media).map(cam => ({ type: 'Feature', id: cam.id, geometry: { type: 'Point', coordinates: [cam.lng, cam.lat] }, properties: { id: cam.id, name: cam.name, place: cam.place, live: Boolean(cam.media?.live), format: cam.media?.kind ?? 'snapshot' } })) }));
  app.get<{ Params: { id: string } }>('/api/cameras/:id', async (request, reply) => {
    const camera = await catalog.resolve(request.params.id);
    return camera ?? reply.code(404).send({ error: 'Camera not found. Browse the map to load this provider’s cameras.' });
  });
  app.get<{ Params: { id: string }; Querystring: { part?: string } }>('/api/stream/:id', { config: { rateLimit: { max: 600, timeWindow: 60000 } } }, async (request, reply) => {
    const camera = catalog.get(request.params.id);
    if (!camera) return reply.code(404).send({ error: 'Camera not found.' });
    return relayStream(camera, request.query.part, reply);
  });
  app.get<{ Querystring: { q?: string } }>('/api/places', { config: { rateLimit: { max: 15, timeWindow: 60000 } } }, async (request, reply) => {
    const query = z.string().trim().min(2).max(100).parse(request.query.q);
    try { return await geocoder.search(query); } catch (error) { return reply.code(503).send({ error: error instanceof Error ? error.message : 'Place search unavailable. Navigate the map instead.' }); }
  });
  app.get<{ Params: { id: string } }>('/api/weather/:id', async (request, reply) => {
    const camera = await catalog.resolve(request.params.id);
    if (!camera) return reply.code(404).send({ error: 'Place not found.' });
    try { return await weather.get(camera); }
    catch { return reply.code(503).send({ error: 'Weather is temporarily unavailable. Alerts will retry automatically.' }); }
  });
  app.get('/api/session', async request => ({ favorites: store.favorites(request.owner), rules: store.rules(request.owner), events: store.events(request.owner), pushKey, pushEnabled: Boolean(store.push(request.owner)) }));
  app.post<{ Body: unknown }>('/api/favorites', async (request, reply) => {
    const input = z.object({ cameraId: z.string(), saved: z.boolean() }).strict().parse(request.body);
    if (!await catalog.resolve(input.cameraId)) return reply.code(404).send({ error: 'Place not found.' });
    store.favorite(request.owner, input.cameraId, input.saved);
    return { favorites: store.favorites(request.owner) };
  });
  app.post<{ Body: unknown }>('/api/rules', async (request, reply) => {
    const input = ruleInputSchema.parse(request.body);
    if (!await catalog.resolve(input.cameraId)) return reply.code(404).send({ error: 'Place not found.' });
    if (store.rules(request.owner).length >= 25) return reply.code(409).send({ error: 'You can watch up to 25 conditions. Remove an alert to add another.' });
    if ((store.db.prepare('SELECT COUNT(*) AS n FROM rules').get() as { n: number }).n >= 5000) return reply.code(503).send({ error: 'Alert capacity reached. Try again later.' });
    try { return reply.code(201).send(store.addRule(request.owner, input)); }
    catch (error) {
      if (error instanceof Error && error.message === 'An identical alert already exists.') return reply.code(409).send({ error: error.message });
      throw error;
    }
  });
  app.patch<{ Params: { id: string }; Body: unknown }>('/api/rules/:id', async (request, reply) => {
    const input = z.object({ enabled: z.boolean() }).strict().parse(request.body);
    if (!store.setRule(request.owner, request.params.id, input.enabled)) return reply.code(404).send({ error: 'Alert not found.' });
    return { ok: true };
  });
  app.delete<{ Params: { id: string } }>('/api/rules/:id', async (request, reply) => {
    if (!store.deleteRule(request.owner, request.params.id)) return reply.code(404).send({ error: 'Alert not found.' });
    return { ok: true };
  });
  app.post<{ Body: unknown }>('/api/push', async (request, reply) => {
    if (!pushKey) return reply.code(503).send({ error: 'Background push is not configured on this server. Your alert inbox still works.' });
    store.savePush(request.owner, subscriptionSchema.parse(request.body));
    return { ok: true };
  });
  app.delete('/api/push', async request => { store.deletePush(request.owner); return { ok: true }; });
  app.delete('/api/session', async (request, reply) => {
    store.db.prepare('DELETE FROM sessions WHERE id=?').run(request.owner);
    reply.clearCookie('glim_session', { path: '/' });
    return { ok: true };
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: error.issues.map(issue => issue.message).join(' ') });
    const failure = error as Error & { statusCode?: number };
    const status = typeof failure.statusCode === 'number' ? failure.statusCode : 500;
    if (status >= 500) app.log.error({ err: error }, 'Request failed');
    return reply.code(status).send({ error: status === 429 ? 'Too many requests. Try again in a minute.' : status === 413 ? 'Request is too large.' : status >= 500 ? 'Something went wrong. Please try again.' : failure.message });
  });

  const dist = resolve('dist');
  if (existsSync(dist)) {
    const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
    const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
    app.get<{ Params: { id: string } }>('/place/:id', async (request, reply) => {
      const camera = await catalog.resolve(request.params.id);
      if (!camera) return reply.code(404).type('text/html').send('<h1>Place not found</h1><a href="/">Explore Glim</a>');
      const title = escape(`${camera.place} webcam — glim`);
      const description = escape(camera.description);
      return reply.type('text/html').send(html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
        .replace(/(<meta name="description" content=")[^"]*/, `$1${description}`)
        .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
        .replace(/(<meta property="og:description" content=")[^"]*/, `$1${description}`)
        .replace('</head>', `<link rel="canonical" href="${escape(origin)}/place/${camera.id}" /><meta property="og:url" content="${escape(origin)}/place/${camera.id}" /></head>`));
    });
    app.get('/sitemap.xml', async (_request, reply) => reply.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(origin)}/</loc></url>${cameras.map(camera => `<url><loc>${escape(origin)}/place/${camera.id}</loc><lastmod>${camera.verifiedOn}</lastmod></url>`).join('')}</urlset>`));
    app.get('/robots.txt', async (_request, reply) => reply.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`));
    await app.register(staticFiles, { root: dist });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.split('?')[0].includes('.')) return reply.code(404).send({ error: 'Not found.' });
      return reply.type('text/html').sendFile('index.html');
    });
  }
  app.addHook('onClose', async () => { engine.stop(); catalog.stop(); store.close(); });
  if (options.startWorker !== false) {
    const interval = Number(process.env.POLL_INTERVAL_MS ?? 300000);
    if (!Number.isFinite(interval) || interval < 60000) throw new Error('POLL_INTERVAL_MS must be at least 60000.');
    engine.start(interval);
    catalog.start();
  }
  return { app, store, engine, catalog };
}
