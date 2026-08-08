import { BookOpen, FileText, Image } from "lucide-react";
import type { ReadingItem, ReadingItemKind } from "../types";

export function LocalShelf({ items, onImport }: { items: ReadingItem[]; onImport: (kind: ReadingItemKind) => void }) {
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
              <article className="local-shelf-card" key={item.id}>
                <div className={`local-shelf-cover ${item.kind === "manga" ? "manga-a" : "novel-a"}`}>
                  <Icon size={34} />
                  <span>{item.kind === "manga" ? "漫画" : "轻小说"}</span>
                </div>
                <div className="local-shelf-meta">
                  <strong title={item.title}>{item.title}</strong>
                  <span>{item.format} · 已导入</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
