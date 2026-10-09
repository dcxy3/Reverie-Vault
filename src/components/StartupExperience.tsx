import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import "./StartupExperience.css";

const SESSION_KEY = "reverie.startup.seen.v1";
function shouldPlay() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try { return sessionStorage.getItem(SESSION_KEY) !== "1"; } catch { return true; }
}

export function StartupExperience({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(shouldPlay);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const replay = () => { setRun(value => value + 1); setVisible(true); };
    window.addEventListener("reverie:replay-startup", replay);
    return () => window.removeEventListener("reverie:replay-startup", replay);
  }, []);
  const complete = useCallback(() => setVisible(false), []);
  return <>
    <div className="startup-app-content" inert={visible} aria-hidden={visible || undefined}>{children}</div>
    {visible && <StartupFilm key={run} onComplete={complete} />}
  </>;
}

function StartupFilm({ onComplete }: { onComplete: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [softLeaving, setSoftLeaving] = useState(false);
  const [still, setStill] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const video = useRef<HTMLVideoElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const exiting = useRef(false);
  const cinematicExit = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const finish = useCallback((duration = 520) => {
    // Explicit skipping must still work during the long cinematic crossfade.
    if (exiting.current && !(duration === 520 && cinematicExit.current)) return;
    clearTimeout(exitTimer.current);
    cinematicExit.current = duration !== 520;
    if (!cinematicExit.current) setSoftLeaving(false);
    exiting.current = true;
    setLeaving(true);
    if (duration === 520) video.current?.pause();
    exitTimer.current = setTimeout(onComplete, duration);
  }, [onComplete]);
  const fallback = useCallback(() => {
    if (exiting.current) return;
    setStill(true);
    if (!fallbackTimer.current) fallbackTimer.current = setTimeout(() => finish(), 1800);
  }, [finish]);

  useEffect(() => {
    let disposed = false;
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* Private/storage-disabled mode still plays. */ }
    const previous = document.activeElement as HTMLElement | null;
    skip.current?.focus({ preventScroll: true });
    // A hard deadline guarantees that codec, network or playback failures cannot
    // trap the user behind the intro. The library loads concurrently underneath.
    const deadline = setTimeout(() => finish(), 8000);
    const player = video.current;
    let frame = 0;
    let pushTimer: ReturnType<typeof setTimeout> | undefined;
    const watchFrame = (_now: number, metadata: VideoFrameCallbackMetadata) => {
      if (disposed || exiting.current || !player) return;
      // The pink eye window is fully visible at 3.93s in the supplied clip.
      // Keep the last moment moving slowly; a frozen frame plus a large zoom
      // feels like a collision. Reveal the library early during a shallow push.
      if (metadata.mediaTime >= 3.93) {
        player.playbackRate = 0.35;
        setPushing(true);
        pushTimer = setTimeout(() => {
          if (exiting.current) return;
          setSoftLeaving(true); finish(2220);
        }, 300);
      } else frame = player.requestVideoFrameCallback(watchFrame);
    };
    if (player) frame = player.requestVideoFrameCallback(watchFrame);
    if (player) void player.play().catch(() => { if (!disposed) fallback(); });
    else fallback();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        skip.current?.focus({ preventScroll: true });
        return;
      }
      if (!["Escape", " ", "Enter"].includes(event.key)) return;
      event.preventDefault(); event.stopImmediatePropagation(); finish();
    };
    window.addEventListener("keydown", keydown, true);
    return () => {
      disposed = true;
      clearTimeout(pushTimer);
      if (player) player.cancelVideoFrameCallback(frame);
      clearTimeout(deadline); clearTimeout(exitTimer.current); clearTimeout(fallbackTimer.current);
      fallbackTimer.current = undefined;
      window.removeEventListener("keydown", keydown, true);
      player?.pause();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [finish, fallback]);

  return <section className={`startup-film${leaving ? " is-leaving" : ""}${still ? " is-still" : ""}${pushing ? " is-pushing" : ""}${softLeaving ? " is-soft-exit" : ""}`}
    role="dialog" aria-modal="true" aria-label="绮梦藏馆开屏动画" onClick={() => finish()}>
    <div className="startup-film-art" aria-hidden="true">
      <img className="startup-film-poster" src="./startup/reverie-intro.jpg" alt="" />
      {!still && <video ref={video} className="startup-film-video" src="./startup/reverie-intro.webm"
        poster="./startup/reverie-intro.jpg" autoPlay muted playsInline preload="auto" disablePictureInPicture
        onEnded={() => { if (!pushing) finish(); }} onError={fallback} />}
    </div>
    <div className="startup-film-shade" aria-hidden="true" />
    <div className="startup-film-portal" aria-hidden="true" />
    <div className="startup-film-brand">
      <span className="startup-film-rule" aria-hidden="true" />
      <p className="startup-film-wordmark">REVERIE <span>VAULT</span></p>
      <h1>绮梦藏馆</h1>
      <p className="startup-film-caption">你的故事，即将继续</p>
    </div>
    <div className="startup-film-footer">
      <span className="startup-film-sequence" aria-hidden="true">A PLACE FOR YOUR STORIES</span>
      <button ref={skip} type="button" className="startup-film-skip" onClick={() => finish()}>跳过动画 <kbd>Esc</kbd></button>
    </div>
    <div className="startup-film-timeline" aria-hidden="true"><i /></div>
  </section>;
}
