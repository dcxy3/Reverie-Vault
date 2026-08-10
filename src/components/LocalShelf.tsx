import { BookOpen, ChevronLeft, ChevronRight, FileText, Image, ImagePlus, ListTree, Minus, Plus, ScanLine, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReadingCoverCandidate, ReadingItem, ReadingItemKind } from "../types";

type ReaderPage = { chapter: string; paragraphs?: string[]; pdfPath?: string };
type ActiveReader = { item: ReadingItem; title: string; pages: ReaderPage[] };

const chapterPattern = /^(?:第[一二三四五六七八九十百千万两〇零0-9]+[章节卷回部篇].*|chapter\s+\d+.*)$/i;
const pageCharacterLimit = 780;

function paginateNovel(content: string, initialChapter = "正文"): ReaderPage[] {
  const pages: ReaderPage[] = [];
  let chapter = initialChapter;
  let paragraphs: string[] = [];
  let characterCount = 0;
  const flush = () => {
    if (paragraphs.length) pages.push({ chapter, paragraphs });
    paragraphs = [];
    characterCount = 0;
  };
  for (const rawLine of content.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (chapterPattern.test(line)) {
      flush();
      chapter = line;
      continue;
    }
    for (let start = 0; start < line.length; start += pageCharacterLimit) {
      const chunk = line.slice(start, start + pageCharacterLimit);
      if (characterCount + chunk.length > pageCharacterLimit && paragraphs.length) flush();
      paragraphs.push(chunk);
      characterCount += chunk.length;
    }
  }
  flush();
  return pages.length ? pages : [{ chapter, paragraphs: ["这本轻小说没有可显示的正文。"] }];
}

function formatReadingTime(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`;
}

export function LocalShelf({ items, onImport, onSaveProgress, onAddReadingTime, onRemoveItem, onSetCover, onSetLocalCover }: {
  items: ReadingItem[];
  onImport: (kind: ReadingItemKind) => void;
  onSaveProgress: (itemId: string, page: number, chapter: string) => void;
  onAddReadingTime: (itemId: string, seconds: number) => void;
  onRemoveItem: (item: ReadingItem) => boolean;
  onSetCover: (itemId: string, coverUrl: string, coverSource: string) => void;
  onSetLocalCover: (itemId: string, coverPath: string) => void;
}) {
  const [reader, setReader] = useState<ActiveReader | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ReadingItem | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [readingStartedAt, setReadingStartedAt] = useState<number | null>(null);
  const [coverCandidates, setCoverCandidates] = useState<ReadingCoverCandidate[]>([]);
  const [isFindingCovers, setIsFindingCovers] = useState(false);
  const [localCoverUrls, setLocalCoverUrls] = useState<Record<string, string>>({});
  const [mangaPdfUrl, setMangaPdfUrl] = useState<string | null>(null);
  const [mangaPdfError, setMangaPdfError] = useState("");
  const [mangaZoom, setMangaZoom] = useState<number | "page-width">(100);

  useEffect(() => {
    let cancelled = false;
    Promise.all(items.filter((item) => item.coverPath).map(async (item) => [item.id, await window.galLauncher.readImageDataUrl(item.coverPath!)] as const)).then((entries) => {
      if (!cancelled) setLocalCoverUrls(Object.fromEntries(entries));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [items]);

  useEffect(() => {
    if (!selectedItem) return;
    setSelectedItem(items.find((item) => item.id === selectedItem.id) ?? null);
  }, [items, selectedItem?.id]);
  const readerScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => window.galLauncher.onReadingContentChanged(({ itemId }) => {
    if (!reader || reader.item.id !== itemId) return;
    const currentChapter = reader.pages[pageIndex]?.chapter;
    void loadReaderPages(reader.item).then(({ title, pages }) => {
      const matchingPage = pages.findIndex((page) => page.chapter === currentChapter);
      setReader({ item: reader.item, title, pages });
      setPageIndex(matchingPage >= 0 ? matchingPage : Math.max(0, Math.min(pageIndex, pages.length - 1)));
    }).catch(() => undefined);
  }), [reader, pageIndex]);

  useEffect(() => {
    const page = reader?.pages[pageIndex];
    if (!reader || !page?.pdfPath) {
      setMangaPdfUrl(null);
      setMangaPdfError("");
      return;
    }
    let disposed = false;
    let objectUrl = "";
    setMangaPdfUrl(null);
    setMangaPdfError("");
    window.galLauncher.readMangaChapter(reader.item, page.pdfPath).then((data) => {
      if (disposed) return;
      objectUrl = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      setMangaPdfUrl(objectUrl);
    }).catch((error) => {
      if (!disposed) setMangaPdfError(error instanceof Error ? error.message : "无法读取当前漫画章节。");
    });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reader, pageIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReader();
      if (!reader) return;
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setPageIndex((current) => Math.max(0, current - 1));
      }
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        setPageIndex((current) => Math.min(reader.pages.length - 1, current + 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reader, readingStartedAt]);

  useEffect(() => {
    if (!reader) return;
    const page = reader.pages[pageIndex];
    onSaveProgress(reader.item.id, pageIndex, page.chapter);
    readerScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [pageIndex, reader]);

  async function loadReaderPages(item: ReadingItem): Promise<{ title: string; pages: ReaderPage[] }> {
    if (item.kind === "manga") {
      const document = await window.galLauncher.readManga(item);
      return { title: document.title, pages: document.chapters.map((chapter) => ({ chapter: chapter.title, pdfPath: chapter.filePath })) };
    }
    const document = await window.galLauncher.readNovel(item);
    const pages = document.chapters?.length
      ? document.chapters.flatMap((chapter) => paginateNovel(chapter.content, chapter.title))
      : paginateNovel(document.content || "");
    return { title: document.title, pages };
  }

  async function openReader(item: ReadingItem) {
    try {
      const { title, pages } = await loadReaderPages(item);
      setPageIndex(Math.min(item.lastReadPage ?? 0, pages.length - 1));
      setReader({ item, title, pages });
      setReadingStartedAt(Date.now());
    } catch (error) {
      const content = error instanceof Error ? error.message : "无法打开这本作品。";
      setPageIndex(0);
      setReader({ item, title: item.title, pages: paginateNovel(content) });
      setReadingStartedAt(Date.now());
    }
  }

  function setZoomFromPointer(clientY: number, track: HTMLDivElement) {
    const bounds = track.getBoundingClientRect();
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height));
    setMangaZoom(Math.round((50 + ratio * 130) / 10) * 10);
  }

  function closeReader() {
    if (reader && readingStartedAt) onAddReadingTime(reader.item.id, Math.max(1, Math.round((Date.now() - readingStartedAt) / 1000)));
    setReader(null);
    setReadingStartedAt(null);
  }

  const activePage = reader?.pages[pageIndex];
  const chapterEntries = reader?.pages.reduce<Array<{ title: string; pageIndex: number }>>((entries, page, index) => {
    if (!entries.some((entry) => entry.title === page.chapter)) entries.push({ title: page.chapter, pageIndex: index });
    return entries;
  }, []) ?? [];

  return (
    <section className="local-shelf" aria-labelledby="local-shelf-title">
      <header className="local-shelf-toolbar">
        <div><p className="local-shelf-kicker">LOCAL READING LIBRARY</p><h1 id="local-shelf-title">本地书架</h1></div>
        <div className="local-shelf-actions">
          <button className="local-shelf-import" type="button" onClick={() => onImport("novel")}><FileText size={16} />导入轻小说</button>
          <button className="local-shelf-import" type="button" onClick={() => onImport("manga")}><Image size={16} />导入漫画</button>
        </div>
      </header>

      {items.length === 0 ? (
        <section className="local-shelf-empty"><BookOpen size={26} /><strong>书架等待第一本作品</strong><p>导入本地轻小说或漫画后，作品会以封面卡片展示在这里。</p></section>
      ) : (
        <div className="local-shelf-wall">
          {items.map((item) => {
            const Icon = item.kind === "manga" ? Image : FileText;
            return <button className={`local-shelf-card ${selectedItem?.id === item.id ? "selected" : ""}`} key={item.id} type="button" onClick={() => {
              if (selectedItem?.id === item.id) void openReader(item);
              else setSelectedItem(item);
            }} title={item.title}
              onMouseMove={(event) => {
                const card = event.currentTarget;
                const bounds = card.getBoundingClientRect();
                card.style.setProperty("--tilt-x", `${-((event.clientY - bounds.top) / bounds.height - 0.5) * 60}deg`);
                card.style.setProperty("--tilt-y", `${((event.clientX - bounds.left) / bounds.width - 0.5) * 60}deg`);
              }}
              onMouseLeave={(event) => { event.currentTarget.style.removeProperty("--tilt-x"); event.currentTarget.style.removeProperty("--tilt-y"); }}>
              <div className={`local-shelf-cover ${item.kind === "manga" ? "manga-a" : "novel-a"}`}>{item.coverUrl || localCoverUrls[item.id] ? <img src={item.coverUrl || localCoverUrls[item.id]} alt="" /> : <><Icon size={34} /><span>{item.kind === "manga" ? "漫画" : "轻小说"}</span></>}<b className="local-shelf-type-badge">{item.kind === "manga" ? "漫画" : "轻小说"}</b></div>
              <div className="local-shelf-meta"><strong>{item.title}</strong><span>{item.lastReadChapter ? `读至 ${item.lastReadChapter}` : `${item.format} · 已导入`}</span></div>
            </button>;
          })}
        </div>
      )}

      {selectedItem && (
        <div className="reading-launch-actions">
          <button className="reading-settings-button" type="button" onClick={() => setIsInfoOpen(true)} aria-label="阅读设置"><SlidersHorizontal size={20} /></button>
        </div>
      )}

      {isInfoOpen && selectedItem && (
        <aside className="reading-info-sheet">
          <button className="reading-info-close" type="button" onClick={() => setIsInfoOpen(false)}><X size={18} /></button>
          <p className="local-reader-kicker">READING DETAILS</p>
          <h2>{selectedItem.title}</h2>
          <p className="reading-info-description">本地导入作品。阅读进度和时长会自动保存到书架。</p>
          <div className="reading-cover-actions"><button className="reading-cover-search" type="button" disabled={isFindingCovers} onClick={async () => {
            setIsFindingCovers(true);
            setCoverCandidates(await window.galLauncher.findReadingCoverCandidates(selectedItem));
            setIsFindingCovers(false);
          }}>{isFindingCovers ? "正在查找封面…" : "查找在线封面"}</button>
          <button className="reading-cover-search" type="button" onClick={async () => { const path = await window.galLauncher.pickImage(); if (path) onSetLocalCover(selectedItem.id, path); }}><ImagePlus size={15} />上传本地封面</button></div>
          {coverCandidates.length > 0 && <div className="reading-cover-candidates">{coverCandidates.map((candidate) => <button type="button" key={candidate.id} onClick={() => { onSetCover(selectedItem.id, candidate.imageUrl, candidate.source); setCoverCandidates([]); }}><img src={candidate.imageUrl} alt="" /><span>{candidate.source}</span></button>)}</div>}
          <dl>
            <div><dt>格式</dt><dd>{selectedItem.format}</dd></div>
            <div><dt>总时长</dt><dd>{formatReadingTime(selectedItem.totalReadingSeconds)}</dd></div>
            <div><dt>阅读进度</dt><dd>{selectedItem.lastReadChapter || "尚未开始"}</dd></div>
            <div><dt>导入时间</dt><dd>{new Date(selectedItem.importedAt).toLocaleDateString()}</dd></div>
          </dl>
          <button className="reading-info-delete" type="button" onClick={() => {
            if (onRemoveItem(selectedItem)) {
              setIsInfoOpen(false);
              setSelectedItem(null);
            }
          }}><Trash2 size={16} />从书架移除</button>
        </aside>
      )}

      {reader && activePage && (
        <section className={`local-reader ${activePage.pdfPath ? "manga-reader" : ""}`} role="dialog" aria-modal="true" aria-label={reader.title}>
          <aside className="local-reader-chapter-rail" aria-label="章节目录">
            <div className="local-reader-chapter-panel">
              <p>章节目录</p>
              <div className="local-reader-chapter-list">
                {chapterEntries.map((entry) => <button className={activePage.chapter === entry.title ? "active" : ""} type="button" key={`${entry.title}-${entry.pageIndex}`} onClick={() => setPageIndex(entry.pageIndex)}>{entry.title}</button>)}
              </div>
            </div>
            <div className="local-reader-chapter-handle"><ListTree size={20} /><span>目录</span></div>
          </aside>
          <button className="local-reader-exit" type="button" onClick={closeReader}><X size={18} />退出阅读</button>
          <div className="local-reader-scroll" ref={readerScrollRef}>
            <article className="local-reader-page">
              <p className="local-reader-kicker">{activePage.chapter}</p>
              <h2>{reader.title}</h2>
              {activePage.pdfPath
                ? mangaPdfUrl
                  ? <div className="local-reader-pdf-viewport"><iframe key={`${mangaPdfUrl}-${mangaZoom}`} className="local-reader-pdf" src={`${mangaPdfUrl}#zoom=${mangaZoom}&toolbar=0&navpanes=0&scrollbar=0`} title={activePage.chapter} /></div>
                  : <div className="local-reader-pdf-state">{mangaPdfError || "正在读取漫画章节…"}</div>
                : <div className="local-reader-text">{activePage.paragraphs?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}
              {activePage.pdfPath && <div className="manga-zoom-control">
                <button type="button" className={mangaZoom === "page-width" ? "active" : ""} onClick={() => setMangaZoom("page-width")} title="自适应宽度" aria-label="自适应宽度"><ScanLine size={16} /></button>
                <button type="button" onClick={() => setMangaZoom((zoom) => Math.min(180, (typeof zoom === "number" ? zoom : 100) + 10))} title="放大" aria-label="放大"><Plus size={15} /></button>
                <div className="manga-zoom-slider" role="slider" tabIndex={0} aria-label="漫画缩放比例" aria-valuemin={50} aria-valuemax={180} aria-valuenow={typeof mangaZoom === "number" ? mangaZoom : 100}
                  onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setZoomFromPointer(event.clientY, event.currentTarget); }}
                  onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) setZoomFromPointer(event.clientY, event.currentTarget); }}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                    event.preventDefault();
                    setMangaZoom((zoom) => Math.max(50, Math.min(180, (typeof zoom === "number" ? zoom : 100) + (event.key === "ArrowUp" ? 10 : -10))));
                  }}>
                  <span className="manga-zoom-track" />
                  <span className="manga-zoom-thumb" style={{ top: `${((180 - (typeof mangaZoom === "number" ? mangaZoom : 100)) / 130) * 100}%` }} />
                </div>
                <button type="button" onClick={() => setMangaZoom((zoom) => Math.max(50, (typeof zoom === "number" ? zoom : 100) - 10))} title="缩小" aria-label="缩小"><Minus size={15} /></button>
                <span>{mangaZoom === "page-width" ? "适应" : `${mangaZoom}%`}</span>
              </div>}
              <nav className="local-reader-pagination" aria-label="阅读翻页">
                <button type="button" aria-label="上一页" disabled={pageIndex === 0} onClick={() => setPageIndex((current) => current - 1)}><ChevronLeft size={18} /></button>
                <span>{pageIndex + 1} / {reader.pages.length}</span>
                <button type="button" aria-label="下一页" disabled={pageIndex === reader.pages.length - 1} onClick={() => setPageIndex((current) => current + 1)}><ChevronRight size={18} /></button>
              </nav>
            </article>
          </div>
        </section>
      )}
    </section>
  );
}
