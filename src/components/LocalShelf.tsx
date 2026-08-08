import { BookOpen, ChevronLeft, ChevronRight, FileText, Image, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReadingItem, ReadingItemKind, ReadingTextDocument } from "../types";

type NovelPage = { chapter: string; paragraphs: string[] };
type ActiveReader = { item: ReadingItem; document: ReadingTextDocument; pages: NovelPage[] };

const chapterPattern = /^(?:第[一二三四五六七八九十百千万两〇零0-9]+[章节卷回部篇].*|chapter\s+\d+.*)$/i;
const pageCharacterLimit = 780;

function paginateNovel(content: string): NovelPage[] {
  const pages: NovelPage[] = [];
  let chapter = "正文";
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

export function LocalShelf({
  items,
  onImport,
  onSaveProgress
}: {
  items: ReadingItem[];
  onImport: (kind: ReadingItemKind) => void;
  onSaveProgress: (itemId: string, page: number, chapter: string) => void;
}) {
  const [reader, setReader] = useState<ActiveReader | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReader(null);
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
  }, [reader]);

  useEffect(() => {
    if (!reader) return;
    const page = reader.pages[pageIndex];
    onSaveProgress(reader.item.id, pageIndex, page.chapter);
  }, [pageIndex, reader]);

  async function openNovel(item: ReadingItem) {
    if (item.kind !== "novel") return;
    try {
      const document = await window.galLauncher.readNovel(item.id);
      const pages = paginateNovel(document.content);
      const initialPage = Math.min(item.lastReadPage ?? 0, pages.length - 1);
      setPageIndex(initialPage);
      setReader({ item, document, pages });
    } catch (error) {
      const document = {
        title: item.title,
        content: error instanceof Error ? error.message : "无法打开这本轻小说。"
      };
      setPageIndex(0);
      setReader({ item, document, pages: paginateNovel(document.content) });
    }
  }

  const activePage = reader?.pages[pageIndex];

  return (
    <section className="local-shelf" aria-labelledby="local-shelf-title">
      <header className="local-shelf-toolbar">
        <div>
          <p className="local-shelf-kicker">LOCAL READING LIBRARY</p>
          <h1 id="local-shelf-title">本地书架</h1>
        </div>
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
            return (
              <button className={`local-shelf-card ${item.kind === "novel" ? "is-readable" : ""}`} key={item.id} type="button" onClick={() => void openNovel(item)} title={item.kind === "novel" ? "打开轻小说" : "漫画阅读器即将推出"}>
                <div className={`local-shelf-cover ${item.kind === "manga" ? "manga-a" : "novel-a"}`}><Icon size={34} /><span>{item.kind === "manga" ? "漫画" : "轻小说"}</span></div>
                <div className="local-shelf-meta"><strong>{item.title}</strong><span>{item.lastReadChapter ? `读至 ${item.lastReadChapter}` : `${item.format} · 已导入`}</span></div>
              </button>
            );
          })}
        </div>
      )}

      {reader && activePage && (
        <section className="local-reader" role="dialog" aria-modal="true" aria-label={reader.document.title}>
          <button className="local-reader-exit" type="button" onClick={() => setReader(null)}><X size={18} />退出阅读</button>
          <article className="local-reader-page">
            <p className="local-reader-kicker">{activePage.chapter}</p>
            <h2>{reader.document.title}</h2>
            <div className="local-reader-text">{activePage.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          </article>
          <nav className="local-reader-pagination" aria-label="阅读翻页">
            <button type="button" aria-label="上一页" disabled={pageIndex === 0} onClick={() => setPageIndex((current) => current - 1)}><ChevronLeft size={18} /></button>
            <span>{pageIndex + 1} / {reader.pages.length}</span>
            <button type="button" aria-label="下一页" disabled={pageIndex === reader.pages.length - 1} onClick={() => setPageIndex((current) => current + 1)}><ChevronRight size={18} /></button>
          </nav>
        </section>
      )}
    </section>
  );
}
