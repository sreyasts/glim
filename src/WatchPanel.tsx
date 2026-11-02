import { useState } from 'react';
import { ArrowRight, Bell, Check, Pause, Play, Trash2, X } from 'lucide-react';
import { ruleLabels, type Camera, type RuleKind, type Session } from '../shared/types';
import { api } from './api';

export function WatchEditor({ camera, onDone, onCancel }: { camera: Camera; onDone: () => Promise<void>; onCancel: () => void }) {
  const [kind, setKind] = useState<RuleKind>('rain');
  const [threshold, setThreshold] = useState(25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form className="watch-editor" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/rules', { method: 'POST', body: JSON.stringify({ cameraId: camera.id, kind, threshold: kind === 'wind' ? threshold : 0 }) }); await onDone(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }}><div className="pane-title"><h3>Watch this location</h3><button type="button" className="icon-btn" aria-label="Close alert editor" onClick={onCancel}><X size={17} /></button></div>
    <label>Condition<select value={kind} onChange={event => setKind(event.target.value as RuleKind)}>{(Object.keys(ruleLabels) as RuleKind[]).map(value => <option key={value} value={value}>{ruleLabels[value]}</option>)}</select></label>
    {kind === 'wind' && <label>Wind speed, km/h<input type="number" min={1} max={200} value={threshold} onChange={event => setThreshold(Number(event.target.value))} required /></label>}
    <p>Uses location weather, not video analysis. Checked every 5 minutes. Sunrise and sunset alerts cover the preceding 15 minutes.</p>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <button className="action-btn primary" disabled={busy}><Bell size={16} />{busy ? 'Saving…' : 'Create weather alert'}<ArrowRight size={15} /></button>
  </form>;
}

export default function WatchPanel({ session, names, onReload, onCamera, onPush, busyPush, onError }: {
  session: Session | null; names: Map<string, Camera>; onReload: () => Promise<void>; onCamera: (id: string) => void;
  onPush: () => Promise<void>; busyPush: boolean; onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState('');
  const change = async (id: string, enabled?: boolean) => {
    setBusy(id);
    try { await api(`/rules/${encodeURIComponent(id)}`, { method: enabled === undefined ? 'DELETE' : 'PATCH', ...(enabled === undefined ? {} : { body: JSON.stringify({ enabled }) }) }); await onReload(); }
    catch (error) { onError((error as Error).message); }
    finally { setBusy(''); }
  };
  return <div className="watch-panel"><div className="sidebar-heading"><h1>Weather watches</h1><p>Conditions at the places you follow.</p></div>
    <section className="push-settings"><h2>Browser notifications</h2><p>{session?.pushKey ? 'Receive alerts when this tab is closed.' : 'The server needs VAPID keys to enable background delivery. Alerts still appear below.'}</p><button className="action-btn" disabled={!session?.pushKey || busyPush} onClick={() => void onPush()}>{session?.pushEnabled ? <Check size={15} /> : <Bell size={15} />}{session?.pushEnabled ? 'Disable notifications' : 'Enable notifications'}</button></section>
    <div className="list-heading"><h2>Active rules</h2><span>{session?.rules.length ?? 0}</span></div>
    {!session ? <p className="empty-copy">Connecting to your saved session…</p> : !session.rules.length ? <div className="empty-copy"><Bell size={24} /><h3>No watches yet</h3><p>Select a camera, then choose “Watch location” to create a condition alert.</p></div> : session.rules.map(rule => <article className="watch-row" key={rule.id}><div><h3>{ruleLabels[rule.kind]}{rule.kind === 'wind' ? ` · ${rule.threshold} km/h` : ''}</h3><button className="inline-link" onClick={() => onCamera(rule.cameraId)}>{names.get(rule.cameraId)?.place ?? rule.cameraId}</button><p>{rule.enabled ? 'Checking every 5 min' : 'Paused'}</p></div><button className="icon-btn" aria-label={rule.enabled ? 'Pause alert' : 'Resume alert'} disabled={busy === rule.id} onClick={() => void change(rule.id, !rule.enabled)}>{rule.enabled ? <Pause size={16} /> : <Play size={16} />}</button><button className="icon-btn" aria-label="Delete alert" disabled={busy === rule.id} onClick={() => void change(rule.id)}><Trash2 size={16} /></button></article>)}
    <div className="list-heading"><h2>Inbox</h2><span>{session?.events.length ?? 0}</span></div>{session?.events.length ? session.events.map(event => <article className="inbox-row" key={event.id}><h3>{event.title}</h3><p>{event.body}</p><time>{new Date(event.createdAt).toLocaleString()}</time></article>) : <p className="empty-copy">Triggered conditions will appear here. No alerts have been triggered.</p>}
  </div>;
}
