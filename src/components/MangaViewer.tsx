import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReadingMangaChapter } from "../types";
import { PdfReader } from "./PdfReader";


type PageSize = { width: number; height: number };

type MangaProps = {
  chapter: ReadingMangaChapter;
  pageIndex: number;
  initialOffset?: number;
  onPageChange: (page: number, offset: number) => void;
  onPreviousChapter: () => void;
  onNextChapter: () => void;
};

export function MangaViewer(props: MangaProps) {
  return props.chapter.kind === "pdf"
    ? <PdfReader url={props.chapter.resourceUrl!} initialPage={props.pageIndex} initialOffset={props.initialOffset}
        onProgress={props.onPageChange} onPreviousChapter={props.onPreviousChapter} onNextChapter={props.onNextChapter} />
    : <ImageReader {...props} />;
}

function ImageReader({ chapter, pageIndex, initialOffset = 0, onPageChange, onPreviousChapter, onNextChapter }: MangaProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const activePageRef = useRef(pageIndex);
  const scrollFrameRef = useRef<number | null>(null);
  const positionedRef = useRef(false);
  const progressRef = useRef({ page: pageIndex, offset: initialOffset });
  const progressCallback = useRef(onPageChange);
  progressCallback.current = onPageChange;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirtyRef = useRef(false);
  const flushProgress = () => {
    clearTimeout(saveTimer.current);
    if (dirtyRef.current) progressCallback.current(progressRef.current.page, progressRef.current.offset);
    dirtyRef.current = false;
  };
  const zoomAnchorRef = useRef<{ index: number; fraction: number } | null>(null);
  const pageCount = chapter.pages?.length || 0;
  const [defaultSize] = useState<PageSize>({ width: 700, height: 1000 });
  const [pageSizes, setPageSizes] = useState<Record<number, PageSize>>({});
  const [nearbyPages, setNearbyPages] = useState<Set<number>>(() => new Set([pageIndex]));
  const [stageWidth, setStageWidth] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [status, setStatus] = useState("");
  const ready = pageCount > 0;
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
    stage.scrollTop = target.offsetTop + target.offsetHeight * initialOffset;
    positionedRef.current = true;
  }, [ready, stageWidth, pageCount, pageIndex]);

  useLayoutEffect(() => {
    const target = pageRefs.current[progressRef.current.page];
    if (target && stageRef.current && positionedRef.current) stageRef.current.scrollTop = target.offsetTop + target.offsetHeight * progressRef.current.offset;
  }, [stageWidth, pageSizes]);

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
    flushProgress();
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const updateActivePage = () => {
    const stage = stageRef.current;
    if (!stage || !positionedRef.current) return;
    const position = stage.scrollTop + 1;
    let low = 0;
    let high = pageCount - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const element = pageRefs.current[middle];
      if (element && element.offsetTop + element.offsetHeight <= position) low = middle + 1;
      else high = middle;
    }
    activePageRef.current = low;
    const target = pageRefs.current[low];
    const offset = target ? Math.max(0, Math.min(1, (stage.scrollTop - target.offsetTop) / target.offsetHeight)) : 0;
    progressRef.current = { page: low, offset };
    dirtyRef.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushProgress, 250);
  };

  const scrollToPage = (index: number) => {
    if (!ready) return;
    if (index < 0) { onPreviousChapter(); return; }
    if (index >= pageCount) { onNextChapter(); return; }
    const target = pageRefs.current[index];
    if (!target) return;
    activePageRef.current = index;
    progressRef.current = { page: index, offset: 0 };
    onPageChange(index, 0);
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
      if ((event.target as HTMLElement)?.closest("input, textarea, select, [contenteditable=true]")) return;
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
          {isNearby && chapter.pages?.[index] && <img
                className="manga-page-image"
                src={chapter.pages[index].url}
                alt={chapter.pages[index].title}
                draggable={false}
                onLoad={(event) => savePageSize(index, { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                onError={() => setStatus("图片加载失败，请退出后重新打开")}
              />}
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
