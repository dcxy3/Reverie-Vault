import React from "react";
import {
  Download,
  BookOpen,
  FileText,
  Gamepad2,
  Home,
  Library,
  Maximize,
  Minimize,
  Music2,
  Image as ImageIcon,
  Pin,
  Play,
  Plus,
  CircleQuestionMark,
  Search,
  SlidersHorizontal,
  Upload
} from "lucide-react";
import { formatPlayTime } from "../utils";
import type { LibraryController } from "../useLibrary";
import { LocalShelf } from "../components/LocalShelf";
import { MusicPlayer, MusicPlayerBoundary } from "../components/MusicPlayer";
import reverieVaultIcon from "../assets/reverie-vault-icon.png";

type GlobalSearchResult = {
  id: string;
  kind: "game" | "novel" | "manga";
  title: string;
  subtitle: string;
  score: number;
};

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase("zh-CN").replace(/[\s\p{P}\p{S}]+/gu, "");
}

function fuzzySearchScore(query: string, values: string[]) {
  const needle = normalizeSearchText(query);
  if (!needle) return 0;
  let best = 0;
  for (const rawValue of values) {
    const value = normalizeSearchText(rawValue || "");
    if (!value) continue;
    if (value === needle) best = Math.max(best, 1000);
    else if (value.startsWith(needle)) best = Math.max(best, 900 - Math.min(100, value.length - needle.length));
    else if (value.includes(needle)) best = Math.max(best, 780 - Math.min(120, value.indexOf(needle) * 8));
    else {
      let cursor = 0;
      let gaps = 0;
      for (const character of needle) {
        const index = value.indexOf(character, cursor);
        if (index < 0) { cursor = -1; break; }
        gaps += index - cursor;
        cursor = index + 1;
      }
      if (cursor >= 0) best = Math.max(best, 520 - Math.min(180, gaps * 10));
    }
  }
  return best;
}

function mysteryRandom(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function CinemaLayout({ lib }: { lib: LibraryController }) {
  const [isChromePinned, setIsChromePinned] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isMusicOpen, setIsMusicOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = React.useState(0);
  const [searchReadingTarget, setSearchReadingTarget] = React.useState({ id: "", request: 0 });
  const [mysteryClickCount, setMysteryClickCount] = React.useState(0);
  const [mysterySpin, setMysterySpin] = React.useState(0);
  const [isMysteryLaunching, setIsMysteryLaunching] = React.useState(false);
  const [mysteryBurst, setMysteryBurst] = React.useState(0);
  const [showMysteryEffect, setShowMysteryEffect] = React.useState(false);
  const mysteryEffectTimerRef = React.useRef<number | null>(null);
  const mysteryLaunchTimerRef = React.useRef<number | null>(null);
  const mysteryAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const mysteryAudioUrlRef = React.useRef("");
  React.useEffect(() => window.galLauncher.onFullscreenChanged(({ fullscreen }) => setIsFullscreen(fullscreen)), []);
  React.useEffect(() => () => {
    if (mysteryEffectTimerRef.current !== null) window.clearTimeout(mysteryEffectTimerRef.current);
    if (mysteryLaunchTimerRef.current !== null) window.clearTimeout(mysteryLaunchTimerRef.current);
    mysteryAudioRef.current?.pause();
    if (mysteryAudioUrlRef.current) URL.revokeObjectURL(mysteryAudioUrlRef.current);
  }, []);

  React.useEffect(() => {
    let disposed = false;
    void window.galLauncher.readCialloAudio().then((data) => {
      if (disposed) return;
      const audioUrl = URL.createObjectURL(new Blob([data], { type: "audio/mpeg" }));
      mysteryAudioUrlRef.current = audioUrl;
      mysteryAudioRef.current = new Audio(audioUrl);
      mysteryAudioRef.current.preload = "auto";
    }).catch(() => undefined);
    return () => { disposed = true; };
  }, []);

  function triggerMysteryButton() {
    if (isMysteryLaunching) return;
    if (mysteryAudioRef.current) {
      mysteryAudioRef.current.pause();
      mysteryAudioRef.current.currentTime = 0;
      void mysteryAudioRef.current.play().catch(() => undefined);
    }
    setMysterySpin((value) => value + 1);
    if (mysteryClickCount === 0) {
      setMysteryClickCount(1);
      setMysteryBurst((value) => value + 1);
      setShowMysteryEffect(true);
      if (mysteryEffectTimerRef.current !== null) window.clearTimeout(mysteryEffectTimerRef.current);
      mysteryEffectTimerRef.current = window.setTimeout(() => { setShowMysteryEffect(false); mysteryEffectTimerRef.current = null; }, 6200);
      return;
    }
    if (mysteryClickCount === 1) {
      setMysteryClickCount(2);
      return;
    }
    setIsMysteryLaunching(true);
    mysteryLaunchTimerRef.current = window.setTimeout(() => {
      void window.galLauncher.openCiallo();
      setMysteryClickCount(0);
      setIsMysteryLaunching(false);
      setShowMysteryEffect(false);
      mysteryLaunchTimerRef.current = null;
    }, 1000);
  }
  const {
    games,
    query, setQuery,
    statusFilter, setStatusFilter,
    viewMode, setViewMode,
    setIsInfoOpen,
    imageCache,
    tagFilter, setTagFilter,
    shelfRef,
    selected,
    selectedImage,
    fadingImage,
    filteredGames,
    collectionGames,
    readingItems,
    remoteImagePaths,
    counts,
    totalSeconds,
    recentGames,
    popularTags,
    setSelectedId,
    addGame,
    launch,
    exportBackup,
    importBackup,
    openContextMenu
    , importReadingItems
    , saveReadingProgress
    , addReadingTime
    , removeReadingItem
    , setReadingCover
    , setReadingLocalCover
  } = lib;

  const searchResults = React.useMemo<GlobalSearchResult[]>(() => {
    if (normalizeSearchText(query).length < 2) return [];
    return [
      ...games.map((game) => ({
        id: game.id,
        kind: "game" as const,
        title: game.title,
        subtitle: [game.developer, game.originalTitle].filter(Boolean).join(" · ") || "本地游戏",
        score: fuzzySearchScore(query, [game.title, game.originalTitle, game.developer, ...(game.tags || [])])
      })),
      ...readingItems.map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        subtitle: `${item.kind === "manga" ? "漫画" : "轻小说"} · ${item.lastReadChapter || item.format}`,
        score: fuzzySearchScore(query, [item.title, item.format, item.lastReadChapter || ""])
      }))
    ].filter((item) => item.score > 0).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "zh-CN")).slice(0, 6);
  }, [games, query, readingItems]);

  function chooseSearchResult(result: GlobalSearchResult) {
    setQuery("");
    setIsSearchOpen(false);
    setActiveSearchIndex(0);
    setIsInfoOpen(false);
    if (result.kind === "game") {
      setViewMode("library");
      setStatusFilter("全部");
      setTagFilter(null);
      setSelectedId(result.id);
      return;
    }
    setSearchReadingTarget((current) => ({ id: result.id, request: current.request + 1 }));
    setViewMode("reading");
  }

  return (
    <>
      <div className="image-preload" aria-hidden="true">
        {remoteImagePaths.map((imagePath) => (
          <img key={imagePath} src={imagePath} alt="" />
        ))}
      </div>
      <div className="backdrop" style={{ backgroundImage: selectedImage ? `url("${selectedImage}")` : undefined }} />
      {fadingImage && <div className="backdrop fading" style={{ backgroundImage: `url("${fadingImage}")` }} />}
      <div className="backdrop-mask" />
      {showMysteryEffect && <div className="ciallo-celebration" key={mysteryBurst} aria-hidden="true">
        {Array.from({ length: 54 }, (_, index) => {
          const seed = mysteryBurst * 101 + index * 7;
          return <span className="ciallo-text" key={`text-${index}`} style={{ "--ciallo-x": `${4 + mysteryRandom(seed + 1) * 88}%`, "--ciallo-y": `${6 + mysteryRandom(seed + 2) * 86}%`, "--ciallo-delay": `${mysteryRandom(seed + 3) * 1.15}s`, "--ciallo-angle": `${-24 + mysteryRandom(seed + 4) * 48}deg`, "--ciallo-size": `${0.78 + mysteryRandom(seed + 5) * 0.55}` } as React.CSSProperties}>Ciallo～(∠・ω&lt;)⌒★</span>;
        })}
        {Array.from({ length: 12 }, (_, burstIndex) => {
          const seed = mysteryBurst * 173 + burstIndex * 11;
          return <span className="ciallo-firework" key={`firework-${burstIndex}`} style={{ "--firework-x": `${7 + mysteryRandom(seed + 1) * 86}%`, "--firework-y": `${10 + mysteryRandom(seed + 2) * 76}%`, "--firework-delay": `${0.08 + mysteryRandom(seed + 3) * 1.45}s`, "--firework-color": ["#ff78c8", "#72ddff", "#ffe477", "#a88cff", "#8dffad", "#ff9f6e"][burstIndex % 6] } as React.CSSProperties}>{Array.from({ length: 16 }, (_, ray) => <i key={ray} style={{ "--ray": ray } as React.CSSProperties} />)}</span>;
        })}
      </div>}

      <div className="rail-reveal" aria-hidden="true" />
      <aside className={`rail ${isChromePinned ? "is-pinned" : ""}`}>
        <div className="rail-logo">
          <img src={reverieVaultIcon} alt="Reverie Vault" />
        </div>
        <button className={viewMode === "library" && statusFilter === "全部" ? "rail-button active" : "rail-button"} aria-label="全部游戏" onClick={() => { setViewMode("library"); setStatusFilter("全部"); }}>
          <Home size={20} />
        </button>
        <button className={viewMode === "collection" ? "rail-button active" : "rail-button"} aria-label="收藏展示柜" onClick={() => { setViewMode("collection"); setStatusFilter("全部"); }}>
          <Library size={20} />
        </button>
        <button className={viewMode === "reading" ? "rail-button active" : "rail-button"} aria-label="本地书架" title="本地书架" onClick={() => { setViewMode("reading"); setIsInfoOpen(false); }}>
          <BookOpen size={20} />
        </button>
        <button className={`rail-button ${isMusicOpen ? "active" : ""}`} aria-label="音乐播放器" title="音乐播放器" aria-pressed={isMusicOpen} onClick={() => setIsMusicOpen((open) => !open)}>
          <Music2 size={20} />
        </button>
        <button className="rail-button" aria-label="导出备份" onClick={exportBackup}>
          <Download size={19} />
        </button>
        <button className="rail-button" aria-label="恢复备份" onClick={importBackup}>
          <Upload size={19} />
        </button>
        <button className={`rail-button mystery ${mysteryClickCount > 0 ? "active" : ""}`} aria-label="神秘小按钮" title={`神秘小按钮（${mysteryClickCount + 1}/3）`} onClick={triggerMysteryButton}>
          <CircleQuestionMark key={mysterySpin} className={mysterySpin > 0 ? "mystery-spin-icon" : undefined} size={20} />
        </button>
        <button
          className={`rail-button pin ${isChromePinned ? "active" : ""}`}
          aria-label={isChromePinned ? "取消固定边框与游戏卡" : "固定边框与游戏卡"}
          title={isChromePinned ? "取消固定边框与游戏卡" : "固定边框与游戏卡"}
          aria-pressed={isChromePinned}
          onClick={() => setIsChromePinned((pinned) => !pinned)}
        >
          <Pin size={19} />
        </button>
        <button className={`rail-button fullscreen ${isFullscreen ? "active" : ""}`} aria-label={isFullscreen ? "退出全屏" : "进入全屏"} title={isFullscreen ? "退出全屏 (F11 / Esc)" : "进入全屏 (F11)"} aria-pressed={isFullscreen} onClick={async () => setIsFullscreen(await window.galLauncher.toggleFullscreen())}>
          {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
        </button>
        <button className="rail-button add" aria-label="添加游戏" onClick={addGame}>
          <Plus size={20} />
        </button>
      </aside>

      {isMusicOpen && <MusicPlayerBoundary onClose={() => setIsMusicOpen(false)}><MusicPlayer onClose={() => setIsMusicOpen(false)} /></MusicPlayerBoundary>}

      <main className="stage cinema-stage" style={viewMode !== "library" ? { gridTemplateRows: "60px minmax(0, 1fr)" } as React.CSSProperties : undefined}>
        <header className="stage-top">
          <div className="global-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsSearchOpen(false); }}>
            <div className="search-pill">
              <Search size={18} />
              <input
                value={query}
                onFocus={() => setIsSearchOpen(normalizeSearchText(query).length >= 2)}
                onChange={(event) => { setQuery(event.target.value); setActiveSearchIndex(0); setIsSearchOpen(normalizeSearchText(event.target.value).length >= 2); }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") { setIsSearchOpen(false); return; }
                  if (!searchResults.length) return;
                  if (event.key === "ArrowDown") { event.preventDefault(); setIsSearchOpen(true); setActiveSearchIndex((index) => (index + 1) % searchResults.length); }
                  else if (event.key === "ArrowUp") { event.preventDefault(); setIsSearchOpen(true); setActiveSearchIndex((index) => (index - 1 + searchResults.length) % searchResults.length); }
                  else if (event.key === "Enter") { event.preventDefault(); chooseSearchResult(searchResults[Math.min(activeSearchIndex, searchResults.length - 1)]); }
                }}
                placeholder="搜索游戏、轻小说、漫画"
                aria-label="全局搜索"
                aria-expanded={isSearchOpen && searchResults.length > 0}
              />
            </div>
            {isSearchOpen && <div className="global-search-results" role="listbox">
              {searchResults.length ? searchResults.map((result, index) => {
                const ResultIcon = result.kind === "game" ? Gamepad2 : result.kind === "manga" ? ImageIcon : FileText;
                return <button type="button" role="option" aria-selected={index === activeSearchIndex} className={index === activeSearchIndex ? "active" : ""} key={`${result.kind}-${result.id}`} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveSearchIndex(index)} onClick={() => chooseSearchResult(result)}>
                  <span className={`global-search-icon ${result.kind}`}><ResultIcon size={16} /></span>
                  <span className="global-search-copy"><strong>{result.title}</strong><small>{result.subtitle}</small></span>
                  <b>{result.kind === "game" ? "游戏" : result.kind === "manga" ? "漫画" : "轻小说"}</b>
                </button>;
              }) : <div className="global-search-empty">没有找到匹配的本地内容</div>}
            </div>}
          </div>
          <div className="stage-stats">
            <span>{formatPlayTime(totalSeconds)}</span>
            <span>{counts.total} 部作品</span>
            <span>进行中 {counts.active}</span>
            <span>已通关 {counts.done}</span>
          </div>
          {viewMode === "library" && recentGames.length > 0 && (
            <div className="recent-row">
              <span className="recent-label">继续游戏</span>
              {recentGames.map((g) => (
                <button key={g.id} className="recent-chip" onClick={() => { setSelectedId(g.id); setStatusFilter("全部"); setTagFilter(null); }}>
                  {g.title}
                </button>
              ))}
            </div>
          )}
          {viewMode === "library" && popularTags.length > 0 && (
            <div className="tag-row">
              {popularTags.map((tag) => (
                <button key={tag} className={`tag-chip ${tagFilter === tag ? "active" : ""}`} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>
                  {tag}
                </button>
              ))}
            </div>
          )}
        </header>

        {viewMode === "collection" ? (
          <section className="collection-view">
            <div className="collection-toolbar">
              <div className="collection-toolbar-left">
                <button className="collection-filter">所有游戏 <span>({collectionGames.length})</span></button>
                <span className="collection-chevron">⌄</span>
                <span className="collection-sort-label">排序方式:</span>
                <button className="collection-sort">最近游玩 <span>⌄</span></button>
              </div>
              <button className="collection-top-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>⌃</button>
            </div>
            <div className="collection-wall">
              {collectionGames.map((game) => {
                const posterImage = imageCache[game.coverPath] || imageCache[game.backgroundPath];
                return (
                  <button
                    key={game.id}
                    className="collection-poster-card"
                    aria-label={game.title}
                    onContextMenu={(e) => openContextMenu(e, game)}
                    onMouseMove={(event) => {
                      const card = event.currentTarget;
                      const bounds = card.getBoundingClientRect();
                      const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
                      const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;
                      card.style.setProperty("--tilt-x", `${-offsetY * 60}deg`);
                      card.style.setProperty("--tilt-y", `${offsetX * 60}deg`);
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.removeProperty("--tilt-x");
                      event.currentTarget.style.removeProperty("--tilt-y");
                    }}
                    onClick={() => {
                      setSelectedId(game.id);
                      setStatusFilter("全部");
                      setViewMode("library");
                      setIsInfoOpen(false);
                    }}
                  >
                    <div className="collection-poster-art">
                      {posterImage ? <img src={posterImage} alt="" /> : <Gamepad2 size={24} />}
                      {game.playCount > 0 && <span className="collection-badge">{Math.min(game.playCount, 99)}</span>}
                    </div>
                    <div className="collection-poster-title">
                      <strong>{game.title}</strong>
                      <span>{game.developer || game.status}</span>
                    </div>
                  </button>
                );
              })}
              {collectionGames.length === 0 && (
                <div className="collection-empty">
                  <Library size={36} />
                  <strong>暂无匹配作品</strong>
                  <span>换个关键词再看看收藏柜。</span>
                </div>
              )}
            </div>
          </section>
        ) : viewMode === "reading" ? (
          <LocalShelf items={readingItems} selectedItemId={searchReadingTarget.id} selectionRequest={searchReadingTarget.request} onImport={importReadingItems} onSaveProgress={saveReadingProgress} onAddReadingTime={addReadingTime} onRemoveItem={removeReadingItem} onSetCover={setReadingCover} onSetLocalCover={setReadingLocalCover} />
        ) : selected ? (
          <section className="feature">
            <div className="showcase-art">
              {!selectedImage && <Gamepad2 size={72} />}
              <div className="showcase-glow" />
              <section className={`shelf ${isChromePinned ? "is-pinned" : ""}`}>
                <div className="shelf-title">
                  <span className="accent-dot" />
                  <h2>{statusFilter === "全部" ? "Galgame" : statusFilter}</h2>
                  <span>{filteredGames.length} 部</span>
                </div>

                <div
                  className="cover-row"
                  ref={shelfRef}
                  onWheel={(event) => {
                    const element = shelfRef.current;
                    if (!element) return;
                    element.scrollLeft += event.deltaY || event.deltaX;
                  }}
                >
                  {filteredGames.map((game, index) => (
                    <button key={game.id} className={`shelf-card ${game.id === selected?.id ? "active" : ""}`} style={{ '--i': index } as React.CSSProperties} onClick={() => setSelectedId(game.id)} onContextMenu={(e) => openContextMenu(e, game)} aria-label={game.title}>
                      <div className="shelf-cover">
                        {imageCache[game.coverPath] ? <img src={imageCache[game.coverPath]} alt="" /> : <Gamepad2 size={30} />}
                        <span>{game.title}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
              <div className="showcase-overlay">
                <p>{selected.developer || "Visual Novel"}</p>
                <h1>{selected.title}</h1>
                <span>{selected.originalTitle || selected.releaseDate || "本地游戏"}</span>
              </div>
              <button className="floating-play" onClick={() => launch(selected)}>
                <Play size={22} fill="currentColor" />
                启动
              </button>
              <button className="floating-info" onClick={() => setIsInfoOpen(true)} aria-label="游戏资料" title="游戏资料">
                <SlidersHorizontal size={21} />
              </button>
            </div>
          </section>
        ) : (
          <section className="empty-hero">
            <Library size={40} />
            <h1>把第一部作品放进来</h1>
            <button className="play-button" onClick={addGame}>
              <Plus size={20} />
              添加游戏
            </button>
          </section>
        )}

      </main>
    </>
  );
}
