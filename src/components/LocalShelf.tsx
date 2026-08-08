import { BookOpen, FileText, FolderOpen, Image } from "lucide-react";

const shelfPreviews = [
  { type: "漫画", title: "导入本地漫画", detail: "CBZ · ZIP · 图片文件夹", tone: "manga-a", icon: Image },
  { type: "轻小说", title: "导入轻小说", detail: "EPUB · TXT · PDF", tone: "novel-a", icon: FileText },
  { type: "阅读列表", title: "创建你的书架", detail: "扫描本地阅读目录", tone: "manga-b", icon: BookOpen }
];

export function LocalShelf() {
  return (
    <section className="local-shelf" aria-labelledby="local-shelf-title">
      <header className="local-shelf-toolbar">
        <div>
          <p className="local-shelf-kicker">LOCAL READING LIBRARY</p>
          <h1 id="local-shelf-title">本地书架</h1>
        </div>
        <button className="local-shelf-import" type="button">
          <FolderOpen size={17} />
          选择阅读目录
        </button>
      </header>

      <p className="local-shelf-intro">将漫画、轻小说和阅读进度都收进同一座书架。导入本地文件后，作品会以封面卡片展示在这里。</p>

      <div className="local-shelf-wall">
        {shelfPreviews.map(({ type, title, detail, tone, icon: Icon }) => (
          <article className="local-shelf-card" key={title}>
            <div className={`local-shelf-cover ${tone}`}>
              <Icon size={34} />
              <span>{type}</span>
            </div>
            <div className="local-shelf-meta">
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
