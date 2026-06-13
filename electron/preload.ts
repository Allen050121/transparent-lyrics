import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("transparentLyrics", {
  platform: process.platform,
  openAudioFiles: () => ipcRenderer.invoke("library:open-audio"),
  loadAudioFile: (filePath: string) => ipcRenderer.invoke("library:load-audio", filePath),
  openLrcFiles: () => ipcRenderer.invoke("library:open-lrc"),
  openImageFile: () => ipcRenderer.invoke("library:open-image"),
});
