import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Position } from 'geojson';
import world from 'world-atlas/countries-110m.json' with { type: 'json' };
import data from '../shared/data/places.json' with { type: 'json' };
import type { Bounds, PlaceResult } from '../shared/types';

const normalized = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
type City = [id: string, name: string, country: string, lat: number, lng: number, population: number, aliases?: string];
type Country = [code: string, numeric: string, name: string, capital: string];
interface Entry extends PlaceResult { search: string; exact: string; population: number; isCountry: boolean }

function ringArea(ring: Position[]): number {
  return Math.abs(ring.reduce((sum, point, index) => { const next = ring[(index + 1) % ring.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0));
}

export class Geocoder {
  private entries: Entry[];
  constructor() {
    const countries = data.countries as Country[];
    const names = new Map(countries.map(country => [country[0], country[2]]));
    this.entries = (data.cities as City[]).map(([id, name, code, lat, lng, population, aliases = '']) => ({
      id: `geonames:${id}`, name: `${name}, ${names.get(code) ?? code}`, lat, lng, population, isCountry: false,
      exact: normalized(name), search: normalized(`${name} ${aliases} ${names.get(code) ?? code}`),
    }));
    const topology = world as unknown as Topology<{ countries: GeometryCollection }>;
    const shapes = feature(topology, topology.objects.countries).features;
    for (const [code, numeric, name] of countries) {
      const shape = shapes.find(item => Number(item.id) === Number(numeric));
      if (!shape) continue;
      const rings = shape.geometry.type === 'MultiPolygon' ? shape.geometry.coordinates.map(polygon => polygon[0]) : shape.geometry.type === 'Polygon' ? [shape.geometry.coordinates[0]] : [];
      const largest = rings.sort((a, b) => ringArea(b) - ringArea(a))[0];
      if (!largest?.length) continue;
      const bounds: Bounds = [Math.min(...largest.map(point => point[0])), Math.max(-85, Math.min(...largest.map(point => point[1]))), Math.max(...largest.map(point => point[0])), Math.min(85, Math.max(...largest.map(point => point[1])))];
      this.entries.push({ id: `country:${code}`, name, lat: (bounds[1] + bounds[3]) / 2, lng: (bounds[0] + bounds[2]) / 2, bounds, exact: normalized(name), search: normalized(`${name} ${code}`), population: 0, isCountry: true });
    }
  }
  async search(query: string): Promise<PlaceResult[]> {
    const needle = normalized(query);
    if (needle.length < 2) return [];
    const words = needle.split(' ');
    return this.entries.filter(entry => words.every(word => entry.search.includes(word))).map(entry => ({
      entry, score: (entry.exact === needle ? 1000 : entry.exact.startsWith(needle) ? 500 : entry.search.startsWith(needle) ? 300 : 0) + (entry.isCountry && entry.exact === needle ? 100 : 0) + Math.log10(Math.max(1, entry.population)),
    })).sort((a, b) => b.score - a.score).slice(0, 5).map(({ entry: { search: _search, exact: _exact, population: _population, isCountry: _isCountry, ...place } }) => place);
  }
}
