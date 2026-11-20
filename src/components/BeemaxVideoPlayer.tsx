import React, { useEffect, useRef, useState } from 'react';

/** Plays an operator-supplied HTTPS video or HLS stream, without proxying it. */
export default function BeemaxVideoPlayer({ url }: { url: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('Enter a direct HTTPS video or HLS stream URL.');
  useEffect(() => {
    const element = video.current;
    if (!element || !url) { setStatus('Enter a direct HTTPS video or HLS stream URL.'); return; }
    let cancelled = false;
    let player: { destroy(): void } | undefined;
    const error = () => setStatus('Video could not be played. Check the URL, format and source permissions.');
    element.addEventListener('error', error);
    const start = async () => {
      const isHls = /\.m3u8$/i.test(new URL(url).pathname);
      if (!isHls || element.canPlayType('application/vnd.apple.mpegurl')) {
        element.src = url;
        setStatus('Video attached. Press play.');
        return;
      }
      try {
        setStatus('Loading HLS player…');
        const { default: Hls } = await import('hls.js');
        if (cancelled) return;
        if (!Hls.isSupported()) { setStatus('HLS playback is unavailable in this browser.'); return; }
        const hls = new Hls(); player = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!cancelled) setStatus('Stream ready. Press play.'); });
        hls.on(Hls.Events.ERROR, (_event, data) => { if (!cancelled && data.fatal) setStatus('Stream could not be played. Check the URL and source permissions.'); });
        hls.loadSource(url); hls.attachMedia(element);
        setStatus('Loading stream…');
      } catch { if (!cancelled) setStatus('HLS player could not be loaded.'); }
    };
    void start();
    return () => { cancelled = true; player?.destroy(); element.removeEventListener('error', error); element.pause(); element.removeAttribute('src'); element.load(); };
  }, [url]);
  return <><video ref={video} controls playsInline width={480} height={270} aria-label="BEEMAX video player" /><p role="status">{status}</p></>;
}
