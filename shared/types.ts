import { z } from 'zod';

export const categorySchema = z.enum(['Nature', 'City', 'Coast', 'Wildlife', 'Volcano']);
export type Category = z.infer<typeof categorySchema>;
export interface Camera {
  id: string;
  name: string;
  place: string;
  country: string;
  flag: string;
  lat: number;
  lng: number;
  timezone: string;
  category: Category;
  provider: string;
  sourceUrl: string;
  imageUrl?: string;
  permission: 'public-domain' | 'source-link';
  permissionUrl: string;
  refreshSeconds?: number;
  description: string;
  verifiedOn: string;
  accent: string;
}

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
