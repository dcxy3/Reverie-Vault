import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ReadingMangaChapter } from "../types";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function MangaViewer({ chapter, pageIndex, onPageChange, onPreviousChapter, onNextChapter }: {
  chapter: ReadingMangaChapter;
  pageIndex: number;
  onPageChange: (page: number) => void;
  onPreviousChapter: () => void;
  onNextChapter: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wheelLockRef = useRef(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(chapter.pages?.length || 1);
  const [zoom, setZoom] = useState(100);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState("正在打开漫画…");

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => setViewportSize({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    setPdf(null);
    setZoom(100);
    setStatus(chapter.kind === "pdf" ? "正在按需读取 PDF…" : "");
    if (chapter.kind !== "pdf" || !chapter.resourceUrl) {
      const count = Math.max(1, chapter.pages?.length || 1);
      setPageCount(count);
      if (pageIndex >= count) onPageChange(count - 1);
      return;
    }
    loadingTask = getDocument({ url: chapter.resourceUrl, rangeChunkSize: 128 * 1024 });
    loadingTask.promise.then((document) => {
      if (disposed) return;
      setPdf(document);
      setPageCount(document.numPages);
      setStatus("");
      if (pageIndex >= document.numPages) onPageChange(document.numPages - 1);
    }).catch((error) => {
      if (!disposed) setStatus(error instanceof Error ? `无法读取 PDF：${error.message}` : "无法读取 PDF");
    });
    return () => {
      disposed = true;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [chapter]);

  useEffect(() => {
    if (!pdf || !canvasRef.current || !viewportSize.width || !viewportSize.height) return;
    let disposed = false;
    let renderTask: RenderTask | null = null;
    setStatus("正在渲染当前页…");
    pdf.getPage(Math.min(pageIndex + 1, pdf.numPages)).then((page) => {
      if (disposed || !canvasRef.current) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = Math.min(
        Math.max(0.1, (viewportSize.width - 36) / baseViewport.width),
        Math.max(0.1, (viewportSize.height - 96) / baseViewport.height)
      );
      const viewport = page.getViewport({ scale: fitScale * zoom / 100 });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas is unavailable");
      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      renderTask = page.render({ canvas, canvasContext: context, viewport, transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0] });
      return renderTask.promise;
    }).then(() => {
      if (!disposed) setStatus("");
    }).catch((error) => {
      if (!disposed && error?.name !== "RenderingCancelledException") setStatus(error instanceof Error ? `页面渲染失败：${error.message}` : "页面渲染失败");
    });
    return () => {
      disposed = true;
      renderTask?.cancel();
    };
  }, [pdf, pageIndex, viewportSize, zoom]);

  const goPrevious = () => pageIndex > 0 ? onPageChange(pageIndex - 1) : onPreviousChapter();
  const goNext = () => pageIndex < pageCount - 1 ? onPageChange(pageIndex + 1) : onNextChapter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); goPrevious(); }
      if (["ArrowRight", "PageDown", " "].includes(event.key)) { event.preventDefault(); goNext(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pageIndex, pageCount]);

  const imagePage = chapter.kind === "images" ? chapter.pages?.[pageIndex] : null;

  return <div
    className="manga-page-viewport"
    ref={viewportRef}
    onWheel={(event) => {
      if (Math.abs(event.deltaY) < 10 || Date.now() < wheelLockRef.current) return;
      event.preventDefault();
      wheelLockRef.current = Date.now() + 320;
      if (event.deltaY > 0) goNext(); else goPrevious();
    }}
  >
    <div className="manga-page-stage">
      {chapter.kind === "pdf" && <canvas ref={canvasRef} className="manga-page-canvas" />}
      {imagePage && <img className="manga-page-image" src={imagePage.url} alt={imagePage.title} style={{ transform: `scale(${zoom / 100})` }} />}
      {status && <div className="local-reader-pdf-state">{status}</div>}
    </div>
    <div className="manga-reader-controls">
      <button type="button" aria-label="上一页" onClick={goPrevious}><ChevronLeft size={18} /></button>
      <span>第 {pageIndex + 1} / {pageCount} 页</span>
      <button type="button" aria-label="下一页" onClick={goNext}><ChevronRight size={18} /></button>
      <i />
      <button type="button" aria-label="缩小" onClick={() => setZoom((value) => Math.max(50, value - 10))}><Minus size={16} /></button>
      <span>{zoom}%</span>
      <button type="button" aria-label="放大" onClick={() => setZoom((value) => Math.min(200, value + 10))}><Plus size={16} /></button>
      <button type="button" aria-label="适应窗口" title="适应窗口" onClick={() => setZoom(100)}><Maximize2 size={16} /></button>
    </div>
  </div>;
}
