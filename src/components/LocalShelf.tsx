import { BookOpen, FileText, Image } from "lucide-react";

export function LocalShelf() {
  return (
    <section className="local-shelf" aria-labelledby="local-shelf-title">
      <header className="local-shelf-toolbar">
        <div>
          <p className="local-shelf-kicker">LOCAL READING LIBRARY</p>
          <h1 id="local-shelf-title">本地书架</h1>
        </div>
        <div className="local-shelf-actions">
          <button className="local-shelf-import" type="button">
            <FileText size={16} />
            导入轻小说
          </button>
          <button className="local-shelf-import" type="button">
            <Image size={16} />
            导入漫画
          </button>
        </div>
      </header>

      <section className="local-shelf-empty">
        <BookOpen size={26} />
        <strong>书架等待第一本作品</strong>
        <p>导入本地轻小说或漫画后，作品会以封面卡片展示在这里。</p>
      </section>
    </section>
  );
}
