import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ReadingMangaChapter } from "../types";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PageSize = { width: number; height: number };

function PdfCanvasPage({ document, index, width, onSize }: {
  document: PDFDocumentProxy;
  index: number;
  width: number;
  onSize: (index: number, size: PageSize) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [message, setMessage] = useState("正在加载…");

  useEffect(() => {
    let disposed = false;
    let renderTask: RenderTask | null = null;
    setMessage("正在加载…");
    document.getPage(index + 1).then((page) => {
      if (disposed || !canvasRef.current) return;
      const base = page.getViewport({ scale: 1 });
      onSize(index, { width: base.width, height: base.height });
      const viewport = page.getViewport({ scale: width / base.width });
      const outputScale = Math.min(window.devicePixelRatio || 1, 1.5);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas is unavailable");
      canvas.width = Math.max(1, Math.round(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.round(viewport.height * outputScale));
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
      });
      return renderTask.promise;
    }).then(() => {
      if (!disposed) setMessage("");
    }).catch((error) => {
      if (!disposed && error?.name !== "RenderingCancelledException") setMessage(error instanceof Error ? `加载失败：${error.message}` : "加载失败");
    });
    return () => {
      disposed = true;
      renderTask?.cancel();
    };
  }, [document, index, width, onSize]);

  return <>
    <canvas className="manga-page-canvas" ref={canvasRef} />
    {message && <span className="manga-page-placeholder">{message}</span>}
  </>;
}

export function MangaViewer({ chapter, pageIndex, onPageChange, onPreviousChapter, onNextChapter }: {
  chapter: ReadingMangaChapter;
  pageIndex: number;
  onPageChange: (page: number) => void;
  onPreviousChapter: () => void;
  onNextChapter: () => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const activePageRef = useRef(pageIndex);
  const scrollFrameRef = useRef<number | null>(null);
  const positionedRef = useRef(false);
  const zoomAnchorRef = useRef<{ index: number; fraction: number } | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(chapter.kind === "pdf" ? 0 : Math.max(1, chapter.pages?.length || 0));
  const [defaultSize, setDefaultSize] = useState<PageSize>({ width: 700, height: 1000 });
  const [pageSizes, setPageSizes] = useState<Record<number, PageSize>>({});
  const [nearbyPages, setNearbyPages] = useState<Set<number>>(() => new Set([pageIndex]));
  const [stageWidth, setStageWidth] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [status, setStatus] = useState(chapter.kind === "pdf" ? "正在读取 PDF…" : "");
  const ready = chapter.kind === "images" || Boolean(pdf);
  const pageWidth = Math.max(1, stageWidth - 36) * zoom / 100;

  useEffect(() => { activePageRef.current = pageIndex; }, [pageIndex]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => setStageWidth(stage.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (chapter.kind !== "pdf" || !chapter.resourceUrl) return;
    let disposed = false;
    const task: PDFDocumentLoadingTask = getDocument({ url: chapter.resourceUrl, rangeChunkSize: 128 * 1024 });
    task.promise.then(async (document) => {
      const first = await document.getPage(1);
      if (disposed) return;
      const viewport = first.getViewport({ scale: 1 });
      setDefaultSize({ width: viewport.width, height: viewport.height });
      setPageCount(document.numPages);
      setPdf(document);
      setStatus("");
      if (pageIndex >= document.numPages) onPageChange(document.numPages - 1);
    }).catch((error) => {
      if (!disposed) setStatus(error instanceof Error ? `无法读取 PDF：${error.message}` : "无法读取 PDF");
    });
    return () => {
      disposed = true;
      void task.destroy();
    };
  }, [chapter]);

  const savePageSize = useCallback((index: number, size: PageSize) => {
    setPageSizes((current) => {
      const previous = current[index];
      if (previous && Math.abs(previous.width - size.width) < 0.1 && Math.abs(previous.height - size.height) < 0.1) return current;
      return { ...current, [index]: size };
    });
  }, []);

  useLayoutEffect(() => {
    if (!ready || !stageWidth || positionedRef.current) return;
    const stage = stageRef.current;
    const target = pageRefs.current[Math.min(pageIndex, pageCount - 1)];
    if (!stage || !target) return;
    stage.scrollTop = target.offsetTop;
    positionedRef.current = true;
  }, [ready, stageWidth, pageCount, pageIndex]);

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;
    const stage = stageRef.current;
    const target = pageRefs.current[anchor.index];
    if (stage && target) stage.scrollTop = target.offsetTop + target.offsetHeight * anchor.fraction;
    zoomAnchorRef.current = null;
  }, [zoom]);

  useEffect(() => {
    if (!ready) return;
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver((entries) => {
      setNearbyPages((current) => {
        const next = new Set(current);
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.mangaPage);
          if (entry.isIntersecting) next.add(index);
          else next.delete(index);
        }
        return next.size === current.size && [...next].every((index) => current.has(index)) ? current : next;
      });
    }, { root: stage, rootMargin: "120% 0px", threshold: 0 });
    for (const element of pageRefs.current.slice(0, pageCount)) if (element) observer.observe(element);
    return () => observer.disconnect();
  }, [ready, pageCount]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const updateActivePage = () => {
    const stage = stageRef.current;
    if (!stage || !positionedRef.current) return;
    const position = stage.scrollTop + Math.min(120, stage.clientHeight * 0.2);
    let low = 0;
    let high = pageCount - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const element = pageRefs.current[middle];
      if (element && element.offsetTop + element.offsetHeight <= position) low = middle + 1;
      else high = middle;
    }
    if (low !== activePageRef.current) {
      activePageRef.current = low;
      onPageChange(low);
    }
  };

  const scrollToPage = (index: number) => {
    if (!ready) return;
    if (index < 0) { onPreviousChapter(); return; }
    if (index >= pageCount) { onNextChapter(); return; }
    const target = pageRefs.current[index];
    if (!target) return;
    activePageRef.current = index;
    onPageChange(index);
    if (stageRef.current) stageRef.current.scrollTop = target.offsetTop;
  };

  const changeZoom = (next: number) => {
    if (next === zoom) return;
    const stage = stageRef.current;
    const index = activePageRef.current;
    const target = pageRefs.current[index];
    if (stage && target) zoomAnchorRef.current = { index, fraction: (stage.scrollTop - target.offsetTop) / Math.max(1, target.offsetHeight) };
    setZoom(next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); scrollToPage(activePageRef.current - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); scrollToPage(activePageRef.current + 1); }
      if (["PageUp", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        stageRef.current?.scrollBy({ top: (event.key === "PageUp" ? -1 : 1) * (stageRef.current.clientHeight * 0.8), behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pageCount]);

  return <div className="manga-page-viewport">
    <div className="manga-page-stage" ref={stageRef} onScroll={() => {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        updateActivePage();
      });
    }}>
      {ready && Array.from({ length: pageCount }, (_, index) => {
        const size = pageSizes[index] || defaultSize;
        const height = Math.max(1, pageWidth * size.height / size.width);
        const isNearby = nearbyPages.has(index);
        return <div
          className="manga-continuous-page"
          data-manga-page={index}
          key={index}
          ref={(node) => { pageRefs.current[index] = node; }}
          style={{ width: pageWidth, height }}
          aria-label={`第 ${index + 1} 页`}
        >
          {isNearby && (chapter.kind === "pdf" && pdf
            ? <PdfCanvasPage document={pdf} index={index} width={pageWidth} onSize={savePageSize} />
            : chapter.pages?.[index] && <img
                className="manga-page-image"
                src={chapter.pages[index].url}
                alt={chapter.pages[index].title}
                draggable={false}
                onLoad={(event) => savePageSize(index, { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              />)}
        </div>;
      })}
      {status && <div className="manga-page-status">{status}</div>}
    </div>
    <div className="manga-reader-controls">
      <button type="button" aria-label="上一页" disabled={!ready} onClick={() => scrollToPage(activePageRef.current - 1)}><ChevronLeft size={18} /></button>
      <span>{ready ? `连续阅读 · 第 ${pageIndex + 1} / ${pageCount} 页` : "连续阅读 · 正在读取…"}</span>
      <button type="button" aria-label="下一页" disabled={!ready} onClick={() => scrollToPage(activePageRef.current + 1)}><ChevronRight size={18} /></button>
      <i />
      <button type="button" aria-label="缩小" onClick={() => changeZoom(Math.max(50, zoom - 10))}><Minus size={16} /></button>
      <span>{zoom}%</span>
      <button type="button" aria-label="放大" onClick={() => changeZoom(Math.min(200, zoom + 10))}><Plus size={16} /></button>
      <button type="button" aria-label="适应宽度" title="适应宽度" onClick={() => changeZoom(100)}><Maximize2 size={16} /></button>
    </div>
  </div>;
}
