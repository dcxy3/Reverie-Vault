const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("galLauncher", {
  loadReadingLibrary: () => ipcRenderer.invoke("reader:load"),
  saveReadingLibrary: (items) => ipcRenderer.invoke("reader:save", items),
  pickReadingItems: (kind) => ipcRenderer.invoke("dialog:pickReadingItems", kind),
  readNovel: (item) => ipcRenderer.invoke("reader:readNovel", item),
  readManga: (item) => ipcRenderer.invoke("reader:readManga", item),
  readMangaChapter: (item, filePath) => ipcRenderer.invoke("reader:readMangaChapter", item, filePath),
  onReadingContentChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("reader:contentChanged", listener);
    return () => ipcRenderer.removeListener("reader:contentChanged", listener);
  },
  onAltKeyChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("reader:altKeyChanged", listener);
    return () => ipcRenderer.removeListener("reader:altKeyChanged", listener);
  },
  findReadingCoverCandidates: (item) => ipcRenderer.invoke("reader:findCoverCandidates", item),
  loadLibrary: () => ipcRenderer.invoke("library:load"),
  saveLibrary: (games) => ipcRenderer.invoke("library:save", games),
  pickLaunchFile: () => ipcRenderer.invoke("dialog:pickLaunchFile"),
  exportLibrary: (games) => ipcRenderer.invoke("library:export", games),
  importLibrary: () => ipcRenderer.invoke("library:import"),
  pickImage: () => ipcRenderer.invoke("dialog:pickImage"),
  pickFolder: () => ipcRenderer.invoke("dialog:pickFolder"),
  rescanMetadata: (game) => ipcRenderer.invoke("game:rescanMetadata", game),
  enrichOnlineMetadata: (game) => ipcRenderer.invoke("game:enrichOnlineMetadata", game),
  searchMetadataCandidates: (game, keyword) => ipcRenderer.invoke("game:searchMetadataCandidates", game, keyword),
  applyMetadataCandidate: (game, candidate) => ipcRenderer.invoke("game:applyMetadataCandidate", game, candidate),
  findCoverCandidates: (game) => ipcRenderer.invoke("game:findCoverCandidates", game),
  lookupBangumiRating: (game) => ipcRenderer.invoke("game:lookupBangumiRating", game),
  readImageDataUrl: (path) => ipcRenderer.invoke("image:readDataUrl", path),
  sampleButtonPalette: (path) => ipcRenderer.invoke("image:sampleButtonPalette", path),
  launchGame: (game) => ipcRenderer.invoke("game:launch", game),
  onPlaySessionEnded: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("game:sessionEnded", listener);
    return () => ipcRenderer.removeListener("game:sessionEnded", listener);
  }
});
