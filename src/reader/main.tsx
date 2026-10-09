import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { makeBook } from "foliate-js/view.js";
import { legacyTextPosition, makeTextBook } from "./text-book.mjs";
import type { ReadingTextDocument } from "../types";
import "./reader.css";

type Toc = { label: string; href: string; subitems?: Toc[] };
type View = HTMLElement & {
  book: any;
  renderer: HTMLElement & { setStyles: (css: string) => void; goTo: (target: { index: number; anchor: (doc: Document) => Range }) => Promise<void> };
  open: (book: any) => Promise<void>;
  init: (options: { lastLocation?: string; showTextStart?: boolean }) => Promise<void>;
  goTo: (target: string | number) => Promise<void>;
  prev: () => Promise<void>;
  next: () => Promise<void>;
  close: () => void;
};
const send = (type: string, data: Record<string, unknown> = {}) => parent.postMessage({ channel: "reverie-reader", type, ...data }, "*");
const flatten = (toc: Toc[], depth = 0): Array<Toc & { depth: number }> => toc.flatMap(entry => [{ ...entry, depth }, ...flatten(entry.subitems || [], depth + 1)]);

function Reader() {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View | null>(null);
  const closeRef = useRef<() => void>(() => send("close"));
  const [title, setTitle] = useState("小说阅读器");
  const [toc, setToc] = useState<Array<Toc & { depth: number }>>([]);
  const [chapter, setChapter] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("正在加载阅读引擎…");
  const [tocOpen, setTocOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("reverie-novel-settings") || "{}");
      return { fontSize: Math.max(14, Math.min(32, Number(saved.fontSize) || 20)), lineHeight: Math.max(1.4, Math.min(2.6, Number(saved.lineHeight) || 1.9)), flow: saved.flow === "scrolled" ? "scrolled" : "paginated" };
    } catch { return { fontSize: 20, lineHeight: 1.9, flow: "paginated" }; }
  });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const applySettings = () => {
    const renderer = viewRef.current?.renderer;
    if (!renderer) return;
    const current = settingsRef.current;
    renderer.setAttribute("flow", current.flow);
    renderer.setAttribute("margin", "24px");
    renderer.setAttribute("gap", "6%");
    renderer.setAttribute("max-inline-size", "820px");
    renderer.setAttribute("max-column-count", "1");
    renderer.setStyles(`html { color: #e8edf3 !important; background: #14202c !important; color-scheme: dark; }
      body { font-family: "Microsoft YaHei", "Noto Serif SC", serif !important; font-size: ${current.fontSize}px !important; line-height: ${current.lineHeight} !important; padding: 12px !important; }
      p { line-height: ${current.lineHeight} !important; overflow-wrap: anywhere; } img, svg { max-width: 100% !important; object-fit: contain; } a { color: #9ad3ff; }`);
  };
  useEffect(() => {
    applySettings();
    try { localStorage.setItem("reverie-novel-settings", JSON.stringify(settings)); } catch { /* Reading works without storage. */ }
  }, [settings]);

  useEffect(() => {
    let disposed = false;
    let opened = false;
    let book: any;
    const abort = new AbortController();
    const view = document.createElement("foliate-view") as View;
    viewRef.current = view;
    host.current!.append(view);
    let lastProgress: { location: string; chapter: string } | undefined;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      clearTimeout(saveTimer);
      if (lastProgress) send("progress", lastProgress);
      lastProgress = undefined;
    };
    closeRef.current = () => { flush(); send("close"); };
    const navigate = (action: () => Promise<void>) => void action().catch(error => setStatus(`无法跳转：${error.message}`));
    const keyboard = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("input, select, textarea, button, [contenteditable=true]")) return;
      if (event.key === "Escape") { flush(); send("close"); }
      if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); navigate(() => view.prev()); }
      if (["ArrowRight", "PageDown", " "].includes(event.key)) { event.preventDefault(); navigate(() => event.shiftKey ? view.prev() : view.next()); }
    };
    window.addEventListener("keydown", keyboard);
    view.addEventListener("load", (event: Event) => {
      const doc = (event as CustomEvent).detail.doc as Document;
      doc.addEventListener("keydown", keyboard);
    });
    view.addEventListener("external-link", event => event.preventDefault());
    view.addEventListener("relocate", (event: Event) => {
      const location = (event as CustomEvent).detail;
      const label = location.tocItem?.label || "正文";
      setChapter(label);
      setProgress(Math.round((location.fraction || 0) * 100));
      if (typeof location.cfi === "string") {
        lastProgress = { location: location.cfi, chapter: label };
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flush, 250);
      }
    });
    const handle = async (event: MessageEvent) => {
      if (event.source !== parent || event.data?.channel !== "reverie-reader") return;
      if (event.data.type === "flush") { flush(); send("close"); return; }
      if (event.data.type !== "open" || opened) return;
      opened = true;
      try {
        const document = event.data.document as ReadingTextDocument;
        setTitle(document.title);
        setStatus("正在打开小说…");
        if (document.resourceUrl) {
          const response = await fetch(document.resourceUrl, { signal: abort.signal });
          if (!response.ok) throw new Error(`读取失败 (${response.status})`);
          book = await makeBook(new File([await response.blob()], document.fileName || "book.epub"));
        } else book = makeTextBook(document);
        if (disposed) { book?.destroy?.(); return; }
        // CSP blocks book scripts; remove active markup as defense in depth.
        book.transformTarget?.addEventListener("data", (event: CustomEvent) => {
          const detail = event.detail;
          if (!/html|xml|svg/.test(detail.type)) return;
          detail.data = Promise.resolve(detail.data).then(async (data: string | Blob) => {
            const text = typeof data === "string" ? data : await data.text();
            const mime = ["application/xhtml+xml", "image/svg+xml", "application/xml"].includes(detail.type) ? detail.type : "text/html";
            const doc = new DOMParser().parseFromString(text, mime);
            doc.querySelectorAll("script, iframe, object, embed, base, form, meta[http-equiv]").forEach(node => node.remove());
            doc.querySelectorAll("*").forEach(node => {
              for (const attribute of Array.from(node.attributes)) {
                if (/^on/i.test(attribute.name) || /^\s*javascript:/i.test(attribute.value)) node.removeAttribute(attribute.name);
              }
            });
            return new XMLSerializer().serializeToString(doc);
          });
        });
        await view.open(book);
        if (disposed) return;
        applySettings();
        const entries = flatten(book.toc || []);
        setToc(entries);
        try {
          if (event.data.location) await view.init({ lastLocation: event.data.location });
          else if (!document.resourceUrl && Number.isInteger(event.data.legacyPage)) {
            const position = legacyTextPosition(document, event.data.legacyPage);
            await view.renderer.goTo({ index: position.index, anchor: doc => {
              const paragraph = doc.querySelectorAll("p")[position.paragraph];
              const range = doc.createRange();
              if (paragraph?.firstChild) range.setStart(paragraph.firstChild, Math.min(position.offset, paragraph.firstChild.textContent?.length || 0));
              else range.selectNodeContents(doc.body);
              range.collapse(true);
              return range;
            } });
          }
          else {
            const previous = entries.find(entry => entry.label === event.data.chapter);
            if (previous) await view.goTo(previous.href); else await view.init({ showTextStart: true });
          }
        } catch { await view.init({ showTextStart: true }); }
        if (!disposed) setStatus("");
      } catch (error) {
        if (!disposed) setStatus(`无法打开小说：${error instanceof Error ? error.message : String(error)}。加密或损坏的电子书不受支持。`);
      }
    };
    window.addEventListener("message", handle);
    window.addEventListener("pagehide", flush);
    send("ready");
    return () => {
      disposed = true;
      abort.abort();
      flush();
      window.removeEventListener("message", handle);
      window.removeEventListener("keydown", keyboard);
      window.removeEventListener("pagehide", flush);
      view.close(); view.remove(); book?.destroy?.();
    };
  }, []);

  const close = () => closeRef.current();
  return <main>
    <header>
      <button onClick={close}>退出阅读</button>
      <button onClick={() => setTocOpen(value => !value)} aria-expanded={tocOpen}>章节目录</button>
      <strong title={title}>{title}</strong>
      <label>字号 <select aria-label="字号" value={settings.fontSize} onChange={e => setSettings({ ...settings, fontSize: Number(e.target.value) })}>{[14,16,18,20,22,24,28,32].map(size => <option key={size}>{size}</option>)}</select></label>
      <label>行距 <select aria-label="行距" value={settings.lineHeight} onChange={e => setSettings({ ...settings, lineHeight: Number(e.target.value) })}>{[1.4,1.6,1.9,2.2,2.6].map(value => <option key={value}>{value}</option>)}</select></label>
      <select aria-label="阅读方式" value={settings.flow} onChange={e => setSettings({ ...settings, flow: e.target.value })}><option value="paginated">自适应翻页</option><option value="scrolled">章节内滚动</option></select>
    </header>
    {tocOpen && <aside aria-label="章节目录">{toc.map((entry, index) => <button key={index} style={{ paddingLeft: 12 + entry.depth * 14 }} onClick={() => { void viewRef.current?.goTo(entry.href); setTocOpen(false); }}>{entry.label}</button>)}</aside>}
    <div className="book-host" ref={host} />
    {status && <div className="reader-status" role="status">{status}</div>}
    <footer><button onClick={() => void viewRef.current?.prev()}>上一页</button><span>{chapter} · {progress}%</span><button onClick={() => void viewRef.current?.next()}>下一页</button></footer>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Reader />);
