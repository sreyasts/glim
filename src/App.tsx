import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Bell, BellRing, Check, ChevronRight, Clock3, CloudRain, Compass, ExternalLink, Github, Globe2, Heart, Info, LoaderCircle, MapPin, Moon, Mountain, Pause, Play, Search, Share2, ShieldCheck, Shuffle, Snowflake, Sun, Sunrise, Sunset, Trash2, Waves, Wind, X } from 'lucide-react';
import { cameras } from '../shared/cameras';
import { ruleLabels, type Camera, type Category, type RuleKind, type Session, type Weather } from '../shared/types';
import { api } from './api';

const Globe = lazy(() => import('./Globe'));
const categories = ['All places', 'Nature', 'City', 'Coast', 'Wildlife', 'Volcano'] as const;
const initialId = new URLSearchParams(location.search).get('camera') ?? (location.pathname.startsWith('/place/') ? decodeURIComponent(location.pathname.slice(7)) : null);
const defaultCamera = cameras.find(camera => camera.id === initialId) ?? cameras[0];
type Tab = 'explore' | 'saved' | 'alerts';

class GlobeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="globe-fallback"><Globe2 size={100} strokeWidth={0.7} /><p>Your world is still here.</p><span>3D is unavailable on this device. Pick any place from the list.</span></div> : this.props.children; }
}

function LocalTime({ camera }: { camera: Camera }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  return <>{new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: camera.timezone }).format(now)}</>;
}

function CameraImage({ camera, className = '', refresh = false }: { camera: Camera; className?: string; refresh?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    setFailed(false); setLoadedAt(null); setVersion(0);
    if (!refresh || !camera.imageUrl) return;
    const timer = setInterval(() => setVersion(value => value + 1), (camera.refreshSeconds ?? 900) * 1000);
    return () => clearInterval(timer);
  }, [camera.id, camera.imageUrl, camera.refreshSeconds, refresh]);
  return <div className={`camera-image ${className}`} style={{ '--place-accent': camera.accent } as React.CSSProperties}>
    {camera.imageUrl && !failed ? <>
      <img key={`${camera.id}-${version}`} src={`${camera.imageUrl}${version ? `?refresh=${version}` : ''}`} alt={`${camera.provider} webcam view of ${camera.place}`} onLoad={() => setLoadedAt(Date.now())} onError={() => setFailed(true)} loading={refresh ? 'eager' : 'lazy'} referrerPolicy="no-referrer" />
      {refresh && !loadedAt && <span className="image-loading"><LoaderCircle className="spin" size={18} /> Loading source image</span>}
    </> : <div className="source-art"><Globe2 size={refresh ? 78 : 24} strokeWidth={0.8} />{refresh && <><span>{failed ? 'The camera is taking a little break.' : 'A window worth opening.'}</span><small>{failed ? 'The source image could not be loaded.' : `Watch this view with ${camera.provider}.`}</small></>}</div>}
    {refresh && <div className="image-caption"><span className={`status-dot ${loadedAt && !failed ? '' : 'muted'}`} />{loadedAt && !failed ? 'Image loaded · capture time set by source' : failed ? 'Source image unavailable' : 'View on operator’s site'}</div>}
  </div>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} className="modal" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>{children}
  </dialog>;
}

function RuleForm({ camera, onClose, onCreated }: { camera: Camera; onClose: () => void; onCreated: () => Promise<void> }) {
  const [kind, setKind] = useState<RuleKind>('rain');
  const [threshold, setThreshold] = useState(25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const icons = { rain: CloudRain, snow: Snowflake, wind: Wind, sunrise: Sunrise, sunset: Sunset };
  return <Modal title="A little heads-up." onClose={onClose}>
    <p className="modal-description">Let the world come to you. Watch the weather at <strong>{camera.place}</strong>.</p>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      try {
        await api('/rules', { method: 'POST', body: JSON.stringify({ cameraId: camera.id, kind, threshold: kind === 'wind' ? threshold : 0 }) });
        await onCreated(); onClose();
      } catch (failure) { setError((failure as Error).message); }
      finally { setBusy(false); }
    }}>
      <fieldset className="rule-options"><legend>Notify me when…</legend>{(Object.keys(ruleLabels) as RuleKind[]).map(value => {
        const Icon = icons[value];
        return <label className={kind === value ? 'chosen' : ''} key={value}><input type="radio" name="condition" value={value} checked={kind === value} onChange={() => setKind(value)} /><Icon size={19} /><span>{ruleLabels[value]}</span><span className="radio-dot" /></label>;
      })}</fieldset>
      {kind === 'wind' && <label className="threshold-label">Wind speed (km/h)<input type="number" min={1} max={200} value={threshold} onChange={event => setThreshold(Number(event.target.value))} required /></label>}
      <div className="note"><Info size={16} /><p>{kind === 'sunrise' || kind === 'sunset' ? 'Alerts in the 15 minutes before the predicted time. Polar locations may have no sunrise or sunset.' : 'Checked every 5 minutes using Open-Meteo weather data for this location. This does not analyze camera images.'} Alerts appear in your inbox. Enable browser push in Your alerts for delivery while Glim is closed.</p></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Bell size={16} />} {busy ? 'Creating alert…' : 'Keep me in the loop'}<ArrowRight size={16} /></button>
      <p className="fine-print">Saved to this browser · pause or remove anytime</p>
    </form>
  </Modal>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('explore');
  const [selected, setSelected] = useState<Camera>(defaultCamera);
  const [globeTarget, setGlobeTarget] = useState<Camera | null>(initialId ? defaultCamera : null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All places');
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState('');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [modal, setModal] = useState<'rule' | 'about' | 'privacy' | null>(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [rotate, setRotate] = useState(true);
  const [pendingAction, setPendingAction] = useState(false);
  const visible = cameras.filter(camera => (category === 'All places' || camera.category === category) &&
    `${camera.name} ${camera.place} ${camera.country} ${camera.provider}`.toLowerCase().includes(query.toLowerCase()) && (tab !== 'saved' || session?.favorites.includes(camera.id)));
  const selectedSaved = session?.favorites.includes(selected.id) ?? false;

  async function loadSession() {
    const data = await api<Session>('/session');
    setSession(data); setSessionError('');
  }
  useEffect(() => {
    void loadSession().catch(error => setSessionError(error.message));
    const timer = setInterval(() => { if (!document.hidden) void loadSession().catch(() => {}); }, 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setWeather(null); setWeatherError(false);
    const fetchWeather = () => void api<Weather>(`/weather/${selected.id}`, { signal: controller.signal }).then(setWeather).catch(() => { if (!controller.signal.aborted) setWeatherError(true); });
    fetchWeather();
    const timer = setInterval(fetchWeather, 300000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [selected.id]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const handler = () => { const id = location.pathname.startsWith('/place/') ? location.pathname.slice(7) : new URLSearchParams(location.search).get('camera'); const camera = cameras.find(item => item.id === id); if (camera) { setSelected(camera); setGlobeTarget(camera); } };
    addEventListener('popstate', handler); return () => removeEventListener('popstate', handler);
  }, []);

  function select(camera: Camera) {
    setSelected(camera); setGlobeTarget(camera);
    history.pushState({}, '', `/place/${camera.id}`);
    document.title = `${camera.place} — glim`;
  }
  async function favorite() {
    if (pendingAction || !session) return;
    setPendingAction(true);
    try {
      const result = await api<{ favorites: string[] }>('/favorites', { method: 'POST', body: JSON.stringify({ cameraId: selected.id, saved: !selectedSaved }) });
      setSession(current => current && ({ ...current, favorites: result.favorites }));
      setToast(selectedSaved ? 'Place removed from your collection.' : 'A little escape, saved for later.');
    } catch (error) { setToast((error as Error).message); }
    finally { setPendingAction(false); }
  }
  async function share() {
    const url = `${location.origin}/place/${selected.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${selected.place} — glim`, text: 'A little window into somewhere wonderful.', url });
      else { await navigator.clipboard.writeText(url); setToast('Link copied. Send someone a little escape.'); }
    } catch (error) { if ((error as Error).name !== 'AbortError') setToast(`Share this place: ${url}`); }
  }
  async function changeRule(id: string, enabled?: boolean) {
    setBusy(true);
    try { await api(`/rules/${id}`, { method: enabled === undefined ? 'DELETE' : 'PATCH', ...(enabled === undefined ? {} : { body: JSON.stringify({ enabled }) }) }); await loadSession(); }
    catch (error) { setToast((error as Error).message); }
    finally { setBusy(false); }
  }
  async function togglePush() {
    if (!session?.pushKey) { setToast('The server needs VAPID keys for background push. Your alert inbox is active.'); return; }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { setToast('This browser does not support background push. Use your alert inbox.'); return; }
    setBusy(true);
    try {
      if (session.pushEnabled) {
        await api('/push', { method: 'DELETE' });
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        await subscription?.unsubscribe();
        await loadSession(); setToast('Background notifications turned off.'); return;
      }
      if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser’s site settings.');
      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;
      const base64 = session.pushKey.replace(/-/g, '+').replace(/_/g, '/');
      const key = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), character => character.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await api('/push', { method: 'POST', body: JSON.stringify(subscription.toJSON()) });
      await loadSession(); setToast('You’re connected. Glim can now reach you in the background.');
    } catch (error) { setToast((error as Error).message); }
    finally { setBusy(false); }
  }

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <a className="logo" href="/" aria-label="Glim home"><span className="logo-icon"><Globe2 size={27} strokeWidth={1.5} /><span /></span>glim<span className="logo-period">.</span></a>
      <nav aria-label="Main navigation">{([{ id: 'explore', label: 'Explore', icon: Compass }, { id: 'saved', label: 'Saved places', icon: Heart }, { id: 'alerts', label: 'Your alerts', icon: Bell }] as const).map(item => <button key={item.id} aria-label={item.label} className={`nav-item ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}><item.icon size={15} /><span>{item.label}</span>{item.id === 'saved' && !!session?.favorites.length && <small>{session.favorites.length}</small>}</button>)}</nav>
      <a className="github-link" href="https://github.com/sreyasts/glim" target="_blank" rel="noopener noreferrer"><Github size={17} /><span>Built in the open</span><ArrowUpRight size={14} /></a>
    </header>

    <main id="main" tabIndex={-1}>
      <section className="intro"><div><p className="eyebrow"><span className="status-dot" /> A LITTLE WINDOW INTO EVERYWHERE</p><h1>{tab === 'alerts' ? <>Good things happen.<br /><em>Be there for them.</em></> : tab === 'saved' ? <>Your favorite corners.<br /><em>One little collection.</em></> : <>Somewhere, something<br /><em>wonderful is happening.</em></>}</h1><p className="intro-copy">{tab === 'alerts' ? 'A change in the weather. A new day beginning. We’ll keep an eye on it.' : tab === 'saved' ? 'The places you keep coming back to. No passport required.' : 'A quiet mountain. A busy street. A whole world to drop into.'}</p></div><div className="intro-side"><span className="edition">THE WORLD, AS IT IS.</span><p>{cameras.length} public windows<br />across <strong>{new Set(cameras.map(camera => camera.country)).size} countries & regions</strong></p><button onClick={() => setModal('about')}>A different kind of screen time <ArrowUpRight size={14} /></button></div></section>

      {sessionError && <div className="connection-banner" role="alert"><Info size={17} />{sessionError}<button onClick={() => void loadSession().catch(error => setSessionError(error.message))}>Reconnect</button></div>}

      {tab === 'alerts' ? <section className="alerts-layout" aria-label="Your alerts">
        <div className="alerts-main"><div className="section-heading"><h2>Your watchlist <span>{session?.rules.length ?? 0}</span></h2><button className="button primary small" disabled={!session} onClick={() => setModal('rule')}><Bell size={14} /> Create alert</button></div>
          {!session ? <p className="empty-state">{sessionError ? 'Reconnect to see your alerts.' : 'Loading your watchlist…'}</p> : !session.rules.length ? <div className="empty-state"><BellRing size={34} strokeWidth={1.2} /><h3>Let a place surprise you.</h3><p>Pick a place and a weather condition.<br />We’ll save a little heads-up in your inbox.</p><button className="button primary" onClick={() => setModal('rule')}>Create your first alert <ArrowRight size={16} /></button></div> : <div className="rule-list">{session.rules.map(rule => {
            const camera = cameras.find(item => item.id === rule.cameraId)!;
            return <article className={`rule-card ${rule.enabled ? '' : 'paused'}`} key={rule.id}><div className="rule-symbol">{rule.kind === 'rain' ? <CloudRain /> : rule.kind === 'snow' ? <Snowflake /> : rule.kind === 'wind' ? <Wind /> : <Sunrise />}</div><div><h3>{ruleLabels[rule.kind]}{rule.kind === 'wind' && ` · ${rule.threshold} km/h`}</h3><button className="text-link" onClick={() => { select(camera); setTab('explore'); }}>{camera.place}<ArrowUpRight size={13} /></button><p>{rule.enabled ? 'Watching every 5 minutes' : 'Paused'} · {rule.lastTriggeredAt ? `Last alert ${new Date(rule.lastTriggeredAt).toLocaleDateString()}` : 'No alerts yet'}</p></div><button className="icon-button" disabled={busy} aria-label={rule.enabled ? 'Pause alert' : 'Resume alert'} onClick={() => void changeRule(rule.id, !rule.enabled)}>{rule.enabled ? <Pause size={16} /> : <Play size={16} />}</button><button className="icon-button" disabled={busy} aria-label="Delete alert" onClick={() => void changeRule(rule.id)}><Trash2 size={16} /></button></article>;
          })}</div>}
          <div className="inbox"><h2>Your little updates <span>{session?.events.length ?? 0}</span></h2>{!session?.events.length ? <p>When a condition is detected, it appears here. No updates yet.</p> : session.events.map(event => <article key={event.id}><span className="status-dot" /><div><h3>{event.title}</h3><p>{event.body}</p><time>{new Date(event.createdAt).toLocaleString()}</time></div></article>)}</div>
        </div>
        <aside className="alert-sidebar"><div className="notification-illustration"><BellRing size={45} strokeWidth={1} /><span /></div><p className="eyebrow">DON’T MISS THE MOMENT</p><h2>Out of sight.<br /><em>Still in the loop.</em></h2><p>Your inbox updates while Glim runs on the server. Browser push can deliver updates even when this tab is closed.</p><button className="button primary full" disabled={busy || !session} onClick={() => void togglePush()}>{session?.pushEnabled ? <Check size={16} /> : <Bell size={16} />}{session?.pushEnabled ? 'Turn off browser push' : 'Enable browser push'}</button><p className="fine-print">{session?.pushKey ? 'Requires browser permission and HTTPS.' : 'Server setup needed: add VAPID keys to enable push.'}</p><div className="note"><ShieldCheck size={17} /><p>Weather alerts use location data, not camera analysis. Camera availability and notification delivery can vary.</p></div></aside>
      </section> : <>
        <div className="explorer-toolbar"><div className="search-box"><Search size={17} /><input aria-label="Search places" placeholder="Where do you want to go?" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="Clear search" className="icon-button" onClick={() => setQuery('')}><X size={14} /></button>}</div><div className="filters" role="group" aria-label="Filter places">{categories.map(value => <button key={value} aria-pressed={category === value} className={category === value ? 'active' : ''} onClick={() => setCategory(value)}>{value}</button>)}</div><button className="surprise-button" onClick={() => { const choices = visible.filter(camera => camera.id !== selected.id); if (choices.length) select(choices[Math.floor(Math.random() * choices.length)]); }} disabled={visible.length < 2}><Shuffle size={16} /><span>Take me somewhere</span></button></div>

        <section className="explorer" aria-label="Public webcam explorer">
          <aside className="place-sidebar" id="places" tabIndex={-1}><div className="place-list-heading"><span>{tab === 'saved' ? 'YOUR LITTLE ESCAPES' : 'PICK A LITTLE ESCAPE'}</span><span>{visible.length.toString().padStart(2, '0')}</span></div><div className="place-list">
            {visible.length ? visible.map(camera => <button className={`place-row ${selected.id === camera.id ? 'selected' : ''}`} key={camera.id} onClick={() => select(camera)} aria-pressed={selected.id === camera.id}><CameraImage camera={camera} className="place-thumb" /><span className="place-row-text"><strong>{camera.place}</strong><small>{camera.flag} {camera.category} <span>·</span> <LocalTime camera={camera} /></small></span>{session?.favorites.includes(camera.id) ? <Heart size={13} fill="currentColor" className="saved-heart" /> : <ChevronRight size={14} className="row-arrow" />}</button>) : <div className="list-empty"><Heart size={25} /><h3>{tab === 'saved' && !query ? 'Your world starts here.' : 'No places found.'}</h3><p>{tab === 'saved' && !query ? 'Tap the heart on any place to keep it close.' : 'Try another place or clear your filters.'}</p><button className="text-link" onClick={() => { setQuery(''); setCategory('All places'); setTab('explore'); }}>Explore all places <ArrowRight size={14} /></button></div>}
          </div><div className="sidebar-foot"><ShieldCheck size={14} /><span>Public sources. A little more perspective.</span></div></aside>

          <div className="globe-stage"><div className="globe-top-label"><span className="crosshair">+</span> FIND YOUR ELSEWHERE<span>01 / EARTH</span></div><div className="orbital-ring ring-one" /><div className="orbital-ring ring-two" />
            <GlobeBoundary><Suspense fallback={<div className="globe-fallback"><Globe2 size={92} strokeWidth={0.7} /><p>Opening up your world…</p></div>}><Globe cameras={visible} selected={globeTarget} onSelect={select} reducedMotion={reducedMotion || !rotate} /></Suspense></GlobeBoundary>
            <div className="globe-bottom"><div><span className="coordinates">{Math.abs(selected.lat).toFixed(2)}° {selected.lat >= 0 ? 'N' : 'S'} &nbsp; {Math.abs(selected.lng).toFixed(2)}° {selected.lng >= 0 ? 'E' : 'W'}</span><span className="globe-hint">Drag to wander. Pick a point to stay a while.</span></div><button className="globe-control" aria-label={rotate ? 'Pause globe rotation' : 'Resume globe rotation'} onClick={() => setRotate(value => !value)}>{rotate ? <Pause size={13} /> : <Play size={13} />}</button></div>
          </div>

          <aside className="detail-card" aria-label={`Selected place: ${selected.place}`}><div className="detail-image-wrap"><CameraImage key={selected.id} camera={selected} className="detail-image" refresh /><span className="image-category">{selected.category}</span><button className={`image-save ${selectedSaved ? 'is-saved' : ''}`} aria-label={selectedSaved ? 'Unsave place' : 'Save place'} disabled={!session || pendingAction} onClick={() => void favorite()}><Heart size={17} fill={selectedSaved ? 'currentColor' : 'none'} /></button></div>
            <div className="detail-body"><p className="detail-location">{selected.flag} {selected.place}<span><Clock3 size={12} /><LocalTime camera={selected} /></span></p><h2>{selected.name}</h2><p className="detail-description">{selected.description}</p>
              <div className="weather-strip">{weather ? <><span>{weather.isDay ? <Sun size={17} /> : <Moon size={17} />}{Math.round(weather.temperature)}<small>°C</small></span><span><Wind size={15} />{Math.round(weather.windSpeed)}<small>km/h</small></span><span><CloudRain size={15} />{weather.precipitation}<small>mm</small></span></> : <span className="weather-unavailable">{weatherError ? 'Local weather is taking a break.' : 'Checking the local weather…'}</span>}</div>
              <button className="button primary full" onClick={() => setModal('rule')} disabled={!session}><Bell size={16} />Keep an eye on this place<ArrowRight size={16} /></button><div className="detail-actions"><a className="source-link" href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">{selected.imageUrl ? 'View original webcam' : `Watch on ${selected.provider.split(' / ')[0]}`}<ArrowUpRight size={14} /></a><button className="icon-button" onClick={() => void share()} aria-label="Share this place"><Share2 size={15} /></button></div>
              <div className="source-credit"><ShieldCheck size={12} /><span>{selected.imageUrl ? `${selected.provider} · periodic image` : `${selected.provider} · opens at source`}</span></div>{weather && <p className="weather-credit">Location weather: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> · updated {new Date(weather.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
            </div>
          </aside>
        </section>
        <div className="explorer-bottom"><span><span className="status-dot" /> REAL PLACES. PUBLIC WINDOWS.</span><p>The world is a little bigger than your feed.</p><button onClick={() => setModal('about')}>A note on our sources <ArrowUpRight size={13} /></button></div>
      </>}

      <section className="below-fold"><div className="below-heading"><p className="eyebrow">STAY CURIOUS. WANDER A LITTLE.</p><h2>A whole world.<br /><em>A few good ways to see it.</em></h2></div><button className="discovery-card" onClick={() => { setTab('explore'); setCategory('Nature'); setQuery(''); document.querySelector('.explorer-toolbar')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' }); }}><Mountain size={27} strokeWidth={1.2} /><span>Find your quiet.</span><p>Trade the scroll for mountains,<br />coastlines, and a little fresh air.</p><ArrowUpRight size={18} /></button><button className="discovery-card" onClick={() => setModal('rule')} disabled={!session}><Sunrise size={27} strokeWidth={1.2} /><span>Catch the next moment.</span><p>Rain rolling in. A sunrise ahead.<br />Get a little heads-up.</p><ArrowUpRight size={18} /></button><a className="discovery-card" href="https://github.com/sreyasts/glim/issues/new?template=camera.yml" target="_blank" rel="noopener noreferrer"><Globe2 size={27} strokeWidth={1.2} /><span>Open another window.</span><p>Know a great public webcam?<br />Help make the world a little closer.</p><ArrowUpRight size={18} /></a></section>
    </main>

    <footer><a className="logo" href="/">glim<span className="logo-period">.</span></a><p>Less scrolling. More world.</p><div><button onClick={() => setModal('about')}>About & sources</button><button onClick={() => setModal('privacy')}>Your privacy</button><a href="https://github.com/sreyasts/glim" target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight size={12} /></a><span>Made for the curious.</span></div></footer>
    {toast && <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setToast('')}><X size={14} /></button></div>}
    {modal === 'rule' && <RuleForm camera={selected} onClose={() => setModal(null)} onCreated={async () => { await loadSession(); setToast('Alert saved. We’ll check the location’s weather every 5 minutes.'); }} />}
    {modal === 'about' && <Modal title="A world worth looking at." onClose={() => setModal(null)}><div className="prose"><p>Glim brings intentionally public webcams into a small, human directory. No exposed private cameras, face recognition, identity tracking, or scanning for devices.</p><h3>A clear window, a clear source.</h3><p>Selected NPS and USGS images appear with their source and public-domain policy. Other operators retain their rights: those views open on the original website. A listed source is not a promise that a camera is currently online.</p><h3>What’s happening, honestly.</h3><p>Inline views are periodically refreshed images, not continuous video. A successful image load does not prove that the source image is fresh. Weather alerts use Open-Meteo location data and sunrise predictions, not computer vision. Glim cannot currently detect arbitrary activity in a camera.</p><p>Globe geography: Natural Earth / world-atlas. Weather: <a href="https://open-meteo.com/en/terms" target="_blank" rel="noopener noreferrer">Open-Meteo, CC BY 4.0</a>. Camera sources checked {cameras[0].verifiedOn}.</p><a className="button primary" href="https://github.com/sreyasts/glim/blob/main/docs/SOURCES.md" target="_blank" rel="noopener noreferrer">Read the source register <ExternalLink size={14} /></a></div></Modal>}
    {modal === 'privacy' && <Modal title="A window, not a watchtower." onClose={() => setModal(null)}><div className="prose"><p>No account, ad trackers, or personal location permission. Glim uses a random, HTTP-only session cookie to save your places and alerts for 30 days in this browser. It does not sync across devices.</p><p>The server stores your favorite camera IDs, alert conditions, the last 30 days of triggered alerts, and your push subscription if you enable it. No video or camera images are recorded.</p><p>Loading a source image contacts its operator directly, revealing your IP address to that operator. Opening a provider’s website uses their privacy policy. Open-Meteo receives camera coordinates, not your device coordinates.</p><button className="button danger full" disabled={busy || !session} onClick={async () => {
      setBusy(true);
      try {
        await api('/session', { method: 'DELETE' });
        setSession(null);
        const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/') : undefined;
        await (await registration?.pushManager.getSubscription())?.unsubscribe();
        await loadSession(); setModal(null); setToast('Your saved places, rules, inbox, and push subscription were removed.');
      } catch (error) { setToast((error as Error).message); }
      finally { setBusy(false); }
    }}><Trash2 size={16} />Delete my Glim data</button><p className="fine-print">This immediately removes all data for this browser session.</p></div></Modal>}
  </>;
}
