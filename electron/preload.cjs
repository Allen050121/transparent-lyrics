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
});
