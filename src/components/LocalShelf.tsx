import { BookOpen, FileText, Image, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReadingItem, ReadingItemKind, ReadingTextDocument } from "../types";

export function LocalShelf({ items, onImport }: { items: ReadingItem[]; onImport: (kind: ReadingItemKind) => void }) {
  const [document, setDocument] = useState<ReadingTextDocument | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDocument(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function openNovel(item: ReadingItem) {
    if (item.kind !== "novel") return;
    try {
      setDocument(await window.galLauncher.readNovel(item.id));
    } catch (error) {
      setDocument({
        title: item.title,
        content: error instanceof Error ? error.message : "无法打开这本轻小说。"
      });
    }
  }

  return (
    <section className="local-shelf" aria-labelledby="local-shelf-title">
      <header className="local-shelf-toolbar">
        <div>
          <p className="local-shelf-kicker">LOCAL READING LIBRARY</p>
          <h1 id="local-shelf-title">本地书架</h1>
        </div>
        <div className="local-shelf-actions">
          <button className="local-shelf-import" type="button" onClick={() => onImport("novel")}>
            <FileText size={16} />
            导入轻小说
          </button>
          <button className="local-shelf-import" type="button" onClick={() => onImport("manga")}>
            <Image size={16} />
            导入漫画
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <section className="local-shelf-empty">
          <BookOpen size={26} />
          <strong>书架等待第一本作品</strong>
          <p>导入本地轻小说或漫画后，作品会以封面卡片展示在这里。</p>
        </section>
      ) : (
        <div className="local-shelf-wall">
          {items.map((item) => {
            const Icon = item.kind === "manga" ? Image : FileText;
            return (
              <button
                className={`local-shelf-card ${item.kind === "novel" ? "is-readable" : ""}`}
                key={item.id}
                type="button"
                onClick={() => void openNovel(item)}
                title={item.kind === "novel" ? "打开轻小说" : "漫画阅读器即将推出"}
              >
                <div className={`local-shelf-cover ${item.kind === "manga" ? "manga-a" : "novel-a"}`}>
                  <Icon size={34} />
                  <span>{item.kind === "manga" ? "漫画" : "轻小说"}</span>
                </div>
                <div className="local-shelf-meta">
                  <strong>{item.title}</strong>
                  <span>{item.format} · 已导入</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {document && (
        <section className="local-reader" role="dialog" aria-modal="true" aria-label={document.title}>
          <button className="local-reader-exit" type="button" onClick={() => setDocument(null)}>
            <X size={18} />
            退出阅读
          </button>
          <article className="local-reader-page">
            <p className="local-reader-kicker">LOCAL LIGHT NOVEL</p>
            <h2>{document.title}</h2>
            <div className="local-reader-text">
              {document.content.split(/\r?\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          </article>
        </section>
      )}
    </section>
  );
}
