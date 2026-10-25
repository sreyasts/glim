import { useEffect, useRef, useState } from 'react';
import GlobeGL, { type GlobeMethods } from 'react-globe.gl';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import type { Camera } from '../shared/types';
import { MeshPhongMaterial } from 'three';

const topology = world as unknown as Topology<{ countries: GeometryCollection }>;
const countries = feature(topology, topology.objects.countries).features;
const globeMaterial = new MeshPhongMaterial({ color: '#142929', shininess: 5 });

export default function Globe({ cameras, selected, onSelect, reducedMotion }: { cameras: Camera[]; selected: Camera | null; onSelect: (camera: Camera) => void; reducedMotion: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 600, height: 590 });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!ready || !globe.current) return;
    const controls = globe.current.controls();
    controls.autoRotate = !selected && !reducedMotion;
    controls.autoRotateSpeed = 0.25;
    controls.enableZoom = false;
    controls.enablePan = false;
    globe.current.pointOfView(selected ? { lat: selected.lat, lng: selected.lng, altitude: 2.1 } : { lat: 22, lng: -35, altitude: 2.1 }, reducedMotion ? 0 : 1100);
  }, [selected, ready, reducedMotion]);

  return <div ref={container} className="globe-canvas" aria-label="Interactive globe. Drag to rotate; use the place cards to select an accessible camera.">
    <GlobeGL ref={globe} width={size.width} height={size.height} backgroundColor="rgba(0,0,0,0)"
      globeMaterial={globeMaterial} showAtmosphere atmosphereColor="#8eb8a7" atmosphereAltitude={0.11}
      polygonsData={countries} polygonCapColor={() => '#294944'} polygonSideColor={() => '#182f2e'} polygonStrokeColor={() => '#658177'} polygonAltitude={0.006}
      pointsData={cameras} pointLat="lat" pointLng="lng" pointColor={point => (point as Camera).id === selected?.id ? '#ffc695' : '#c9e4b8'} pointAltitude={0.035} pointRadius={point => (point as Camera).id === selected?.id ? 0.65 : 0.4}
      pointLabel={point => (point as Camera).place.replace(/[&<>\"]/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[value]!)}
      onPointClick={point => onSelect(point as Camera)}
      ringsData={selected ? [selected] : []} ringLat="lat" ringLng="lng" ringColor={() => '#efb989'} ringMaxRadius={4} ringPropagationSpeed={reducedMotion ? 0 : 0.8} ringRepeatPeriod={2000}
      animateIn={!reducedMotion} onGlobeReady={() => setReady(true)}
    />
  </div>;
}
