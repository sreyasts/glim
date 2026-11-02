import { z } from 'zod';

export const categorySchema = z.enum(['Nature', 'City', 'Coast', 'Wildlife', 'Volcano', 'Traffic']);
export type Category = z.infer<typeof categorySchema>;
export interface Camera {
  id: string;
  name: string;
  place: string;
  country: string;
  countryCode?: string;
  coordinateAccuracy?: 'approximate';
  flag: string;
  lat: number;
  lng: number;
  timezone: string;
  category: Category;
  provider: string;
  sourceUrl: string;
  imageUrl?: string;
  permission: 'public-domain' | 'source-link' | 'provider-api' | 'platform-embed';
  permissionUrl: string;
  refreshSeconds?: number;
  description: string;
  verifiedOn: string;
  accent: string;
  media?: { kind: 'hls' | 'mp4' | 'youtube' | 'embed'; url: string; live: boolean };
  posterUrl?: string;
  catalogUpdatedAt?: string;
  region?: string;
}

export type Bounds = [west: number, south: number, east: number, north: number];
export type FeedFormat = 'all' | 'live' | 'video' | 'snapshot';
export interface ProviderStatus {
  id: string; name: string; status: 'loading' | 'ready' | 'degraded' | 'unconfigured';
  count: number; updatedAt: string | null; message: string;
}
export interface CatalogResult {
  cameras: Camera[]; total: number; indexed: number; truncated: boolean;
  providers: ProviderStatus[];
}
export interface PlaceResult { id: string; name: string; lat: number; lng: number; bounds?: Bounds }

export const ruleInputSchema = z.object({
  cameraId: z.string().min(1).max(100),
  kind: z.enum(['rain', 'snow', 'wind', 'sunrise', 'sunset']),
  threshold: z.number().finite().min(0).max(200),
  enabled: z.boolean().default(true),
}).strict().superRefine((rule, ctx) => {
  if (rule.kind === 'wind' && rule.threshold < 1) {
    ctx.addIssue({ code: 'custom', path: ['threshold'], message: 'Wind threshold must be at least 1 km/h.' });
  }
});
export type RuleInput = z.infer<typeof ruleInputSchema>;
export type RuleKind = RuleInput['kind'];
export interface Rule extends RuleInput { id: string; createdAt: number; lastTriggeredAt: number | null }
export interface AlertEvent { id: string; ruleId: string; cameraId: string; title: string; body: string; createdAt: number }
export interface Weather {
  observedAt: string;
  fetchedAt: number;
  temperature: number;
  precipitation: number;
  snowfall: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  sunrise: string;
  sunset: string;
}
export interface Session { favorites: string[]; rules: Rule[]; events: AlertEvent[]; pushKey: string | null; pushEnabled: boolean }
export const ruleLabels: Record<RuleKind, string> = {
  rain: 'Rain starts', snow: 'Snow starts', wind: 'Wind picks up', sunrise: 'Sunrise approaches', sunset: 'Sunset approaches',
};
