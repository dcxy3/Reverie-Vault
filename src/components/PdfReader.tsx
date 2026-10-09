import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus } from "lucide-react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { EventBus, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";

GlobalWorkerOptions.workerSrc = workerUrl;

export function PdfReader({ url, initialPage, initialOffset = 0, onProgress, onPreviousChapter, onNextChapter }: {
  url: string;
  initialPage: number;
  initialOffset?: number;
  onProgress: (page: number, offset: number) => void;
  onPreviousChapter: () => void;
  onNextChapter: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PDFViewer | null>(null);
  const fitRef = useRef<(zoom?: number) => void>(() => {});
  const zoomRef = useRef(1);
  const callbacks = useRef({ onProgress, onPreviousChapter, onNextChapter });
  callbacks.current = { onProgress, onPreviousChapter, onNextChapter };
  const [page, setPage] = useState(initialPage + 1);
  const [count, setCount] = useState(0);
  const [scale, setScale] = useState(100);
  const [status, setStatus] = useState("正在读取 PDF…");

  useEffect(() => {
    const container = containerRef.current!;
    const eventBus = new EventBus();
    const viewer = new PDFViewer({ container, viewer: pagesRef.current!, eventBus,
      textLayerMode: 0, annotationMode: 0, removePageBorders: true,
      maxCanvasPixels: 12 * 1024 * 1024 });
    viewerRef.current = viewer;
    let disposed = false;
    let ready = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: { page: number; offset: number } | undefined;
    const flush = () => {
      clearTimeout(timer);
      timer = undefined;
      if (pending) callbacks.current.onProgress(pending.page, pending.offset);
      pending = undefined;
    };
    // Store a page-relative fraction, independent of canvas resolution/window size.
    const collectPosition = () => {
      if (!ready || disposed) return;
      let index = 0, high = viewer.pagesCount - 1;
      while (index < high) {
        const middle = Math.floor((index + high) / 2);
        const page = viewer.getPageView(middle).div;
        if (page.offsetTop + page.clientHeight <= container.scrollTop + 1) index = middle + 1;
        else high = middle;
      }
      const element = viewer.getPageView(index)?.div;
      if (!element) return;
      const offset = Math.max(0, Math.min(1, (container.scrollTop - element.offsetTop) / element.clientHeight));
      setPage(index + 1);
      pending = { page: index, offset };
      if (timer === undefined) timer = setTimeout(flush, 250);
    };
    const fitWidth = () => {
      if (disposed || !viewer.pagesCount) return;
      const index = Math.max(0, Math.min(viewer.currentPageNumber - 1, viewer.pagesCount - 1));
      const element = viewer.getPageView(index).div;
      const fraction = Math.max(0, (container.scrollTop - element.offsetTop) / Math.max(1, element.clientHeight));
      // Normalize each page separately: scans may have different resolutions or
      // landscape spreads. PDF.js still owns rendering, caching and cancellation.
      for (let i = 0; i < viewer.pagesCount; i++) {
        const page = viewer.getPageView(i);
        const baseWidth = page.viewport.width / page.scale;
        const targetScale = Math.max(.1, (container.clientWidth - 2) / baseWidth) * zoomRef.current;
        if (Math.abs(page.scale - targetScale) > .0001) page.update({ scale: targetScale });
        page.div.style.setProperty("--scale-factor", String(page.viewport.scale));
      }
      if (zoomRef.current === 1) container.scrollLeft = 0;
      container.scrollTop = element.offsetTop + element.clientHeight * fraction;
      viewer.update();
      setScale(Math.round(zoomRef.current * 100));
    };
    fitRef.current = (zoom = 1) => { zoomRef.current = zoom; fitWidth(); };
    eventBus.on("updateviewarea", collectPosition);
    container.addEventListener("scroll", collectPosition, { passive: true });
    window.addEventListener("pagehide", flush);
    eventBus.on("scalechanging", ({ scale: value }: { scale: number }) => setScale(Math.round(value * 100)));
    eventBus.on("pagesinit", () => {
      if (disposed) return;
      viewer.currentScaleValue = "page-width";
      const index = Math.max(0, Math.min(initialPage, viewer.pagesCount - 1));
      viewer.currentPageNumber = index + 1;
      const element = viewer.getPageView(index).div;
      container.scrollTop = element.offsetTop + element.clientHeight * initialOffset;
      ready = true;
      setPage(index + 1);
      setStatus("");
      void viewer.pagesPromise.then(() => { if (!disposed) fitWidth(); });
    });
    eventBus.on("pagerendered", ({ error }: { error?: Error }) => {
      if (error && !disposed) setStatus(`页面渲染失败：${error.message}`);
    });
    const task = getDocument({ url, rangeChunkSize: 128 * 1024, isEvalSupported: false });
    task.promise.then(document => {
      if (disposed) return;
      setCount(document.numPages);
      viewer.setDocument(document);
    }).catch(error => { if (!disposed) setStatus(`无法读取 PDF：${error.message}`); });
    const observer = new ResizeObserver(() => {
      if (ready) fitWidth();
    });
    observer.observe(container);
    return () => {
      collectPosition();
      flush();
      disposed = true;
      observer.disconnect();
      container.removeEventListener("scroll", collectPosition);
      window.removeEventListener("pagehide", flush);
      viewerRef.current = null;
      viewer.setDocument(null!);
      void task.destroy();
    };
  }, [url]);

  const move = (delta: number) => {
    const viewer = viewerRef.current;
    if (!viewer?.pagesCount) return;
    const next = viewer.currentPageNumber + delta;
    if (next < 1) callbacks.current.onPreviousChapter();
    else if (next > viewer.pagesCount) callbacks.current.onNextChapter();
    else viewer.currentPageNumber = next;
  };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("input, select, textarea, [contenteditable=true]")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1);
      } else if (["PageUp", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        const container = containerRef.current!;
        container.scrollBy({ top: container.clientHeight * .8 * (event.key === "PageUp" || event.shiftKey ? -1 : 1), behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  return <div className="manga-page-viewport">
    <div className="pdf-reader-container" ref={containerRef}><div className="pdfViewer" ref={pagesRef} /></div>
    {status && <div className="manga-page-status" role="status">{status}</div>}
    <nav className="manga-reader-controls" aria-label="漫画阅读控制">
      <button aria-label="上一页" onClick={() => move(-1)} disabled={!count}><ChevronLeft size={18} /></button>
      <span>连续阅读 · 第 {page} / {count || "…"} 页</span>
      <button aria-label="下一页" onClick={() => move(1)} disabled={!count}><ChevronRight size={18} /></button>
      <i />
      <button aria-label="缩小" onClick={() => fitRef.current(Math.max(.5, zoomRef.current - .1))}><Minus size={16} /></button>
      <span>{scale}%</span>
      <button aria-label="放大" onClick={() => fitRef.current(Math.min(2, zoomRef.current + .1))}><Plus size={16} /></button>
      <button aria-label="适应宽度" title="适应宽度（包括横向跨页）" onClick={() => fitRef.current()}><Maximize2 size={16} /></button>
    </nav>
  </div>;
}
