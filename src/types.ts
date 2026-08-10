export type GameStatus = "想玩" | "未开始" | "进行中" | "已通关" | "搁置";

export interface PlaySession {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

export interface Game {
  id: string;
  title: string;
  originalTitle: string;
  description: string;
  developer: string;
  releaseDate: string;
  installPath: string;
  executablePath: string;
  workingDirectory: string;
  coverPath: string;
  backgroundPath: string;
  status: GameStatus;
  tags: string[];
  rating: number;
  bgmScore?: number;
  bgmScoreCount?: number;
  bgmRank?: number;
  bgmId?: number;
  bgmRatingCheckedAt?: string;
  playCount: number;
  totalPlaySeconds?: number;
  currentSessionId?: string | null;
  currentSessionStartedAt?: string | null;
  lastPlayedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sessions?: PlaySession[];
}

export interface LaunchResult {
  launched: boolean;
  sessionId?: string;
  startedAt?: string;
}

export interface PlaySessionEndedEvent {
  gameId: string;
  sessionId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  totalPlaySeconds?: number;
  sessions?: PlaySession[];
}

export interface PickedLaunchFile {
  title: string;
  originalTitle?: string;
  description?: string;
  developer?: string;
  releaseDate?: string;
  coverPath?: string;
  backgroundPath?: string;
  tags?: string[];
  executablePath: string;
  installPath: string;
  workingDirectory: string;
}

export type ReadingItemKind = "novel" | "manga";

export interface ReadingItem {
  id: string;
  title: string;
  kind: ReadingItemKind;
  filePath: string;
  format: string;
  importedAt: string;
  lastReadPage?: number;
  lastReadChapter?: string;
  lastReadAt?: string;
  totalReadingSeconds?: number;
  coverUrl?: string;
  coverPath?: string;
  coverSource?: string;
}

export type PickedReadingItem = Omit<ReadingItem, "id" | "importedAt">;

export interface ReadingTextDocument {
  title: string;
  content?: string;
  chapters?: Array<{ title: string; content: string }>;
}

export interface ReadingMangaChapter {
  title: string;
  filePath: string;
}

export interface ReadingMangaDocument {
  title: string;
  chapters: ReadingMangaChapter[];
}

export interface ReadingCoverCandidate {
  id: string;
  title: string;
  source: string;
  imageUrl: string;
  score: number;
  reason: string;
}

export interface CoverCandidate {
  id: string;
  title: string;
  source: string;
  path: string;
  width: number;
  height: number;
  score: number;
  reason: string;
}

export interface MetadataCandidate {
  source: string;
  sourceId: string;
  confidence: number;
  matchedQuery?: string;
  title: string;
  originalTitle: string;
  developer: string;
  releaseDate: string;
  descriptionPreview: string;
  coverUrl: string;
}

export interface LauncherApi {
  loadLibrary: () => Promise<Game[]>;
  saveLibrary: (games: Game[]) => Promise<Game[]>;
  loadReadingLibrary: () => Promise<ReadingItem[]>;
  saveReadingLibrary: (items: ReadingItem[]) => Promise<ReadingItem[]>;
  pickReadingItems: (kind: ReadingItemKind) => Promise<PickedReadingItem[]>;
  readNovel: (item: ReadingItem) => Promise<ReadingTextDocument>;
  readManga: (item: ReadingItem) => Promise<ReadingMangaDocument>;
  readMangaChapter: (item: ReadingItem, filePath: string) => Promise<ArrayBuffer>;
  onReadingContentChanged: (callback: (payload: { itemId: string }) => void) => () => void;
  onAltKeyChanged: (callback: (payload: { pressed: boolean }) => void) => () => void;
  toggleFullscreen: () => Promise<boolean>;
  openCiallo: () => Promise<void>;
  readCialloAudio: () => Promise<ArrayBuffer>;
  getMusicSession: () => Promise<{ loggedIn: boolean; profile?: MusicProfile }>;
  createMusicQr: () => Promise<{ key: string; qrimg: string }>;
  checkMusicQr: (key: string) => Promise<{ code: number; message: string; loggedIn: boolean; profile?: MusicProfile }>;
  getLikedMusicPlaylist: () => Promise<MusicPlaylist>;
  getMusicSongUrl: (id: string) => Promise<{ url: string; type: string; level: string }>;
  logoutMusic: () => Promise<void>;
  onFullscreenChanged: (callback: (payload: { fullscreen: boolean }) => void) => () => void;
  findReadingCoverCandidates: (item: ReadingItem) => Promise<ReadingCoverCandidate[]>;
  exportLibrary: (games: Game[], readingItems: ReadingItem[]) => Promise<string>;
  importLibrary: () => Promise<{ games: Game[]; readingItems: ReadingItem[]; version: number } | null>;
  pickLaunchFile: () => Promise<PickedLaunchFile | null>;
  pickImage: () => Promise<string | null>;
  pickFolder: () => Promise<string | null>;
  rescanMetadata: (game: Game) => Promise<Partial<PickedLaunchFile>>;
  enrichOnlineMetadata: (game: Game) => Promise<Partial<PickedLaunchFile> & { confidence?: number; source?: string; sourceId?: string }>;
  searchMetadataCandidates: (game: Game, keyword?: string) => Promise<MetadataCandidate[]>;
  applyMetadataCandidate: (game: Game, candidate: MetadataCandidate) => Promise<Partial<PickedLaunchFile> & { confidence?: number; source?: string; sourceId?: string }>;
  findCoverCandidates: (game: Game) => Promise<CoverCandidate[]>;
  lookupBangumiRating: (game: Game) => Promise<Partial<Game>>;
  readImageDataUrl: (path: string) => Promise<string>;
  sampleButtonPalette: (path: string) => Promise<{ actionRgb: string; chromeRgb: string } | null>;
  launchGame: (game: Game) => Promise<LaunchResult>;
  onPlaySessionEnded: (callback: (event: PlaySessionEndedEvent) => void) => () => void;
}

export interface MusicProfile {
  userId: string;
  nickname: string;
  avatarUrl: string;
}

export interface MusicTrack {
  id: string;
  name: string;
  artists: string;
  album: string;
  coverUrl: string;
  durationMs: number;
}

export interface MusicPlaylist {
  id: string;
  name: string;
  coverUrl: string;
  trackCount: number;
  tracks: MusicTrack[];
}

declare global {
  interface Window {
    galLauncher: LauncherApi;
  }
}
