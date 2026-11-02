import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapInstance, StyleSpecification } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Point } from 'geojson';
import world from 'world-atlas/countries-110m.json';
import { Globe2, Minus, Plus, RotateCcw } from 'lucide-react';
import type { Bounds, FeedFormat } from '../shared/types';

export interface MapFocus { lat: number; lng: number; zoom?: number; bounds?: Bounds; nonce: number }
export type CameraPoints = FeatureCollection<Point, { id: string; name: string; place: string; live: boolean; format: string }>;
const geography = feature(world as unknown as Topology<{ countries: GeometryCollection }>, (world as unknown as Topology<{ countries: GeometryCollection }>).objects.countries);
const emptyPoints: CameraPoints = { type: 'FeatureCollection', features: [] };
maplibregl.setWorkerUrl(mapWorkerUrl);
const style: StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    geography: { type: 'geojson', data: geography },
    streets: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, minzoom: 3, maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>' },
    cameras: { type: 'geojson', data: emptyPoints, cluster: true, clusterMaxZoom: 13, clusterRadius: 45 },
    selected: { type: 'geojson', data: emptyPoints },
  },
  layers: [
    { id: 'ocean', type: 'background', paint: { 'background-color': '#dae8ef' } },
    { id: 'land', type: 'fill', source: 'geography', paint: { 'fill-color': '#f0efe7', 'fill-outline-color': '#b3c1bd' } },
    { id: 'streets', type: 'raster', source: 'streets', minzoom: 3, paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0, 4, 1], 'raster-saturation': -0.5 } },
    { id: 'clusters', type: 'circle', source: 'cameras', filter: ['has', 'point_count'], paint: { 'circle-color': '#245dd9', 'circle-radius': ['step', ['get', 'point_count'], 17, 50, 21, 500, 26], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } },
    { id: 'cluster-count', type: 'symbol', source: 'cameras', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-allow-overlap': true }, paint: { 'text-color': '#fff' } },
    { id: 'camera-points', type: 'circle', source: 'cameras', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': ['case', ['get', 'live'], '#245dd9', '#526774'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 12, 8], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } },
    { id: 'selected-point', type: 'circle', source: 'selected', paint: { 'circle-color': '#fff', 'circle-radius': 11, 'circle-stroke-width': 4, 'circle-stroke-color': '#245dd9' } },
  ],
};

function boundsFor(map: MapInstance): Bounds {
  if (map.getZoom() < 2) return [-180, -85, 180, 85];
  const bounds = map.getBounds();
  if (bounds.getEast() - bounds.getWest() >= 350) return [-180, Math.max(-85, bounds.getSouth()), 180, Math.min(85, bounds.getNorth())];
  const longitude = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;
  return [longitude(bounds.getWest()), Math.max(-85, bounds.getSouth()), longitude(bounds.getEast()), Math.min(85, bounds.getNorth())];
}

export default function CameraMap({ points, focus, selectedId, format, onCamera, onView }: {
  points: CameraPoints; focus: MapFocus | null; selectedId: string | null; format: FeedFormat;
  onCamera: (id: string) => void; onView: (bounds: Bounds, zoom: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const callbacks = useRef({ onCamera, onView });
  callbacks.current = { onCamera, onView };
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1.25);
  const [hover, setHover] = useState('');
  useEffect(() => {
    if (!container.current) return;
    let instance: MapInstance;
    try {
      instance = new maplibregl.Map({ container: container.current, style, center: [12, 28], zoom: 1.25, minZoom: 1, maxZoom: 18, attributionControl: false, renderWorldCopies: false, canvasContextAttributes: { antialias: true }, maxPitch: 55 });
    } catch { setError('The map could not start on this device. You can still search and select a camera from the list.'); return; }
    map.current = instance;
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    instance.on('style.load', () => instance.setProjection({ type: 'globe' }));
    instance.on('load', () => { setError(''); setLoaded(true); callbacks.current.onView(boundsFor(instance), instance.getZoom()); });
    instance.on('moveend', () => { setZoom(instance.getZoom()); callbacks.current.onView(boundsFor(instance), instance.getZoom()); });
    instance.on('click', 'clusters', async event => {
      const cluster = event.features?.[0]; if (!cluster || cluster.geometry.type !== 'Point') return;
      const source = instance.getSource('cameras') as GeoJSONSource;
      const next = await source.getClusterExpansionZoom(Number(cluster.properties.cluster_id));
      instance.flyTo({ center: cluster.geometry.coordinates as [number, number], zoom: next + 0.3, duration: 700 });
    });
    instance.on('click', 'camera-points', event => { const id = event.features?.[0]?.properties?.id; if (typeof id === 'string') callbacks.current.onCamera(id); });
    instance.on('click', event => {
      if (instance.queryRenderedFeatures(event.point, { layers: ['clusters', 'camera-points'] }).length) return;
      instance.flyTo({ center: event.lngLat, zoom: Math.min(instance.getZoom() + 3, 15), duration: 800 });
    });
    for (const layer of ['clusters', 'camera-points']) {
      instance.on('mouseenter', layer, () => { instance.getCanvas().style.cursor = 'pointer'; });
      instance.on('mouseleave', layer, () => { instance.getCanvas().style.cursor = ''; setHover(''); });
    }
    instance.on('mousemove', 'camera-points', event => setHover(String(event.features?.[0]?.properties?.name ?? '')));
    instance.on('error', event => {
      const sourceId = (event as { sourceId?: string }).sourceId;
      console.warn('Camera map:', event.error?.message ?? 'Map source failed');
      if (sourceId === 'streets') setError('Street tiles are unavailable. Camera markers and the country map still work.');
      else setError('Some map data could not load. Refresh the page, or select a camera from the list.');
    });
    const observer = new ResizeObserver(() => instance.resize()); observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!loaded || !map.current) return;
    const filtered: CameraPoints = { ...points, features: points.features.filter(item => format === 'all' || (format === 'live' ? item.properties.live : format === 'video' ? item.properties.format !== 'snapshot' : item.properties.format === 'snapshot')) };
    (map.current.getSource('cameras') as GeoJSONSource).setData(filtered);
    (map.current.getSource('selected') as GeoJSONSource).setData({ ...points, features: points.features.filter(item => item.properties.id === selectedId) });
  }, [points, loaded, selectedId, format]);
  useEffect(() => {
    if (!focus || !loaded || !map.current) return;
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1000;
    if (focus.bounds) map.current.fitBounds(focus.bounds, { padding: 60, maxZoom: focus.zoom ?? 13, duration });
    else map.current.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 14, duration });
  }, [focus, loaded]);
  return <div className="atlas-map">
    <div ref={container} className="map-canvas" role="region" aria-busy={!loaded} aria-label="Interactive camera map. Click a cluster or place to zoom, then select a camera." />
    <div className="map-instructions"><Globe2 size={16} /><span>{zoom < 3 ? 'Choose a place. Get closer.' : 'Select a camera to watch here.'}</span></div>
    <div className="map-zoom"><button aria-label="Zoom in" onClick={() => map.current?.zoomIn({ duration: 350 })}><Plus size={19} /></button><button aria-label="Zoom out" onClick={() => map.current?.zoomOut({ duration: 350 })}><Minus size={19} /></button><button aria-label="Show whole world" onClick={() => map.current?.flyTo({ center: [12, 28], zoom: 1.25, duration: 800 })}><Globe2 size={18} /></button><button aria-label="Reset map rotation" onClick={() => map.current?.resetNorthPitch({ duration: 350 })}><RotateCcw size={17} /></button></div>
    {hover && <div className="map-hover">{hover}</div>}
    {error && <div className="map-error" role="status">{error}</div>}
    <div className="map-readout"><span>Zoom {zoom.toFixed(1)}</span><span><i className="pin-sample" />Stream source</span><span><i className="pin-sample still" />Clip / image</span></div>
  </div>;
}
