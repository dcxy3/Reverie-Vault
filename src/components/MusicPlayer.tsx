import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Cloud,
  FolderPlus,
  GripHorizontal,
  Heart,
  HardDrive,
  ListMusic,
  ListOrdered,
  LogOut,
  Music2,
  Pause,
  Play,
  QrCode,
  RefreshCw,
  SkipBack,
  SkipForward,
  Shuffle,
  Volume2,
  VolumeX,
  Trash2,
  X
} from "lucide-react";
import type { LocalMusicTrack, MusicPlaylist, MusicProfile, MusicTrack } from "../types";

type Position = { x: number; y: number };
type DockSide = "left" | "right" | "top" | "bottom" | null;
type PlayMode = "list" | "shuffle";
type MusicSource = "netease" | "local";

const PLAYER_WIDTH = 350;
const LEFT_EDGE = 64;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/^Error invoking remote method '[^']+': Error:\s*/, "");
}

export class MusicPlayerBoundary extends React.Component<{ children: React.ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Music player render failed:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="music-player music-player-fallback" aria-label="音乐播放器恢复面板">
      <Music2 size={22} />
      <strong>音乐面板发生异常</strong>
      <span>主界面仍可继续使用，可以重试或关闭音乐面板。</span>
      <div>
        <button type="button" className="music-primary-button" onClick={() => this.setState({ failed: false })}><RefreshCw size={14} />重试</button>
        <button type="button" className="music-icon-button" aria-label="关闭音乐面板" onClick={this.props.onClose}><X size={16} /></button>
      </div>
    </section>;
  }
}

export function MusicPlayer({ onClose }: { onClose: () => void }) {
  const [position, setPosition] = React.useState<Position>(() => ({ x: Math.max(82, window.innerWidth - 390), y: 76 }));
  const [profile, setProfile] = React.useState<MusicProfile | null>(null);
  const [playlist, setPlaylist] = React.useState<MusicPlaylist | null>(null);
  const [localTracks, setLocalTracks] = React.useState<LocalMusicTrack[]>([]);
  const [qr, setQr] = React.useState<{ key: string; qrimg: string } | null>(null);
  const [loginMessage, setLoginMessage] = React.useState("使用网易云音乐 App 扫码登录");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [currentIndex, setCurrentIndex] = React.useState(-1);
  const [currentLocalIndex, setCurrentLocalIndex] = React.useState(-1);
  const [activeSource, setActiveSource] = React.useState<MusicSource>("netease");
  const [playingSource, setPlayingSource] = React.useState<MusicSource | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [isPlaylistOpen, setIsPlaylistOpen] = React.useState(false);
  const [loadingLocal, setLoadingLocal] = React.useState(true);
  const [volume, setVolume] = React.useState(0.72);
  const [muted, setMuted] = React.useState(false);
  const [isVolumeOpen, setIsVolumeOpen] = React.useState(false);
  const [playMode, setPlayMode] = React.useState<PlayMode>("list");
  const [dockSide, setDockSide] = React.useState<DockSide>(null);
  const [isDockCollapsed, setIsDockCollapsed] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const playerRef = React.useRef<HTMLElement>(null);
  const dragRef = React.useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const dockTimerRef = React.useRef<number | null>(null);

  const cloudTrack = currentIndex >= 0 ? playlist?.tracks[currentIndex] : undefined;
  const localTrack = currentLocalIndex >= 0 ? localTracks[currentLocalIndex] : undefined;

  const loadPlaylist = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPlaylist(await window.galLauncher.getLikedMusicPlaylist());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let disposed = false;
    void window.galLauncher.getMusicSession().then((session) => {
      if (disposed) return;
      setProfile(session.profile || null);
      if (session.loggedIn) void loadPlaylist();
      else setLoading(false);
    }).catch((caught) => {
      if (!disposed) { setLoading(false); setError(errorMessage(caught)); }
    });
    return () => { disposed = true; };
  }, [loadPlaylist]);

  React.useEffect(() => {
    let disposed = false;
    void window.galLauncher.loadLocalMusicLibrary().then((tracks) => { if (!disposed) setLocalTracks(tracks); }).catch((caught) => { if (!disposed) setError(errorMessage(caught)); }).finally(() => { if (!disposed) setLoadingLocal(false); });
    return () => { disposed = true; };
  }, []);

  React.useEffect(() => {
    if (!qr?.key || profile) return;
    let stopped = false;
    let checking = false;
    const poll = async () => {
      if (checking || stopped) return;
      checking = true;
      try {
        const result = await window.galLauncher.checkMusicQr(qr.key);
        if (stopped) return;
        if (result.code === 800) { setLoginMessage("二维码已过期，请重新生成"); setQr(null); }
        else if (result.code === 802) setLoginMessage("已扫码，请在手机上确认");
        else if (result.code === 803 && result.loggedIn) {
          setLoginMessage("登录成功");
          setProfile(result.profile || null);
          setQr(null);
          void loadPlaylist();
        } else setLoginMessage("等待扫码…");
      } catch (caught) {
        if (!stopped) setError(errorMessage(caught));
      } finally {
        checking = false;
      }
    };
    void poll();
    const timer = window.setInterval(poll, 2000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [qr?.key, profile, loadPlaylist]);

  React.useEffect(() => () => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.removeAttribute("src"); }
    if (dockTimerRef.current !== null) window.clearTimeout(dockTimerRef.current);
  }, []);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (audio) { audio.volume = volume; audio.muted = muted; }
  }, [volume, muted]);

  React.useEffect(() => {
    const handleResize = () => setPosition((current) => ({
      x: dockSide === "left" ? LEFT_EDGE : dockSide === "right" ? window.innerWidth - PLAYER_WIDTH : Math.max(LEFT_EDGE, Math.min(window.innerWidth - PLAYER_WIDTH, current.x)),
      y: dockSide === "top" ? 0 : dockSide === "bottom" ? Math.max(0, window.innerHeight - (playerRef.current?.offsetHeight || 260)) : Math.max(0, Math.min(window.innerHeight - (playerRef.current?.offsetHeight || 260), current.y))
    }));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [dockSide]);

  React.useEffect(() => {
    if (dockSide !== "bottom") return;
    const frame = window.requestAnimationFrame(() => setPosition((current) => ({ ...current, y: Math.max(0, window.innerHeight - (playerRef.current?.offsetHeight || 260)) })));
    return () => window.cancelAnimationFrame(frame);
  }, [dockSide, isPlaylistOpen, isVolumeOpen, loading, profile, error]);

  async function createQr() {
    setLoading(true);
    setError("");
    try {
      setQr(await window.galLauncher.createMusicQr());
      setLoginMessage("等待扫码…");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function playCloudAt(index: number) {
    if (!playlist?.tracks[index] || !audioRef.current) return;
    setError("");
    try {
      const source = await window.galLauncher.getMusicSongUrl(playlist.tracks[index].id);
      const audio = audioRef.current;
      audio.src = source.url;
      setCurrentIndex(index);
      setPlayingSource("netease");
      setIsPlaylistOpen(false);
      setCurrentTime(0);
      await audio.play();
      setPlaying(true);
    } catch (caught) {
      setPlaying(false);
      setError(errorMessage(caught));
    }
  }

  async function playLocalAt(index: number) {
    if (!localTracks[index] || !audioRef.current) return;
    setError("");
    try {
      const source = await window.galLauncher.getLocalMusicTrackUrl(localTracks[index].id);
      const audio = audioRef.current;
      audio.src = source;
      setCurrentLocalIndex(index);
      setPlayingSource("local");
      setIsPlaylistOpen(false);
      setCurrentTime(0);
      await audio.play();
      setPlaying(true);
    } catch (caught) {
      setPlaying(false);
      setError(errorMessage(caught));
    }
  }

  async function importLocalTracks() {
    setLoadingLocal(true);
    setError("");
    try {
      setLocalTracks(await window.galLauncher.pickLocalMusicTracks());
      setIsPlaylistOpen(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoadingLocal(false);
    }
  }

  async function removeLocalTrack(track: LocalMusicTrack) {
    const playingLocalId = localTrack?.id;
    if (playingSource === "local" && localTrack?.id === track.id) {
      audioRef.current?.pause();
      audioRef.current?.removeAttribute("src");
      setCurrentLocalIndex(-1);
      setPlayingSource(null);
      setPlaying(false);
    }
    const remaining = await window.galLauncher.removeLocalMusicTrack(track.id);
    setLocalTracks(remaining);
    if (playingLocalId && playingLocalId !== track.id) setCurrentLocalIndex(remaining.findIndex((item) => item.id === playingLocalId));
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!playingSource) {
      if (activeSource === "local") void playLocalAt(0);
      else void playCloudAt(0);
      return;
    }
    if (audio.paused) void audio.play().then(() => setPlaying(true)).catch((caught) => setError(errorMessage(caught)));
    else { audio.pause(); setPlaying(false); }
  }

  function adjacent(delta: number) {
    const isLocal = playingSource === "local" || (!playingSource && activeSource === "local");
    const tracks = isLocal ? localTracks : (playlist?.tracks || []);
    const selectedIndex = isLocal ? currentLocalIndex : currentIndex;
    if (!tracks.length) return;
    if (playMode === "shuffle" && tracks.length > 1) {
      let nextIndex = selectedIndex;
      while (nextIndex === selectedIndex) nextIndex = Math.floor(Math.random() * tracks.length);
      if (isLocal) void playLocalAt(nextIndex);
      else void playCloudAt(nextIndex);
      return;
    }
    const nextIndex = (Math.max(0, selectedIndex) + delta + tracks.length) % tracks.length;
    if (isLocal) void playLocalAt(nextIndex);
    else void playCloudAt(nextIndex);
  }

  async function logout() {
    if (playingSource === "netease") {
      audioRef.current?.pause();
      audioRef.current?.removeAttribute("src");
      setPlayingSource(null);
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
    await window.galLauncher.logoutMusic();
    setProfile(null);
    setPlaylist(null);
    setCurrentIndex(-1);
    setPlaying(false);
    setQr(null);
    setIsPlaylistOpen(false);
    setLoginMessage("使用网易云音乐 App 扫码登录");
  }

  function beginDrag(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, dx: event.clientX - position.x, dy: event.clientY - position.y };
    setIsDockCollapsed(false);
    setDockSide(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const playerHeight = playerRef.current?.offsetHeight || 260;
    setPosition({
      x: Math.max(LEFT_EDGE, Math.min(window.innerWidth - PLAYER_WIDTH, event.clientX - drag.dx)),
      y: Math.max(0, Math.min(window.innerHeight - playerHeight, event.clientY - drag.dy))
    });
  }

  function endDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const playerHeight = playerRef.current?.offsetHeight || 260;
    const maxY = Math.max(0, window.innerHeight - playerHeight);
    const finalX = Math.max(LEFT_EDGE, Math.min(window.innerWidth - PLAYER_WIDTH, event.clientX - drag.dx));
    const finalY = Math.max(0, Math.min(maxY, event.clientY - drag.dy));
    dragRef.current = null;
    const distances = [
      { side: "left" as const, distance: finalX - LEFT_EDGE },
      { side: "right" as const, distance: window.innerWidth - PLAYER_WIDTH - finalX },
      { side: "top" as const, distance: finalY },
      { side: "bottom" as const, distance: maxY - finalY }
    ].sort((a, b) => a.distance - b.distance);
    const nearest = distances[0];
    if (nearest.distance <= 24) {
      setDockSide(nearest.side);
      setPosition({
        x: nearest.side === "left" ? LEFT_EDGE : nearest.side === "right" ? window.innerWidth - PLAYER_WIDTH : finalX,
        y: nearest.side === "top" ? 0 : nearest.side === "bottom" ? maxY : finalY
      });
    }
  }

  function revealDock() {
    if (dockTimerRef.current !== null) window.clearTimeout(dockTimerRef.current);
    dockTimerRef.current = null;
    setIsDockCollapsed(false);
  }

  function scheduleDockCollapse() {
    if (!dockSide || dragRef.current) return;
    if (dockTimerRef.current !== null) window.clearTimeout(dockTimerRef.current);
    dockTimerRef.current = window.setTimeout(() => {
      setIsDockCollapsed(true);
      setIsPlaylistOpen(false);
      setIsVolumeOpen(false);
      dockTimerRef.current = null;
    }, 520);
  }

  return (
    <section
      ref={playerRef}
      className={`music-player ${dockSide ? `is-docked is-docked-${dockSide}` : ""} ${isDockCollapsed ? "is-dock-collapsed" : ""}`}
      style={{ left: position.x, top: position.y }}
      aria-label="网易云音乐播放器"
      onMouseEnter={revealDock}
      onMouseLeave={scheduleDockCollapse}
    >
      {dockSide && <button type="button" className="music-dock-handle" aria-label="展开音乐播放器" onClick={revealDock}>
        {dockSide === "left" ? <ChevronRight size={14} /> : dockSide === "right" ? <ChevronLeft size={14} /> : dockSide === "top" ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        <Music2 size={13} />
      </button>}
      <header className="music-player-header" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <span className="music-player-title"><Music2 size={17} /> 音乐</span>
        <GripHorizontal className="music-drag-grip" size={19} />
        <button type="button" className="music-icon-button" aria-label="关闭音乐播放器" onPointerDown={(event) => event.stopPropagation()} onClick={onClose}><X size={17} /></button>
      </header>

      <nav className="music-source-switch" aria-label="音乐来源">
        <button type="button" className={activeSource === "netease" ? "active" : ""} onClick={() => { setActiveSource("netease"); setIsPlaylistOpen(false); }}><Cloud size={14} />网易云</button>
        <button type="button" className={activeSource === "local" ? "active" : ""} onClick={() => { setActiveSource("local"); setIsPlaylistOpen(false); }}><HardDrive size={14} />本地音乐</button>
      </nav>

      {activeSource === "local" ? (
        <>
          <div className="music-local-toolbar">
            <div><HardDrive size={18} /><span><strong>本地音乐</strong><small>{localTracks.length} 首 · 直接读取原文件</small></span></div>
            <button type="button" className="music-primary-button" disabled={loadingLocal} onClick={() => void importLocalTracks()}><FolderPlus size={15} />导入</button>
          </div>

          <button type="button" className="music-now-playing" aria-expanded={isPlaylistOpen} onClick={() => setIsPlaylistOpen((open) => !open)}>
            <div className="music-cover-placeholder"><HardDrive size={24} /></div>
            <div><strong>{localTrack?.title || "选择本地歌曲开始播放"}</strong><span>{localTrack ? `本地音乐 · ${localTrack.format}` : `点击展开歌单 · ${localTracks.length} 首`}</span></div>
            <ListMusic size={17} />
          </button>

          <div className="music-progress-row">
            <span>{formatTime(currentTime)}</span>
            <input type="range" min={0} max={duration || 1} step={0.1} value={Math.min(currentTime, duration || 1)} aria-label="播放进度" onChange={(event) => { const value = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = value; setCurrentTime(value); }} />
            <span>{formatTime(duration)}</span>
          </div>
          <div className="music-controls">
            <button type="button" onClick={() => adjacent(-1)} aria-label="上一首"><SkipBack size={18} /></button>
            <button type="button" className="music-play-button" onClick={togglePlayback} aria-label={playing ? "暂停" : "播放"}>{playing ? <Pause size={19} /> : <Play size={19} fill="currentColor" />}</button>
            <button type="button" onClick={() => adjacent(1)} aria-label="下一首"><SkipForward size={18} /></button>
            <button type="button" className={playMode === "shuffle" ? "active" : undefined} title={playMode === "list" ? "当前：列表顺序" : "当前：随机播放"} onClick={() => setPlayMode((mode) => mode === "list" ? "shuffle" : "list")}>{playMode === "shuffle" ? <Shuffle size={17} /> : <ListOrdered size={17} />}</button>
            <div className="music-volume-control">
              <button type="button" aria-label="音量控制" onClick={() => setIsVolumeOpen((open) => !open)}>{muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
              {isVolumeOpen && <div className="music-volume-popover"><button type="button" onClick={() => setMuted((value) => !value)}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button><input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => { setVolume(Number(event.target.value)); setMuted(false); }} /><span>{Math.round((muted ? 0 : volume) * 100)}%</span></div>}
            </div>
          </div>

          {loadingLocal ? <div className="music-loading"><RefreshCw size={17} className="is-spinning" />正在读取本地音乐…</div> : isPlaylistOpen && (
            <div className="music-track-list">
              {localTracks.length ? localTracks.map((track, index) => <div className="music-local-track-row" key={track.id}>
                <button type="button" className={`music-track ${track.id === localTrack?.id ? "active" : ""}`} onClick={() => void playLocalAt(index)}>
                  <span className="music-track-index">{track.id === localTrack?.id && playing ? <Music2 size={13} /> : index + 1}</span>
                  <span className="music-track-copy"><strong>{track.title}</strong><small>本地文件 · {track.format}</small></span>
                  <span>{track.format}</span>
                </button>
                <button type="button" className="music-local-remove" aria-label={`移除 ${track.title}`} title="只移除记录，不删除本地文件" onClick={() => void removeLocalTrack(track)}><Trash2 size={13} /></button>
              </div>) : <div className="music-local-empty"><FolderPlus size={21} /><span>还没有本地歌曲</span><small>点击“导入”选择音频文件</small></div>}
            </div>
          )}
        </>
      ) : !profile ? (
        <div className="music-login">
          <div className="music-login-mark"><QrCode size={28} /></div>
          <strong>扫码登录网易云音乐</strong>
          <span>{loginMessage}</span>
          {qr && <img className="music-qr" src={qr.qrimg} alt="网易云音乐登录二维码" />}
          <button type="button" className="music-primary-button" disabled={loading} onClick={createQr}>
            <RefreshCw size={15} className={loading ? "is-spinning" : undefined} /> {qr ? "重新生成二维码" : "生成登录二维码"}
          </button>
          <small>登录凭据由系统加密保存在本机，播放器不下载歌曲文件。</small>
        </div>
      ) : (
        <>
          <div className="music-account">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <Music2 size={20} />}
            <div><strong>{profile.nickname}</strong><span>{playlist?.name || "正在读取喜欢歌单"}</span></div>
            <button type="button" className="music-icon-button" title="退出网易云账号" onClick={() => void logout()}><LogOut size={16} /></button>
          </div>

          <button type="button" className="music-now-playing" aria-expanded={isPlaylistOpen} onClick={() => setIsPlaylistOpen((open) => !open)}>
            {cloudTrack?.coverUrl || playlist?.coverUrl ? <img src={cloudTrack?.coverUrl || playlist?.coverUrl} alt="" /> : <div className="music-cover-placeholder"><Heart size={24} /></div>}
            <div><strong>{cloudTrack?.name || "选择一首歌开始播放"}</strong><span>{cloudTrack?.artists || `点击展开歌单 · ${playlist?.trackCount || 0} 首`}</span></div>
            <ListMusic size={17} />
          </button>

          <div className="music-progress-row">
            <span>{formatTime(currentTime)}</span>
            <input type="range" min={0} max={duration || 1} step={0.1} value={Math.min(currentTime, duration || 1)} aria-label="播放进度" onChange={(event) => {
              const value = Number(event.target.value);
              if (audioRef.current) audioRef.current.currentTime = value;
              setCurrentTime(value);
            }} />
            <span>{formatTime(duration)}</span>
          </div>
          <div className="music-controls">
            <button type="button" onClick={() => adjacent(-1)} aria-label="上一首"><SkipBack size={18} /></button>
            <button type="button" className="music-play-button" onClick={togglePlayback} aria-label={playing ? "暂停" : "播放"}>{playing ? <Pause size={19} /> : <Play size={19} fill="currentColor" />}</button>
            <button type="button" onClick={() => adjacent(1)} aria-label="下一首"><SkipForward size={18} /></button>
            <button type="button" className={playMode === "shuffle" ? "active" : undefined} title={playMode === "list" ? "当前：列表顺序" : "当前：随机播放"} aria-label={playMode === "list" ? "切换为随机播放" : "切换为列表顺序"} onClick={() => setPlayMode((mode) => mode === "list" ? "shuffle" : "list")}>
              {playMode === "shuffle" ? <Shuffle size={17} /> : <ListOrdered size={17} />}
            </button>
            <div className="music-volume-control">
              <button type="button" aria-label="音量控制" aria-expanded={isVolumeOpen} onClick={() => setIsVolumeOpen((open) => !open)}>{muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
              {isVolumeOpen && <div className="music-volume-popover">
                <button type="button" aria-label={muted ? "取消静音" : "静音"} onClick={() => setMuted((value) => !value)}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
                <input type="range" min={0} max={1} step={0.01} value={volume} aria-label="播放音量" onChange={(event) => { setVolume(Number(event.target.value)); setMuted(false); }} />
                <span>{Math.round((muted ? 0 : volume) * 100)}%</span>
              </div>}
            </div>
          </div>

          {loading ? <div className="music-loading"><RefreshCw size={17} className="is-spinning" /> 正在读取歌单…</div> : isPlaylistOpen && (
            <div className="music-track-list">
              {(playlist?.tracks || []).map((track: MusicTrack, index) => (
                <button type="button" className={`music-track ${index === currentIndex ? "active" : ""}`} key={track.id} onClick={() => void playCloudAt(index)}>
                  <span className="music-track-index">{index === currentIndex && playing ? <Music2 size={13} /> : index + 1}</span>
                  <span className="music-track-copy"><strong>{track.name}</strong><small>{track.artists}{track.album ? ` · ${track.album}` : ""}</small></span>
                  <span>{formatTime(track.durationMs / 1000)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && <div className="music-error">{error}</div>}
      <audio ref={audioRef} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => adjacent(1)} onError={() => setError("音频无法播放：文件可能已移动，或格式不受 Chromium 支持")} />
    </section>
  );
}
