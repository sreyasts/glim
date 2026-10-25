import { z } from 'zod';
import type { Camera, Weather } from '../shared/types';

const responseSchema = z.object({
  current: z.object({ time: z.string(), temperature_2m: z.number(), precipitation: z.number(), snowfall: z.number(), wind_speed_10m: z.number(), weather_code: z.number(), is_day: z.number() }),
  daily: z.object({ sunrise: z.array(z.string()).min(1), sunset: z.array(z.string()).min(1) }),
});

export class WeatherService {
  private cache = new Map<string, Weather>();
  private inflight = new Map<string, Promise<Weather>>();
  private retryAfter = new Map<string, number>();
  constructor(private readonly apiKey?: string) {}
  async get(camera: Camera): Promise<Weather> {
    const cached = this.cache.get(camera.id);
    if (cached && Date.now() - cached.fetchedAt < 5 * 60000) return cached;
    const pending = this.inflight.get(camera.id);
    if (pending) return pending;
    if ((this.retryAfter.get(camera.id) ?? 0) > Date.now()) throw new Error('Weather provider is temporarily unavailable. Try again shortly.');
    const request = this.fetch(camera).catch(error => {
      this.retryAfter.set(camera.id, Date.now() + 60000);
      throw error;
    }).finally(() => this.inflight.delete(camera.id));
    this.inflight.set(camera.id, request);
    return request;
  }
  private async fetch(camera: Camera): Promise<Weather> {
    const url = new URL(this.apiKey ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({ latitude: String(camera.lat), longitude: String(camera.lng), current: 'temperature_2m,precipitation,snowfall,wind_speed_10m,weather_code,is_day', daily: 'sunrise,sunset', timezone: 'UTC', timeformat: 'iso8601', forecast_days: '2', ...(this.apiKey ? { apikey: this.apiKey } : {}) }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), redirect: 'error' });
    if (!response.ok) throw new Error('Weather provider is temporarily unavailable.');
    const data = responseSchema.parse(await response.json());
    const now = Date.now();
    const nextTime = (values: string[]) => values.map(time => `${time}Z`).find(time => Date.parse(time) >= now - 15 * 60000) ?? `${values[values.length - 1]}Z`;
    const weather: Weather = {
      observedAt: `${data.current.time}Z`, fetchedAt: now,
      temperature: data.current.temperature_2m, precipitation: data.current.precipitation,
      snowfall: data.current.snowfall, windSpeed: data.current.wind_speed_10m,
      weatherCode: data.current.weather_code, isDay: data.current.is_day === 1,
      sunrise: nextTime(data.daily.sunrise), sunset: nextTime(data.daily.sunset),
    };
    this.cache.set(camera.id, weather);
    return weather;
  }
}
