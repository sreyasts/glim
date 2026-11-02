import { z } from 'zod';
import { cameras as seeds } from '../shared/cameras';
import type { Bounds, Camera, CatalogResult, FeedFormat, ProviderStatus } from '../shared/types';

type Fetcher = typeof fetch;
const point = (lat: unknown, lng: unknown) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
const cameraBase = { category: 'Traffic', permission: 'provider-api', accent: '#245dd9', verifiedOn: '2026-10-25' } as const;
export function publicHttps(value: unknown, allowed: (url: URL) => boolean): string | undefined {
  if (typeof value !== 'string' || value.length > 4096) return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowed(url)) return;
    return url.href;
  } catch { return; }
}
const caltransUrl = (value: unknown) => publicHttps(value, url => url.hostname === 'dot.ca.gov' || url.hostname.endsWith('.dot.ca.gov'));
const tflUrl = (value: unknown) => publicHttps(value, url => url.hostname === 's3-eu-west-1.amazonaws.com' && url.pathname.startsWith('/jamcams.tfl.gov.uk/'));
const windyUrl = (value: unknown) => publicHttps(value, url => url.hostname === 'windy.com' || url.hostname.endsWith('.windy.com'));

const caltransSchema = z.object({ data: z.array(z.object({ cctv: z.object({
  index: z.union([z.string(), z.number()]), inService: z.union([z.string(), z.boolean()]),
  location: z.object({ locationName: z.string(), nearbyPlace: z.string().optional(), latitude: z.union([z.string(), z.number()]), longitude: z.union([z.string(), z.number()]), district: z.union([z.string(), z.number()]).optional() }),
  imageData: z.object({ streamingVideoURL: z.string().optional(), static: z.object({ currentImageURL: z.string().optional(), currentImageUpdateFrequency: z.union([z.string(), z.number()]).optional() }).optional() }),
}) })) });

export function parseCaltrans(data: unknown, district: number): Camera[] {
  const parsed = caltransSchema.parse(data);
  return parsed.data.flatMap(({ cctv: cam }) => {
    if (String(cam.inService).toLowerCase() !== 'true' || !point(cam.location.latitude, cam.location.longitude)) return [];
    const imageUrl = caltransUrl(cam.imageData.static?.currentImageURL);
    const video = caltransUrl(cam.imageData.streamingVideoURL);
    if (!imageUrl && !video) return [];
    return [{ ...cameraBase, id: `caltrans:${district}:${cam.index}`, name: cam.location.locationName,
      place: cam.location.nearbyPlace || 'California', country: 'United States', countryCode: 'US', flag: '🇺🇸',
      lat: Number(cam.location.latitude), lng: Number(cam.location.longitude), timezone: 'America/Los_Angeles',
      provider: 'Caltrans', region: 'California', sourceUrl: 'https://quickmap.dot.ca.gov/', imageUrl,
      permissionUrl: 'https://dot.ca.gov/programs/traffic-operations/traveler-information/cwwp',
      refreshSeconds: Math.max(5, Number(cam.imageData.static?.currentImageUpdateFrequency) || 15),
      description: `${cam.location.locationName}. Public traffic camera published through Caltrans CWWP2. Stream and image availability can vary.`,
      catalogUpdatedAt: new Date().toISOString(), ...(video ? { media: { kind: 'hls' as const, url: video, live: true } } : {}),
    }];
  });
}

const tflSchema = z.array(z.object({ id: z.string(), commonName: z.string(), lat: z.number(), lon: z.number(), additionalProperties: z.array(z.object({ key: z.string(), value: z.string() })) }));
export function parseTfl(data: unknown): Camera[] {
  return tflSchema.parse(data).flatMap(cam => {
    const attributes = Object.fromEntries(cam.additionalProperties.map(item => [item.key, item.value]));
    if (attributes.available !== 'true' || !point(cam.lat, cam.lon)) return [];
    const imageUrl = tflUrl(attributes.imageUrl);
    const video = tflUrl(attributes.videoUrl);
    if (!imageUrl && !video) return [];
    return [{ ...cameraBase, id: `tfl:${cam.id.replace(/^JamCams_/, '')}`, name: cam.commonName, place: 'London', country: 'United Kingdom', countryCode: 'GB', flag: '🇬🇧',
      lat: cam.lat, lng: cam.lon, timezone: 'Europe/London', provider: 'Transport for London', region: 'London',
      sourceUrl: 'https://tfl.gov.uk/traffic/status/', imageUrl, refreshSeconds: 60,
      permissionUrl: 'https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service',
      description: 'Powered by TfL Open Data. JamCams publish periodically updated short clips, not uninterrupted live video.',
      catalogUpdatedAt: new Date().toISOString(), ...(video ? { media: { kind: 'mp4' as const, url: video, live: false } } : {}),
    }];
  });
}

const windyCameraSchema = z.object({
  webcamId: z.union([z.string(), z.number()]), title: z.string(), status: z.string().optional(),
  location: z.object({ latitude: z.number(), longitude: z.number(), city: z.string().optional(), country: z.string().optional(), country_code: z.string().regex(/^[A-Z]{2}$/).optional(), timezone: z.string().optional() }),
  images: z.object({ current: z.object({ preview: z.string().optional(), thumbnail: z.string().optional() }).optional() }).optional(),
  player: z.object({ live: z.string().optional(), day: z.string().optional() }).optional(),
  urls: z.object({ detail: z.string().optional() }).optional(),
});
export function parseWindyCamera(data: unknown): Camera | null {
  const result = windyCameraSchema.safeParse(data);
  if (!result.success) return null;
  const cam = result.data;
  if (!point(cam.location.latitude, cam.location.longitude) || (cam.status && cam.status !== 'active')) return null;
  const imageUrl = windyUrl(cam.images?.current?.preview ?? cam.images?.current?.thumbnail);
  const live = windyUrl(cam.player?.live);
  // The API's /live URL is a preview whose Play link opens /webcams/stream/:id.
  // Embed that operator-owned stream page directly so playback stays in Glim.
  const player = live ? `https://webcams.windy.com/webcams/stream/${encodeURIComponent(String(cam.webcamId))}` : windyUrl(cam.player?.day);
  const sourceUrl = windyUrl(cam.urls?.detail) ?? `https://www.windy.com/webcams/${encodeURIComponent(String(cam.webcamId))}`;
  let timezone = cam.location.timezone ?? 'UTC';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { timezone = 'UTC'; }
  const city = cam.location.city?.trim();
  return { ...cameraBase, id: `windy:${cam.webcamId}`, name: cam.title, place: city && city.toLowerCase() !== 'unknown' ? city : cam.title.split(/[:›]/)[0].trim(),
    country: cam.location.country || 'Country not supplied', countryCode: cam.location.country_code, flag: '', lat: cam.location.latitude, lng: cam.location.longitude, timezone,
    category: 'Nature', provider: 'Windy Webcams', sourceUrl, imageUrl,
    permissionUrl: 'https://api.windy.com/webcams', refreshSeconds: 300, catalogUpdatedAt: new Date().toISOString(),
    description: 'Camera provided through the Windy Webcams API. The owner’s player and source attribution remain attached. Timelapse and live players are labeled separately.',
    ...(player ? { media: { kind: 'embed', url: player, live: Boolean(live) } } : {}),
  };
}

export function inBounds(camera: Pick<Camera, 'lat' | 'lng'>, bounds?: Bounds): boolean {
  if (!bounds) return true;
  const [west, south, east, north] = bounds;
  return camera.lat >= south && camera.lat <= north && (west <= east ? camera.lng >= west && camera.lng <= east : camera.lng >= west || camera.lng <= east);
}
export function matchesFormat(camera: Camera, format: FeedFormat): boolean {
  return format === 'all' || (format === 'live' ? Boolean(camera.media?.live) : format === 'video' ? Boolean(camera.media) : Boolean(camera.imageUrl) && !camera.media);
}

export class Catalog {
  private cameras = new Map(seeds.map(cam => [cam.id, cam]));
  private inflight = new Map<string, Promise<void>>();
  private queries = new Map<string, number>();
  private lastRefresh = 0;
  private timer?: ReturnType<typeof setInterval>;
  private stopped = false;
  readonly statuses: ProviderStatus[];
  constructor(private key?: string, private fetcher: Fetcher = fetch) {
    this.statuses = [
      { id: 'curated', name: 'Public webcam sources', count: seeds.length, status: 'ready', updatedAt: null, message: 'Manually reviewed operator sources' },
      { id: 'caltrans', name: 'Caltrans · California', count: 0, status: 'loading', updatedAt: null, message: 'Loading official camera catalog' },
      { id: 'tfl', name: 'TfL · London', count: 0, status: 'loading', updatedAt: null, message: 'Loading official JamCam catalog' },
      { id: 'windy', name: 'Windy · Worldwide', count: 0, status: key ? 'loading' : 'unconfigured', updatedAt: null, message: key ? 'Discover cameras by map area' : 'Add WINDY_WEBCAMS_API_KEY to connect worldwide discovery' },
    ];
  }
  get(id: string): Camera | undefined { return this.cameras.get(id); }
  all(): Camera[] { return [...this.cameras.values()]; }
  summary(): { indexed: number; providers: ProviderStatus[] } { return { indexed: this.cameras.size, providers: this.statuses.map(item => ({ ...item })) }; }
  private status(id: string, update: Partial<ProviderStatus>): void { Object.assign(this.statuses.find(item => item.id === id)!, update); }
  private replace(prefix: string, items: Camera[]): void {
    for (const id of this.cameras.keys()) if (id.startsWith(prefix)) this.cameras.delete(id);
    for (const camera of items) this.cameras.set(camera.id, camera);
  }
  private async json(url: string, headers?: Record<string, string>): Promise<unknown> {
    const response = await this.fetcher(url, { headers, redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 16 * 1024 * 1024) throw new Error('Provider response exceeds catalog limit');
    return JSON.parse(text);
  }
  private coalesce(key: string, task: () => Promise<void>): Promise<void> {
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const promise = task().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
  async refresh(): Promise<void> {
    if (Date.now() - this.lastRefresh < 15 * 60000) return;
    return this.coalesce('refresh', async () => {
      await Promise.all([
        (async () => {
          let succeeded = 0;
          // Three bounded requests at a time, to the operator's published catalogs only.
          for (let district = 1; district <= 12; district += 3) {
            await Promise.all(Array.from({ length: Math.min(3, 13 - district) }, (_, offset) => district + offset).map(async id => {
              try {
                const data = await this.json(`https://cwwp2.dot.ca.gov/data/d${id}/cctv/cctvStatusD${String(id).padStart(2, '0')}.json`);
                this.replace(`caltrans:${id}:`, parseCaltrans(data, id)); succeeded++;
              } catch { /* Keep previously working catalog data on provider failure. */ }
            }));
          }
          this.status('caltrans', { status: succeeded === 12 ? 'ready' : 'degraded', count: this.all().filter(cam => cam.id.startsWith('caltrans:')).length, updatedAt: new Date().toISOString(), message: `${succeeded}/12 official district catalogs loaded. Availability is checked during playback.` });
        })(),
        (async () => {
          try {
            const data = await this.json('https://api.tfl.gov.uk/Place/Type/JamCam');
            const items = parseTfl(data); this.replace('tfl:', items);
            this.status('tfl', { status: 'ready', count: items.length, updatedAt: new Date().toISOString(), message: 'Updated clips and images · Powered by TfL Open Data' });
          } catch { this.status('tfl', { status: 'degraded', message: 'TfL catalog temporarily unavailable. Previously loaded cameras are retained.' }); }
        })(),
      ]);
      this.lastRefresh = Date.now();
    });
  }
  async discover(bounds: Bounds = [-180, -85, 180, 85], offset = 0, country?: string): Promise<void> {
    if (!this.key) return;
    if (!Number.isInteger(offset) || offset < 0 || offset > 950 || offset % 50 !== 0) throw new Error('Invalid discovery offset');
    if (country && !/^[A-Z]{2}$/.test(country)) throw new Error('Invalid country code');
    if (bounds[0] > bounds[2]) {
      await Promise.all([this.discover([bounds[0], bounds[1], 180, bounds[3]], offset), this.discover([-180, bounds[1], bounds[2], bounds[3]], offset)]);
      return;
    }
    const queryKey = `${country ?? bounds.map(value => Math.round(value * 10) / 10).join(',')}:${offset}`;
    if ((this.queries.get(queryKey) ?? 0) > Date.now()) return;
    return this.coalesce(`windy:${queryKey}`, async () => {
      try {
        const [west, south, east, north] = bounds;
        const params = new URLSearchParams({ limit: '50', offset: String(offset), sortKey: 'popularity', sortDirection: 'desc', include: 'images,location,player,urls', bbox: `${north},${east},${south},${west}` });
        if (country) { params.delete('bbox'); params.set('countries', country); }
        const data = z.object({ webcams: z.array(z.unknown()), total: z.number().optional() }).parse(await this.json(`https://api.windy.com/webcams/api/v3/webcams?${params}`, { 'x-windy-api-key': this.key! }));
        for (const item of data.webcams) { const camera = parseWindyCamera(item); if (camera) this.cameras.set(camera.id, camera); }
        // Keep a finite cache: camera image tokens have short lifetimes and are never persisted.
        const windyItems = this.all().filter(cam => cam.id.startsWith('windy:'));
        for (const cam of windyItems.slice(0, Math.max(0, windyItems.length - 5000))) this.cameras.delete(cam.id);
        this.status('windy', { status: 'ready', count: Math.min(windyItems.length, 5000), updatedAt: new Date().toISOString(), message: `${data.total?.toLocaleString() ?? 'More'} matching webcams in the last requested ${country ? `country (${country})` : 'area'}. Zoom or move the map to discover more. Counts include timelapses.` });
        this.queries.set(queryKey, Date.now() + 4 * 60000);
        if (this.queries.size > 200) this.queries.delete(this.queries.keys().next().value!);
      } catch { this.status('windy', { status: 'degraded', message: 'Windy could not load this area. Check the server key, plan permissions, or provider status.' }); this.queries.set(queryKey, Date.now() + 30000); }
    });
  }
  async resolve(id: string): Promise<Camera | undefined> {
    if (!this.get(id)) {
      const districtMatch = /^caltrans:(\d{1,2}):\d{1,8}$/.exec(id);
      const district = districtMatch ? Number(districtMatch[1]) : 0;
      const tfl = /^tfl:\d{1,8}(?:\.\d{1,8})?$/.test(id);
      const source = district >= 1 && district <= 12 ? `detail-district:${district}` : tfl ? 'detail-tfl' : '';
      if (source && (this.queries.get(source) ?? 0) <= Date.now()) {
        await this.coalesce(source, async () => {
          try {
            const items = tfl ? parseTfl(await this.json('https://api.tfl.gov.uk/Place/Type/JamCam')) : parseCaltrans(await this.json(`https://cwwp2.dot.ca.gov/data/d${district}/cctv/cctvStatusD${String(district).padStart(2, '0')}.json`), district);
            for (const camera of items) this.cameras.set(camera.id, camera);
            this.queries.set(source, Date.now() + 15 * 60000);
          } catch { this.queries.set(source, Date.now() + 30000); }
        });
      }
    }
    if (this.key && /^windy:\d{5,20}$/.test(id)) {
      const camera = this.get(id);
      if (!camera || Date.now() - Date.parse(camera.catalogUpdatedAt ?? '') > 4 * 60000) {
        try {
          const data = await this.json(`https://api.windy.com/webcams/api/v3/webcams/${id.slice(6)}?include=images,location,player,urls`, { 'x-windy-api-key': this.key });
          const fresh = parseWindyCamera(data); if (fresh) this.cameras.set(fresh.id, fresh);
        } catch { return camera; }
      }
    }
    return this.get(id);
  }
  list(bounds?: Bounds, query = '', format: FeedFormat = 'all', limit = 150, country?: string): CatalogResult {
    const needle = query.toLocaleLowerCase();
    const items = this.all().filter(cam => (!country || cam.countryCode === country) && inBounds(cam, bounds) && matchesFormat(cam, format) && `${cam.name} ${cam.place} ${cam.country} ${cam.provider}`.toLocaleLowerCase().includes(needle));
    const priority = (camera: Camera) => camera.media?.live ? camera.media.kind === 'embed' ? 1 : 2 : 0;
    items.sort((a, b) => Number(b.permission === 'platform-embed') - Number(a.permission === 'platform-embed') || priority(b) - priority(a) || a.name.localeCompare(b.name));
    return { cameras: items.slice(0, limit), total: items.length, indexed: this.cameras.size, truncated: items.length > limit, providers: this.summary().providers };
  }
  start(): void {
    this.stopped = false;
    void this.refresh().catch(() => {});
    // Free-tier pagination stops at 1,000 results. Bound concurrency and retain
    // operator formats rather than presenting every webcam as live video.
    void (async () => {
      // Geographic seeds prevent a popularity-only world view from hiding
      // less represented countries. Browsing anywhere still queries that area.
      const countries = ['IN', 'CN', 'UA', 'ZA', 'KE', 'TZ', 'EG', 'MA', 'NG', 'GH', 'NA', 'BW', 'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'GB', 'IE', 'FR', 'DE', 'ES', 'IT', 'NO', 'SE', 'FI', 'IS', 'PL', 'GR', 'TR', 'JP', 'KR', 'TW', 'ID', 'TH', 'VN', 'MY', 'SG', 'AU', 'NZ', 'AE', 'NP', 'LK', 'BD', 'PK'];
      for (let index = 0; index < countries.length; index += 2) {
        if (this.stopped) return;
        await Promise.all(countries.slice(index, index + 2).map(country => this.discover(undefined, 0, country)));
        if (this.statuses.find(provider => provider.id === 'windy')?.status === 'degraded') return;
      }
      for (const country of ['CN', 'GB', 'JP', 'ZA']) {
        for (const offset of [50, 100, 150]) {
          if (this.stopped) return;
          await this.discover(undefined, offset, country);
        }
      }
      for (let offset = 0; offset < 1000; offset += 100) {
        if (this.stopped) break;
        await Promise.all([this.discover(undefined, offset), this.discover(undefined, offset + 50)]);
        if (this.statuses.find(provider => provider.id === 'windy')?.status === 'degraded') break;
      }
    })().catch(() => {});
    this.timer = setInterval(() => void this.refresh().catch(() => {}), 15 * 60000);
    this.timer.unref();
  }
  stop(): void { this.stopped = true; clearInterval(this.timer); }
}
