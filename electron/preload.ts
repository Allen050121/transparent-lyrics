import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("transparentLyrics", {
  platform: process.platform,
  openAudioFiles: () => ipcRenderer.invoke("library:open-audio"),
  loadAudioFile: (filePath: string) => ipcRenderer.invoke("library:load-audio", filePath),
  openLrcFiles: () => ipcRenderer.invoke("library:open-lrc"),
  openImageFile: () => ipcRenderer.invoke("library:open-image"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
});
