import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Maximize2, Play, RefreshCw, VideoOff } from 'lucide-react';
import type { Camera } from '../shared/types';

export function formatLabel(camera: Camera): string {
  if (!camera.media) return camera.imageUrl ? 'Updating image' : 'Source website';
  if (camera.media.kind === 'mp4') return 'Updated clip';
  if (camera.media.kind === 'youtube' && !camera.media.live) return 'Recorded video';
  if (camera.media.kind === 'embed' && !camera.media.live) return 'Timelapse';
  if (camera.media.kind === 'embed') return 'Operator live player';
  return 'Live stream';
}

export default function CameraPlayer({ camera, onState, onNext }: { camera: Camera; onState?: (state: string) => void; onNext?: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Connecting');
  const [failure, setFailure] = useState('');
  const [retry, setRetry] = useState(0);
  const [imageMode, setImageMode] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [embedStarted, setEmbedStarted] = useState(true);
  const media = imageMode ? undefined : camera.media;
  useEffect(() => { setImageMode(false); setImageVersion(0); setImageLoaded(false); setEmbedStarted(true); }, [camera.id]);
  useEffect(() => { onState?.(status); }, [status, onState]);
  useEffect(() => {
    setStatus(media?.kind === 'youtube' || media?.kind === 'embed' ? 'Ready to play' : 'Connecting'); setFailure('');
    if (media?.kind !== 'hls' || !video.current) return;
    const element = video.current;
    let cleanup = () => {};
    let disposed = false;
    let started = false;
    const playing = () => { started = true; };
    element.addEventListener('playing', playing);
    const connectionTimeout = setTimeout(() => {
      if (!started && !disposed) { setStatus('Unavailable'); setFailure('The source did not start within 25 seconds. Retry, use its image, or choose another camera.'); }
    }, 25000);
    const source = `/api/stream/${encodeURIComponent(camera.id)}`;
    void import('hls.js').then(({ default: Hls }) => {
      if (disposed) return;
      if (!Hls.isSupported()) {
        if (element.canPlayType('application/vnd.apple.mpegurl')) {
          element.src = source;
          const start = () => { void element.play().catch(() => setStatus('Press play to start')); };
          element.addEventListener('loadedmetadata', start, { once: true });
          cleanup = () => element.removeEventListener('loadedmetadata', start);
        } else { setFailure('This browser cannot play the operator’s live stream.'); setStatus('Unavailable'); }
        return;
      }
      const player = new Hls({ maxBufferLength: 12, maxMaxBufferLength: 24, enableWorker: true, manifestLoadingMaxRetry: 1, levelLoadingMaxRetry: 1, fragLoadingMaxRetry: 1 });
      player.loadSource(source); player.attachMedia(element);
      player.on(Hls.Events.MANIFEST_PARSED, () => {
        void element.play().catch(() => setStatus('Press play to start'));
      });
      player.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) { setFailure('The operator’s stream did not connect. Try the camera image or another nearby camera.'); setStatus('Unavailable'); }
      });
      cleanup = () => player.destroy();
    }).catch(() => setFailure('The video player could not load. Retry the stream.'));
    return () => { disposed = true; clearTimeout(connectionTimeout); element.removeEventListener('playing', playing); cleanup(); element.pause(); element.removeAttribute('src'); element.load(); };
  }, [camera.id, media?.kind, media?.url, retry]);
  useEffect(() => {
    if (media || !camera.imageUrl) return;
    const timer = setInterval(() => { setImageLoaded(false); setImageVersion(value => value + 1); }, Math.max(5, camera.refreshSeconds ?? 300) * 1000);
    return () => clearInterval(timer);
  }, [camera.id, camera.imageUrl, camera.refreshSeconds, media]);
  useEffect(() => {
    if (media?.kind !== 'mp4') return;
    const timer = setInterval(() => setImageVersion(value => value + 1), 60000);
    return () => clearInterval(timer);
  }, [media?.kind, camera.id]);
  let embedUrl = media?.url;
  if (media?.kind === 'youtube') {
    const url = new URL(media.url); url.searchParams.set('autoplay', '1'); url.searchParams.set('mute', '1'); url.searchParams.set('playsinline', '1'); url.searchParams.set('rel', '0'); url.searchParams.set('origin', location.origin); embedUrl = url.href;
  }
  const retryPlayer = () => { setFailure(''); setImageLoaded(false); setRetry(value => value + 1); setImageVersion(value => value + 1); };
  return <div className="player-shell" ref={shell}>
    <div className="player-visual">
      {media?.kind === 'hls' || media?.kind === 'mp4' ? <video ref={video} key={`${camera.id}-${media.kind}-${retry}`} src={media.kind === 'mp4' ? `${media.url}${media.url.includes('?') ? '&' : '?'}glim=${imageVersion}` : undefined}
        controls autoPlay muted playsInline loop={media.kind === 'mp4'} poster={camera.imageUrl} onPlaying={() => { setStatus(media.live ? 'Playing live' : 'Playing updated clip'); setFailure(''); }} onWaiting={() => setStatus('Buffering')} onError={() => { setFailure('The source video is unavailable. Retry or use the source image.'); setStatus('Unavailable'); }} />
        : media?.kind === 'youtube' || media?.kind === 'embed' ? embedStarted ? <iframe key={`${camera.id}-${retry}`} src={embedUrl} title={`${camera.name} · ${camera.provider}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setStatus('Operator player opened')} />
          : <button className="embed-start" onClick={() => setEmbedStarted(true)}>{camera.imageUrl || camera.posterUrl ? <img src={camera.imageUrl ?? camera.posterUrl} alt={`${camera.name} preview`} /> : null}<span><Play size={28} fill="currentColor" /><strong>Watch camera</strong><small>Loads {camera.provider}’s player</small></span></button>
        : camera.imageUrl ? <img className="source-image" key={`${camera.id}-${retry}-${imageVersion}`} src={`${camera.imageUrl}${camera.imageUrl.includes('?') ? '&' : '?'}glim=${imageVersion}`} alt={`${camera.name} camera image`} onLoad={() => { setImageLoaded(true); setStatus('Image received'); setFailure(''); }} onError={() => { setFailure('The source image could not load. Try again or choose a nearby camera.'); setStatus('Unavailable'); }} />
        : <div className="player-no-feed"><VideoOff size={30} /><strong>This operator hosts its own player</strong><p>No supported in-page feed has been provided for this camera.</p><a href={camera.sourceUrl} target="_blank" rel="noopener noreferrer">Open the original camera <ExternalLink size={15} /></a></div>}
      {failure && <div className="player-failure" role="alert"><VideoOff size={26} /><strong>Camera unavailable</strong><p>{failure}</p><div><button onClick={retryPlayer}><RefreshCw size={15} />Retry</button>{camera.imageUrl && !imageMode && <button onClick={() => { setImageMode(true); setFailure(''); }}>Use camera image</button>}{onNext && <button onClick={onNext}>Try nearby live camera</button>}</div></div>}
    </div>
    <div className="player-status"><span><i className={status === 'Playing live' ? 'signal live' : 'signal'} />{status}</span><div><button aria-label="Refresh camera" onClick={retryPlayer}><RefreshCw size={14} /></button><button aria-label="View camera fullscreen" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void shell.current?.requestFullscreen(); }}><Maximize2 size={15} /></button></div></div>
    {!media && camera.imageUrl && <p className="capture-note">{imageLoaded ? `Image received · refreshes every ${camera.refreshSeconds ?? 300}s` : 'Loading camera image…'} · capture time is set by the source.</p>}
    {media?.kind === 'mp4' && <p className="capture-note">Short operator clip, refreshed every minute. Looping is not continuous live video.</p>}
    {media?.kind === 'embed' && media.live && <p className="capture-note">Playback is managed by the operator inside this frame. If it stays blank or frozen, try Original camera. Opening a player does not confirm live footage.</p>}
  </div>;
}
