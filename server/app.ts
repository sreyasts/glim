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

declare module 'fastify' { interface FastifyRequest { owner: string } }

export interface AppOptions {
  dbPath?: string;
  origin?: string;
  production?: boolean;
  startWorker?: boolean;
  weather?: Pick<WeatherService, 'get'>;
  logger?: boolean;
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
  }, message => app.log.warn(message));

  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://www.nps.gov', 'https://volcanoes.usgs.gov'],
      connectSrc: ["'self'"], workerSrc: ["'self'", 'blob:'], fontSrc: ["'self'"],
      objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"],
      upgradeInsecureRequests: production ? [] : null,
    },
  }, crossOriginEmbedderPolicy: false });
  await app.register(rateLimit, { max: 120, timeWindow: 60000 });
  app.decorateRequest('owner', '');

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== origin) {
      return reply.code(403).send({ error: 'Request origin is not allowed.' });
    }
    if (request.url.split('?')[0] === '/api/health' || request.url.split('?')[0] === '/api/cameras' || request.url.startsWith('/api/weather/')) return;
    const session = store.session(request.cookies.glim_session);
    request.owner = session.owner;
    if (session.token) reply.setCookie('glim_session', session.token, { path: '/', httpOnly: true, secure: production, sameSite: 'strict', maxAge: 30 * 86400 });
  });

  app.get('/api/health', async () => ({ ok: true, version: '0.1.0', cameras: cameras.length, worker: options.startWorker !== false }));
  app.get('/api/cameras', async () => cameras);
  app.get<{ Params: { id: string } }>('/api/weather/:id', async (request, reply) => {
    const camera = cameraById.get(request.params.id);
    if (!camera) return reply.code(404).send({ error: 'Place not found.' });
    try { return await weather.get(camera); }
    catch { return reply.code(503).send({ error: 'Weather is temporarily unavailable. Alerts will retry automatically.' }); }
  });
  app.get('/api/session', async request => ({ favorites: store.favorites(request.owner), rules: store.rules(request.owner), events: store.events(request.owner), pushKey, pushEnabled: Boolean(store.push(request.owner)) }));
  app.post<{ Body: unknown }>('/api/favorites', async (request, reply) => {
    const input = z.object({ cameraId: z.string(), saved: z.boolean() }).strict().parse(request.body);
    if (!cameraById.has(input.cameraId)) return reply.code(404).send({ error: 'Place not found.' });
    store.favorite(request.owner, input.cameraId, input.saved);
    return { favorites: store.favorites(request.owner) };
  });
  app.post<{ Body: unknown }>('/api/rules', async (request, reply) => {
    const input = ruleInputSchema.parse(request.body);
    if (!cameraById.has(input.cameraId)) return reply.code(404).send({ error: 'Place not found.' });
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
      const camera = cameraById.get(request.params.id);
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
  app.addHook('onClose', async () => { engine.stop(); store.close(); });
  if (options.startWorker !== false) {
    const interval = Number(process.env.POLL_INTERVAL_MS ?? 300000);
    if (!Number.isFinite(interval) || interval < 60000) throw new Error('POLL_INTERVAL_MS must be at least 60000.');
    engine.start(interval);
  }
  return { app, store, engine };
}
