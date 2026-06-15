const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("transparentLyrics", {
  platform: process.platform,
  openAudioFiles: () => ipcRenderer.invoke("library:open-audio"),
  scanMusicFolder: () => ipcRenderer.invoke("library:scan-folder"),
  loadAudioFile: (filePath) => ipcRenderer.invoke("library:load-audio", filePath),
  readAudioTags: (filePath) => ipcRenderer.invoke("library:read-audio-tags", filePath),
  searchLyrics: (query) => ipcRenderer.invoke("library:search-lyrics", query),
  openLrcFiles: () => ipcRenderer.invoke("library:open-lrc"),
  readLrcFile: (filePath) => ipcRenderer.invoke("library:read-lrc", filePath),
  openImageFile: () => ipcRenderer.invoke("library:open-image"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  openUserDataFolder: () => ipcRenderer.invoke("app:open-user-data"),
  openReleasesPage: () => ipcRenderer.invoke("app:open-releases"),
  clearAppCache: () => ipcRenderer.invoke("app:clear-cache"),
  getStorageInfo: () => ipcRenderer.invoke("storage:get-info"),
  chooseStorageRoot: () => ipcRenderer.invoke("storage:choose-root"),
  openStorageRoot: () => ipcRenderer.invoke("storage:open-root"),
  migrateLegacyMedia: () => ipcRenderer.invoke("storage:migrate-legacy-media"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  downloadUpdate: () => ipcRenderer.invoke("updater:download"),
  installUpdate: () => ipcRenderer.invoke("updater:install"),
  onUpdaterStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("updater:status", listener);
    return () => ipcRenderer.removeListener("updater:status", listener);
  },
});
