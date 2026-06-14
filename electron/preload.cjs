const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("transparentLyrics", {
  platform: process.platform,
  openAudioFiles: () => ipcRenderer.invoke("library:open-audio"),
  scanMusicFolder: () => ipcRenderer.invoke("library:scan-folder"),
  loadAudioFile: (filePath) => ipcRenderer.invoke("library:load-audio", filePath),
  readAudioTags: (filePath) => ipcRenderer.invoke("library:read-audio-tags", filePath),
  searchLyrics: (query) => ipcRenderer.invoke("library:search-lyrics", query),
  openLrcFiles: () => ipcRenderer.invoke("library:open-lrc"),
  openImageFile: () => ipcRenderer.invoke("library:open-image"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  downloadUpdate: () => ipcRenderer.invoke("updater:download"),
  installUpdate: () => ipcRenderer.invoke("updater:install"),
  onUpdaterStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("updater:status", listener);
    return () => ipcRenderer.removeListener("updater:status", listener);
  },
});
