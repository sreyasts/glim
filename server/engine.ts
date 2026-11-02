import type { Camera, Rule, Weather } from '../shared/types';
import { cameraById } from '../shared/cameras';
import { Store } from './db';
import type { WeatherService } from './weather';

function isFreshWeather(weather: Weather, now: number): boolean {
  const age = now - Date.parse(weather.observedAt);
  return Number.isFinite(age) && age <= 45 * 60000 && age >= -5 * 60000;
}

export function matchesRule(rule: Pick<Rule, 'kind' | 'threshold'>, weather: Weather, now = Date.now()): boolean {
  if (!isFreshWeather(weather, now)) return false;
  switch (rule.kind) {
    case 'rain': return weather.precipitation > Math.max(0, rule.threshold) && weather.snowfall === 0;
    case 'snow': return weather.snowfall > Math.max(0, rule.threshold);
    case 'wind': return weather.windSpeed >= rule.threshold;
    case 'sunrise':
    case 'sunset': {
      const time = Date.parse(weather[rule.kind]);
      return time - now <= 15 * 60000 && time - now >= 0;
    }
  }
}

export class AlertEngine {
  private running = false;
  private timer?: ReturnType<typeof setInterval>;
  constructor(private store: Store, private weather: Pick<WeatherService, 'get'>, private deliver: (owner: string, event: import('../shared/types').AlertEvent) => Promise<void>, private log: (message: string) => void = console.warn, private lookup: (id: string) => Camera | undefined | Promise<Camera | undefined> = id => cameraById.get(id)) {}
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      this.store.cleanup();
      const groups = new Map<string, ReturnType<Store['activeRules']>>();
      for (const rule of this.store.activeRules()) groups.set(rule.cameraId, [...(groups.get(rule.cameraId) ?? []), rule]);
      // One weather request per watched place, shared across every viewer.
      for (const [id, rules] of groups) {
        const camera = await this.lookup(id);
        if (!camera) continue;
        try {
          const weather = await this.weather.get(camera);
          if (!isFreshWeather(weather, Date.now())) { this.log(`Stale weather for ${id}; existing rule state preserved.`); continue; }
          for (const rule of rules) {
            const matched = matchesRule(rule, weather);
            const mayFire = matched && !rule.matched && (!rule.lastTriggeredAt || Date.now() - rule.lastTriggeredAt >= 60 * 60000);
            const labels = { rain: 'Rain at', snow: 'Snow at', wind: 'Wind picking up at', sunrise: 'Sunrise approaching at', sunset: 'Sunset approaching at' };
            const event = this.store.recordEvaluation(rule, matched, mayFire ? {
              ruleId: rule.id, cameraId: id, title: `${labels[rule.kind]} ${camera.place}`,
              body: `Open-Meteo location data · ${weather.temperature}°C · wind ${weather.windSpeed} km/h. ${rule.kind === 'sunrise' || rule.kind === 'sunset' ? 'Within the next 15 minutes.' : 'Weather condition detected; not camera image analysis.'}`,
            } : undefined);
            if (event) await this.deliver(rule.owner, event);
          }
        } catch { this.log(`Weather check failed for ${id}; existing rule state preserved.`); }
      }
    } finally { this.running = false; }
  }
  start(interval: number): void {
    void this.tick().catch(() => this.log('Alert worker check failed.'));
    this.timer = setInterval(() => void this.tick().catch(() => this.log('Alert worker check failed.')), interval);
    this.timer.unref();
  }
  stop(): void { clearInterval(this.timer); }
}
