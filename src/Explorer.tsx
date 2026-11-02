import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Bell, Bookmark, Check, ChevronDown, ChevronRight, CloudRain, ExternalLink, Globe2, Heart, Info, Layers2, List, MapPin, Search, Share2, Sun, Video, Wind, X } from 'lucide-react';
import type { FeatureCollection, Point } from 'geojson';
import type { Bounds, Camera, CatalogResult, FeedFormat, PlaceResult, ProviderStatus, Session, Weather } from '../shared/types';
import { cameras as seeds } from '../shared/cameras';
import { api } from './api';
import CameraPlayer, { formatLabel } from './CameraPlayer';
import WatchPanel, { WatchEditor } from './WatchPanel';
import type { CameraPoints, MapFocus } from './CameraMap';

const CameraMap = lazy(() => import('./CameraMap'));
const wholeWorld: Bounds = [-180, -85, 180, 85];
const emptyPoints: CameraPoints = { type: 'FeatureCollection', features: [] };
const regions = [
  { name: 'World', lat: 28, lng: 12, zoom: 1.25 },
  { name: 'India', lat: 22.5, lng: 79, zoom: 4 },
  { name: 'China', lat: 34, lng: 105, zoom: 3.5 },
  { name: 'Ukraine', lat: 49, lng: 31, zoom: 5 },
  { name: 'Africa', lat: 0, lng: 22, zoom: 2.5 },
  { name: 'Americas', lat: 18, lng: -85, zoom: 2.5 },
  { name: 'London', lat: 51.508, lng: -0.127, zoom: 11 },
  { name: 'California', lat: 37.4, lng: -119.7, zoom: 6 },
  { name: 'Venice', lat: 45.437, lng: 12.332, zoom: 13 },
  { name: 'Tokyo', lat: 35.66, lng: 139.70, zoom: 11 },
];
const displayName = (camera: Camera) => camera.id.includes(':') || camera.media ? camera.name : camera.place;
const initialCameraId = () => location.pathname.startsWith('/place/') ? decodeURIComponent(location.pathname.slice(7)) : new URLSearchParams(location.search).get('camera');
type Tab = 'explore' | 'saved' | 'alerts' | 'sources';

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="map-unavailable"><Globe2 size={36} /><h2>Map unavailable on this device</h2><p>Use the camera list to select and watch a feed.</p></div> : this.props.children; }
}

function CameraThumbnail({ camera }: { camera: Camera }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [camera.id, camera.imageUrl]);
  const source = camera.imageUrl ?? camera.posterUrl;
  return <span className="camera-thumb">{source && !failed ? <img src={source} alt="" loading="lazy" onError={() => setFailed(true)} /> : <Video size={22} />}<span>{camera.media?.live ? <Video size={11} /> : <Layers2 size={11} />}</span></span>;
}

function CameraClock({ camera }: { camera: Camera }) {
  const [time, setTime] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setTime(Date.now()), 30000); return () => clearInterval(timer); }, []);
  return <span>{new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: camera.timezone }).format(time)} {camera.timezone === 'UTC' ? 'UTC' : 'local'}</span>;
}

export default function Explorer() {
  const [tab, setTab] = useState<Tab>('explore');
  const [selected, setSelected] = useState<Camera | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [bounds, setBounds] = useState<Bounds>(wholeWorld);
  const [points, setPoints] = useState<CameraPoints>(emptyPoints);
  const [catalog, setCatalog] = useState<CatalogResult>({ cameras: seeds, total: seeds.length, indexed: seeds.length, truncated: false, providers: [] });
  const [known, setKnown] = useState(() => new Map(seeds.map(camera => [camera.id, camera])));
  const [session, setSession] = useState<Session | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const [format, setFormat] = useState<FeedFormat>('live');
  const [playbackStates, setPlaybackStates] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [finding, setFinding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [watchOpen, setWatchOpen] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [busyPush, setBusyPush] = useState(false);
  const [mobilePane, setMobilePane] = useState<'map' | 'list' | 'viewer'>('map');
  const [deletePrompt, setDeletePrompt] = useState(false);
  const selectionRequest = useRef(0);
  const [refresh, setRefresh] = useState(0);
  const currentId = useRef<string | null>(null);
  currentId.current = selected?.id ?? null;
  const recordPlaybackState = useCallback((state: string) => {
    const id = currentId.current;
    if (id) setPlaybackStates(previous => previous[id] === state ? previous : { ...previous, [id]: state });
  }, []);

  const loadSession = useCallback(async () => { const value = await api<Session>('/session'); setSession(value); setConnectionError(''); }, []);
  useEffect(() => { const timer = setTimeout(() => setCatalogQuery(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  const remember = useCallback((items: Camera[]) => setKnown(previous => { const next = new Map(previous); for (const camera of items) next.set(camera.id, camera); return next; }), []);
  const chooseCamera = useCallback(async (id: string, writeHistory = true) => {
    const request = ++selectionRequest.current;
    try {
      const camera = await api<Camera>(`/cameras/${encodeURIComponent(id)}`);
      if (request !== selectionRequest.current) return;
      setSelected(camera); remember([camera]); setWatchOpen(false); setTab(current => current === 'saved' ? current : 'explore');
      setFocus({ lat: camera.lat, lng: camera.lng, zoom: 14.5, nonce: Date.now() });
      setMobilePane('viewer'); if (writeHistory) history.pushState({}, '', `/place/${encodeURIComponent(camera.id)}`);
      document.title = `${displayName(camera)} — Glim`;
    } catch (error) { setToast((error as Error).message); }
  }, [remember]);
  useEffect(() => {
    void loadSession().catch(error => setConnectionError(error.message));
    const id = initialCameraId(); if (id) void chooseCamera(id, false);
    const timer = setInterval(() => { if (!document.hidden) { void loadSession().catch(() => {}); setRefresh(value => value + 1); } }, 30000);
    return () => clearInterval(timer);
  }, [loadSession, chooseCamera]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    const params = new URLSearchParams({ bbox: bounds.map(value => value.toFixed(4)).join(','), format, q: catalogQuery, limit: '150' });
    void api<CatalogResult>(`/cameras?${params}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]) }).then(async result => {
      if (controller.signal.aborted) return;
      setCatalog(result); remember(result.cameras); setConnectionError('');
      const map = await api<CameraPoints>('/cameras/map', { signal: controller.signal });
      setPoints(map);
    }).catch(error => { if (!controller.signal.aborted) setConnectionError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [bounds, format, catalogQuery, refresh, remember]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController(); setWeather(null);
    void api<Weather>(`/weather/${encodeURIComponent(selected.id)}`, { signal: controller.signal }).then(setWeather).catch(() => {});
    const timer = setInterval(() => {
      void api<Camera>(`/cameras/${encodeURIComponent(selected.id)}`, { signal: controller.signal }).then(camera => { if (currentId.current === camera.id) setSelected(camera); }).catch(() => {});
      void api<Weather>(`/weather/${encodeURIComponent(selected.id)}`, { signal: controller.signal }).then(setWeather).catch(() => {});
    }, 240000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [selected?.id]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 6000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const ids = [...(session?.favorites ?? []), ...(session?.rules.map(rule => rule.cameraId) ?? [])].filter(id => !known.has(id));
    let disposed = false;
    void Promise.allSettled([...new Set(ids)].slice(0, 50).map(id => api<Camera>(`/cameras/${encodeURIComponent(id)}`))).then(results => { if (!disposed) remember(results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])); });
    return () => { disposed = true; };
  }, [session?.favorites.join(','), session?.rules.map(rule => rule.cameraId).join(','), remember]);
  useEffect(() => { const handler = () => { const id = initialCameraId(); if (id) void chooseCamera(id, false); else { setSelected(null); setMobilePane('map'); } }; addEventListener('popstate', handler); return () => removeEventListener('popstate', handler); }, [chooseCamera]);
  const onView = useCallback((next: Bounds) => setBounds(previous => previous.every((value, index) => Math.abs(value - next[index]) < 0.0001) ? previous : next), []);

  async function searchPlace(event: React.FormEvent) {
    event.preventDefault(); if (query.trim().length < 2 || finding) return;
    setFinding(true); setPlaceResults([]);
    try { const result = await api<PlaceResult[]>(`/places?q=${encodeURIComponent(query.trim())}`); setPlaceResults(result); if (!result.length) setToast('No place found. Try a city, region, or country name.'); }
    catch (error) { setToast((error as Error).message); }
    finally { setFinding(false); }
  }
  function choosePlace(place: PlaceResult) {
    setFocus({ lat: place.lat, lng: place.lng, bounds: place.bounds, zoom: 12, nonce: Date.now() }); setPlaceResults([]); setQuery(''); setMobilePane('map');
    const country = /^country:([A-Z]{2})$/.exec(place.id)?.[1];
    if (country) void api<CatalogResult>(`/cameras?country=${country}&limit=1`).then(() => setRefresh(value => value + 1)).catch(() => {});
  }
  async function saveCamera() {
    if (!selected || !session || busySave) return;
    setBusySave(true);
    try { await api('/favorites', { method: 'POST', body: JSON.stringify({ cameraId: selected.id, saved: !session.favorites.includes(selected.id) }) }); await loadSession(); }
    catch (error) { setToast((error as Error).message); }
    finally { setBusySave(false); }
  }
  async function shareCamera() {
    if (!selected) return;
    const url = `${location.origin}/place/${encodeURIComponent(selected.id)}`;
    try { await navigator.clipboard.writeText(url); setToast('Camera link copied.'); } catch { setToast(url); }
  }
  async function togglePush() {
    if (!session?.pushKey || !('serviceWorker' in navigator) || !('PushManager' in window)) { setToast('Background push is unavailable. Alerts remain in your inbox.'); return; }
    setBusyPush(true);
    try {
      if (session.pushEnabled) { await api('/push', { method: 'DELETE' }); const registration = await navigator.serviceWorker.getRegistration('/'); await (await registration?.pushManager.getSubscription())?.unsubscribe(); }
      else {
        if (await Notification.requestPermission() !== 'granted') throw new Error('Allow notifications in browser settings to receive background alerts.');
        await navigator.serviceWorker.register('/sw.js'); const registration = await navigator.serviceWorker.ready;
        const value = session.pushKey.replace(/-/g, '+').replace(/_/g, '/');
        const key = Uint8Array.from(atob(value.padEnd(Math.ceil(value.length / 4) * 4, '=')), character => character.charCodeAt(0));
        const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await api('/push', { method: 'POST', body: JSON.stringify(subscription.toJSON()) });
      }
      await loadSession();
    } catch (error) { setToast((error as Error).message); }
    finally { setBusyPush(false); }
  }
  const visible = (tab === 'saved' ? (session?.favorites.flatMap(id => known.get(id) ? [known.get(id)!] : []) ?? []) : catalog.cameras)
    .filter(camera => `${camera.name} ${camera.place} ${camera.country} ${camera.provider}`.toLowerCase().includes(query.toLowerCase()) &&
      (format === 'all' || (format === 'live' ? camera.media?.live : format === 'video' ? camera.media : camera.imageUrl && !camera.media)));
  const saved = selected && session?.favorites.includes(selected.id);
  const nearbyLive = selected ? [...known.values()].filter(camera => camera.id !== selected.id && camera.media?.live && camera.media.kind !== 'embed' && playbackStates[camera.id] !== 'Unavailable' && Math.abs(camera.lat - selected.lat) < 0.5 && Math.abs(camera.lng - selected.lng) < 0.5)
    .sort((a, b) => Math.hypot(a.lat - selected.lat, a.lng - selected.lng) - Math.hypot(b.lat - selected.lat, b.lng - selected.lng))[0] : undefined;
  const connectedProviders = catalog.providers.filter(provider => provider.status === 'ready').length;
  return <div className={`atlas-app mobile-${mobilePane} ${selected ? 'has-viewer' : ''}`}>
    <a className="skip-link" href="#camera-index">Skip to camera list</a>
    <header className="atlas-header"><a className="brand" href="/" aria-label="Glim camera atlas"><span className="brand-mark"><Globe2 size={24} /></span><strong>glim</strong><span className="brand-purpose">Public camera atlas</span></a>
      <nav aria-label="Workspace navigation">{([{ value: 'explore', title: 'Explore', icon: Globe2 }, { value: 'saved', title: 'Saved', icon: Bookmark }, { value: 'alerts', title: 'Watches', icon: Bell }] as const).map(item => <button key={item.value} className={tab === item.value ? 'active' : ''} onClick={() => { setTab(item.value); if (item.value !== 'explore') setMobilePane('list'); }} aria-label={item.title} aria-pressed={tab === item.value}><item.icon size={16} /><span>{item.title}</span>{item.value === 'saved' && !!session?.favorites.length && <small>{session.favorites.length}</small>}</button>)}</nav>
      <button className="header-sources" onClick={() => { setTab(tab === 'sources' ? 'explore' : 'sources'); setMobilePane('list'); }}><span className={`connection-dot ${connectedProviders ? 'ready' : ''}`} /><span>{catalog.indexed.toLocaleString()} indexed</span><ChevronDown size={14} /></button>
    </header>
    <div className="atlas-workspace">
      <aside className="camera-index" id="camera-index" aria-label="Camera browser" tabIndex={-1}>
        {tab === 'alerts' ? <WatchPanel session={session} names={known} onReload={loadSession} onCamera={id => void chooseCamera(id)} onPush={togglePush} busyPush={busyPush} onError={setToast} />
          : tab === 'sources' ? <div className="sources-pane"><div className="sidebar-heading"><h1>Camera networks</h1><p>Real sources. Explicit coverage and playback formats.</p></div>{catalog.providers.map(provider => <article className="provider-row" key={provider.id}><div><h2>{provider.name}</h2><span className={`provider-state ${provider.status}`}>{provider.status}</span></div><p>{provider.message}</p><span>{provider.count.toLocaleString()} indexed{provider.updatedAt ? ` · checked ${new Date(provider.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span></article>)}
            <section className="source-explanation"><h2>What “live” means here</h2><p>Live sources offer a continuous stream. Playback is confirmed in the player. TfL clips, Windy timelapses, and updating images are labeled separately.</p><p>Glim indexes intentionally public cameras. Coverage depends on connected providers; it does not include every camera in the world.</p><a href="https://github.com/sreyasts/glim/blob/main/docs/SOURCES.md" target="_blank" rel="noopener noreferrer">Sources and rights <ArrowUpRight size={14} /></a><h2>Your privacy</h2><p>Saved cameras and watches belong to this browser’s session. No location permission or video recording. Selected players and images contact their original operators.</p><button className="inline-link" onClick={() => setDeletePrompt(value => !value)}>Delete this browser’s saved data</button>{deletePrompt && <div className="delete-confirm"><p>This removes all saved cameras, watches, inbox events, and your push subscription.</p><button className="action-btn danger" onClick={async () => { try { await api('/session', { method: 'DELETE' }); await loadSession(); setDeletePrompt(false); setToast('Your Glim session data was deleted.'); } catch (error) { setToast((error as Error).message); } }}>Confirm deletion</button></div>}</section>
          </div> : <>
            <div className="sidebar-heading"><h1>{tab === 'saved' ? 'Saved cameras' : 'Find a camera'}</h1><p>{tab === 'saved' ? 'Your cameras, one click away.' : 'Search a place, then zoom into its cameras.'}</p></div>
            <form className="place-search" onSubmit={event => void searchPlace(event)}><Search size={17} /><input aria-label="Search a place or camera" placeholder="City, country, or camera…" value={query} onChange={event => setQuery(event.target.value)} /><button type="submit" aria-label="Search places" disabled={finding || query.trim().length < 2}>{finding ? '…' : <ArrowRight size={17} />}</button></form>
            {!!placeResults.length && <div className="place-results">{placeResults.map(place => <button key={place.id} onClick={() => choosePlace(place)}><MapPin size={15} /><span>{place.name}</span><ChevronRight size={14} /></button>)}<span>Places: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a> · CC BY 4.0</span></div>}
            <div className="format-filters" aria-label="Camera formats">{([{ value: 'all', name: 'All' }, { value: 'live', name: 'Live sources' }, { value: 'video', name: 'Video' }, { value: 'snapshot', name: 'Images' }] as const).map(item => <button key={item.value} aria-pressed={format === item.value} className={format === item.value ? 'active' : ''} onClick={() => setFormat(item.value)}>{item.name}</button>)}</div>
            <div className="list-heading"><h2>{tab === 'saved' ? 'Your collection' : 'Cameras in this area'}</h2><span>{loading ? 'Updating…' : tab === 'saved' ? visible.length : catalog.total.toLocaleString()}</span></div>
            {connectionError && <div className="connection-notice" role="status"><Info size={16} /><span>{connectionError}</span><button aria-label="Retry camera catalog" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
            <div className="camera-rows">{visible.length ? visible.map(camera => <button className={`camera-row ${selected?.id === camera.id ? 'selected' : ''}`} key={camera.id} onClick={() => void chooseCamera(camera.id)} aria-pressed={selected?.id === camera.id}><CameraThumbnail camera={camera} /><span className="camera-row-copy"><strong>{displayName(camera)}</strong><span>{camera.place}{camera.place !== camera.country ? `, ${camera.country}` : ''}</span><small className={camera.media?.live && playbackStates[camera.id] !== 'Unavailable' ? 'format-live' : ''}>{playbackStates[camera.id] === 'Unavailable' ? 'Stream unavailable' : formatLabel(camera)}</small></span><ChevronRight size={15} /></button>) : <div className="empty-copy"><MapPin size={26} /><h3>{tab === 'saved' ? 'No saved cameras' : loading ? 'Loading this area' : 'No matching cameras here'}</h3><p>{tab === 'saved' ? 'Open a camera and select Save.' : 'Zoom out, try another format, or search a different place. Provider coverage varies.'}</p><button className="inline-link" onClick={() => { setFormat('all'); setQuery(''); setFocus({ lat: 28, lng: 12, zoom: 1.25, nonce: Date.now() }); }}>Show world map <ArrowRight size={14} /></button></div>}</div>
            {catalog.truncated && tab === 'explore' && <p className="result-limit">Showing {catalog.cameras.length} of {catalog.total.toLocaleString()} in this area. Zoom closer to find an individual camera.</p>}
            <div className="index-footer"><span className="connection-dot ready" />{connectedProviders} connected sources<button onClick={() => setTab('sources')}>Details <ArrowUpRight size={12} /></button></div>
          </>}
      </aside>
      <main className="map-workspace" aria-label="Camera map workspace"><div className="region-bar"><div className="region-label"><MapPin size={15} />Jump to</div>{regions.map(region => <button key={region.name} onClick={() => { setFocus({ lat: region.lat, lng: region.lng, zoom: region.zoom, nonce: Date.now() }); setQuery(''); setPlaceResults([]); setMobilePane('map'); }}>{region.name}</button>)}</div>
        <MapBoundary><Suspense fallback={<div className="map-unavailable"><Globe2 size={40} /><h2>Loading camera map</h2><p>The camera browser is ready to use.</p></div>}><CameraMap points={points} focus={focus} selectedId={selected?.id ?? null} format={format} onCamera={id => void chooseCamera(id)} onView={onView} /></Suspense></MapBoundary>
        {!selected && <div className="map-onboarding"><Video size={20} /><div><strong>The view starts with a point.</strong><p>Click a cluster to get closer. Select a camera to watch it here.</p></div><button aria-label="Browse cameras" onClick={() => setMobilePane('list')}><List size={18} /></button></div>}
      </main>
      {selected && <aside className="camera-viewer" aria-label={`Camera viewer: ${displayName(selected)}`}><div className="viewer-heading"><span><Video size={16} />Camera view</span><button className="icon-btn" aria-label="Close camera viewer" onClick={() => { selectionRequest.current++; setSelected(null); setWatchOpen(false); setMobilePane('map'); history.pushState({}, '', '/'); document.title = 'Glim — Public camera atlas'; }}><X size={19} /></button></div>
        <CameraPlayer key={selected.id} camera={selected} onState={recordPlaybackState} onNext={nearbyLive ? () => void chooseCamera(nearbyLive.id) : undefined} />
        <div className="viewer-content"><div className="viewer-location"><MapPin size={14} /><span>{selected.place}, {selected.country}</span><CameraClock camera={selected} /></div><h1>{displayName(selected)}</h1><div className="viewer-format"><span className="format-tag">{formatLabel(selected)}</span><span>{selected.provider}</span></div><div className="viewer-actions"><button className={`action-btn ${saved ? 'saved' : ''}`} disabled={!session || busySave} onClick={() => void saveCamera()}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save'}</button><button className="action-btn" disabled={!session} onClick={() => setWatchOpen(value => !value)}><Bell size={16} />Watch location</button><button className="icon-btn" aria-label="Share camera link" onClick={() => void shareCamera()}><Share2 size={17} /></button></div>
          {watchOpen && <WatchEditor camera={selected} onCancel={() => setWatchOpen(false)} onDone={async () => { await loadSession(); setWatchOpen(false); setToast('Weather watch created. Open Watches to manage it.'); }} />}
          <div className="location-facts"><div><span>{selected.coordinateAccuracy ? 'Approximate park location' : 'Coordinates'}</span><strong>{selected.lat.toFixed(selected.coordinateAccuracy ? 3 : 5)}, {selected.lng.toFixed(selected.coordinateAccuracy ? 3 : 5)}</strong></div><div><span>Source format</span><strong>{selected.media?.kind === 'mp4' ? 'Short MP4 clip' : selected.media?.kind === 'hls' ? 'HLS video stream' : selected.media?.kind === 'youtube' ? 'YouTube broadcast' : selected.media?.kind === 'embed' ? 'Operator player' : 'Still image'}</strong></div></div>
          {weather && <section className="location-weather"><h2>Location weather <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo <ArrowUpRight size={11} /></a></h2><div><span><Sun size={18} /><strong>{Math.round(weather.temperature)}°</strong></span><span><Wind size={16} />{Math.round(weather.windSpeed)} km/h</span><span><CloudRain size={16} />{weather.precipitation} mm</span></div><p>Model data · {new Date(weather.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Not camera image analysis.</p></section>}
          <section className="source-details"><h2>Source & availability</h2><p>{selected.provider === 'Transport for London' || selected.media?.kind === 'youtube' ? selected.description : selected.media?.kind === 'hls' ? 'Published through the official Caltrans camera catalog. Some advertised streams may be offline; the player offers the source image when a stream fails.' : selected.provider === 'Windy Webcams' ? selected.description : 'This view comes from the credited operator. Playback and capture freshness depend on that source. Glim does not record the feed.'}</p><a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">Original camera <ExternalLink size={14} /></a><a href={selected.permissionUrl} target="_blank" rel="noopener noreferrer">Source terms <ArrowUpRight size={13} /></a></section>
          <button className="back-to-map" onClick={() => setMobilePane('map')}><ArrowLeft size={15} />Back to map</button>
        </div>
      </aside>}
    </div>
    <nav className="mobile-workspace-tabs" aria-label="Mobile workspace"><button className={mobilePane === 'map' ? 'active' : ''} aria-pressed={mobilePane === 'map'} onClick={() => setMobilePane('map')}><Globe2 size={18} />Map</button><button className={mobilePane === 'list' ? 'active' : ''} aria-pressed={mobilePane === 'list'} onClick={() => setMobilePane('list')}><List size={18} />Cameras</button><button className={mobilePane === 'viewer' ? 'active' : ''} aria-pressed={mobilePane === 'viewer'} disabled={!selected} onClick={() => setMobilePane('viewer')}><Video size={18} />Viewer</button></nav>
    {toast && <div className="atlas-toast" role="status"><Info size={17} /><span>{toast}</span><button className="icon-btn" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16} /></button></div>}
  </div>;
}
