import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import vaultIcon from "../assets/reverie-vault-icon.png";
import "./startup.css";

export function StartupExperience({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"playing" | "leaving" | "done">("playing");
  const [run, setRun] = useState(0);
  const skipRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const finish = useCallback(() => setPhase("done"), []);

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    skipRef.current?.focus({ preventScroll: true });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leave = window.setTimeout(() => setPhase(current => current === "playing" ? "leaving" : current), reduced.matches ? 450 : 2600);
    // Timers are independent of CSS animation events and asset/network loading.
    const end = window.setTimeout(finish, reduced.matches ? 600 : 3100);
    const onMotionChange = () => { if (reduced.matches) finish(); };
    reduced.addEventListener("change", onMotionChange);
    return () => {
      clearTimeout(leave); clearTimeout(end);
      reduced.removeEventListener("change", onMotionChange);
    };
  }, [run, finish]);

  useEffect(() => {
    if (phase === "done") {
      if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (!["Escape", "Enter", " "].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      finish();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase, finish]);

  return <>
    {/* Mount the library immediately; only interaction is gated by the intro. */}
    <div className="startup-app-content" inert={phase !== "done"}>{children}</div>
    {phase !== "done" && <div key={run} className={`startup-intro startup-${phase}`} role="dialog" aria-modal="true" aria-label="欢迎来到绮梦藏馆" onClick={finish}>
      <div className="startup-aura" aria-hidden="true" />
      <div className="startup-horizon" aria-hidden="true" />
      <div className="startup-trails" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--angle": `${index * 30}deg`, "--delay": `${(index % 4) * 70}ms` } as CSSProperties} />)}
      </div>
      <div className="startup-brand">
        <div className="startup-emblem">
          <span className="startup-ring" aria-hidden="true" />
          <span className="startup-ring startup-ring-inner" aria-hidden="true" />
          <img src={vaultIcon} alt="" draggable={false} width={156} height={156} />
        </div>
        <p className="startup-wordmark">REVERIE VAULT</p>
        <h1>绮梦藏馆</h1>
        <div className="startup-rule" aria-hidden="true"><span /></div>
        <p className="startup-caption">每一个故事，都值得珍藏</p>
      </div>
      <div className="startup-footer"><span>YOUR STORIES. YOUR WORLD.</span><button ref={skipRef} type="button" onClick={finish}>跳过 <kbd>Esc</kbd></button></div>
    </div>}
    {import.meta.env.DEV && phase === "done" && <button className="startup-replay" type="button" title="仅热调试显示，正式版隐藏" onClick={() => { setPhase("playing"); setRun(value => value + 1); }}>重播开场</button>}
  </>;
}
