import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from "electron";
import log from "electron-log";
import updaterPkg, { type UpdateInfo } from "electron-updater";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLyricsProviders, searchLyricsWithProviders, type LyricsSearchQuery } from "./lyricsProviders.js";
import { createLocalFileMusicSource } from "./musicSources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { autoUpdater } = updaterPkg;
const isDev = !app.isPackaged;
const preloadPath = isDev
  ? path.join(__dirname, "../electron/preload.cjs")
  : path.join(__dirname, "preload.cjs");
const appIconPath = isDev
  ? path.join(__dirname, "../build/icon.png")
  : path.join(__dirname, "../build/icon.png");
let mainWindow: BrowserWindow | null = null;
let pendingUpdateVersion: string | undefined;
let updateCheckTimeout: ReturnType<typeof setTimeout> | undefined;
const releasePageUrl = "https://github.com/Allen050121/transparent-lyrics/releases";
const storageConfigFile = "storage.json";
const defaultStorageRoot = "D:\\TransparentLyricsData";
const updateCheckTimeoutMs = 25_000;
const lyricsProviders = createLyricsProviders();
const localMusicSource = createLocalFileMusicSource({ getStorageRoot });

type UpdaterStatus =
  | { status: "idle"; currentVersion: string }
  | { status: "checking"; currentVersion: string }
  | { status: "available"; currentVersion: string; version: string; releaseName?: string; releaseNotes?: string }
  | { status: "not-available"; currentVersion: string }
  | { status: "downloading"; currentVersion: string; version?: string; progress: number }
  | { status: "downloaded"; currentVersion: string; version: string; releaseName?: string }
  | { status: "error"; currentVersion: string; error: string };

if (isDev) {
  app.commandLine.appendSwitch("remote-debugging-port", "9222");
  app.commandLine.appendSwitch("disable-http-cache");
}

function normalizeReleaseNotes(notes: UpdateInfo["releaseNotes"]) {
  if (!notes) return undefined;
  if (typeof notes === "string") return notes;
  if (Array.isArray(notes)) {
    return notes
      .map((note) => {
        if (typeof note === "string") return note;
        return [note.version, note.note].filter(Boolean).join("\n");
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return String(notes);
}

function sendUpdaterStatus(status: UpdaterStatus) {
  log.info("[updater]", status);
  mainWindow?.webContents.send("updater:status", status);
}

function clearUpdateCheckTimeout() {
  if (!updateCheckTimeout) return;
  clearTimeout(updateCheckTimeout);
  updateCheckTimeout = undefined;
}

function sendUpdaterError(error: unknown) {
  clearUpdateCheckTimeout();
  sendUpdaterStatus({
    status: "error",
    currentVersion: app.getVersion(),
    error: error instanceof Error ? error.message : String(error),
  });
}

function startUpdateCheckTimeout() {
  clearUpdateCheckTimeout();
  updateCheckTimeout = setTimeout(() => {
    updateCheckTimeout = undefined;
    sendUpdaterStatus({
      status: "error",
      currentVersion: app.getVersion(),
      error: "Update check timed out. Please retry or open the GitHub Release page.",
    });
  }, updateCheckTimeoutMs);
}

function configureAutoUpdater() {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = true;

  autoUpdater.on("checking-for-update", () => {
    startUpdateCheckTimeout();
    sendUpdaterStatus({ status: "checking", currentVersion: app.getVersion() });
  });
  autoUpdater.on("update-available", (info) => {
    clearUpdateCheckTimeout();
    pendingUpdateVersion = info.version;
    sendUpdaterStatus({
      status: "available",
      currentVersion: app.getVersion(),
      version: info.version,
      releaseName: info.releaseName || undefined,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
    });
  });
  autoUpdater.on("update-not-available", () => {
    clearUpdateCheckTimeout();
    sendUpdaterStatus({ status: "not-available", currentVersion: app.getVersion() });
  });
  autoUpdater.on("download-progress", (progress) => {
    sendUpdaterStatus({
      status: "downloading",
      currentVersion: app.getVersion(),
      version: pendingUpdateVersion,
      progress: Math.max(0, Math.min(100, progress.percent || 0)),
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    clearUpdateCheckTimeout();
    pendingUpdateVersion = info.version;
    sendUpdaterStatus({
      status: "downloaded",
      currentVersion: app.getVersion(),
      version: info.version,
      releaseName: info.releaseName || undefined,
    });
  });
  autoUpdater.on("error", (error) => {
    sendUpdaterError(error);
  });
}

async function getStorageRoot() {
  const configPath = path.join(app.getPath("userData"), storageConfigFile);
  try {
    const parsed = JSON.parse(await fs.readFile(configPath, "utf8")) as { storageRoot?: string };
    if (parsed.storageRoot && path.isAbsolute(parsed.storageRoot)) {
      return parsed.storageRoot;
    }
  } catch {
    // Use the default below when no storage config exists yet.
  }
  return defaultStorageRoot;
}

async function writeStorageRoot(storageRoot: string) {
  if (!path.isAbsolute(storageRoot)) {
    throw new Error("Storage directory must be an absolute path.");
  }
  await fs.mkdir(storageRoot, { recursive: true });
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(
    path.join(app.getPath("userData"), storageConfigFile),
    JSON.stringify({ storageRoot }, null, 2),
    "utf8",
  );
  return storageRoot;
}

async function getStorageInfo() {
  const storageRoot = await getStorageRoot();
  await fs.mkdir(storageRoot, { recursive: true });
  return {
    storageRoot,
    mediaDir: path.join(storageRoot, "media-library"),
    legacyMediaDir: path.join(app.getPath("userData"), "media-library"),
    isDefault: storageRoot === defaultStorageRoot,
  };
}

async function copyDirectoryContents(sourceDir: string, targetDir: string) {
  try {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    await fs.mkdir(targetDir, { recursive: true });
    await Promise.all(entries.map(async (entry) => {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      if (entry.isDirectory()) {
        await copyDirectoryContents(sourcePath, targetPath);
        return;
      }
      if (entry.isFile()) {
        await fs.copyFile(sourcePath, targetPath);
      }
    }));
  } catch (error: any) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#101010",
    title: "",
    frame: false,
    icon: appIconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  if (isDev) {
    const devUrl = "http://127.0.0.1:5173";
    let emptyRootReloaded = false;
    win.webContents.session.clearCache().catch((error) => {
      log.warn("[dev] failed to clear renderer cache", error);
    }).finally(() => {
      win.loadURL(devUrl);
    });
    win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      if (validatedURL !== devUrl) return;
      log.warn("[dev] renderer load failed, retrying", { errorCode, errorDescription });
      setTimeout(() => {
        if (!win.isDestroyed()) win.loadURL(devUrl);
      }, 800);
    });
    win.webContents.on("did-finish-load", () => {
      setTimeout(() => {
        if (win.isDestroyed() || emptyRootReloaded) return;
        win.webContents.executeJavaScript("document.querySelector('#root')?.childElementCount ?? 0", true)
          .then((childCount) => {
            if (childCount > 0 || emptyRootReloaded || win.isDestroyed()) return;
            emptyRootReloaded = true;
            log.warn("[dev] renderer root is empty after load, reloading once");
            win.webContents.reloadIgnoringCache();
          })
          .catch((error) => {
            log.warn("[dev] failed to inspect renderer root", error);
          });
      }, 500);
    });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  win.setTitle("");
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  configureAutoUpdater();
  ipcMain.handle("library:open-audio", async () => {
    const result = await dialog.showOpenDialog({
      title: "瀵煎叆姝屾洸",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Audio", extensions: ["mp3", "flac", "wav", "ogg", "m4a", "aac"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled) return [];
    return localMusicSource.importFiles(result.filePaths);
  });

  ipcMain.handle("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle("window:toggle-maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle("app:get-version", () => app.getVersion());

  ipcMain.handle("app:open-user-data", async () => {
    await fs.mkdir(app.getPath("userData"), { recursive: true });
    await shell.openPath(app.getPath("userData"));
  });

  ipcMain.handle("app:open-releases", async () => {
    await shell.openExternal(releasePageUrl);
  });

  ipcMain.handle("app:clear-cache", async () => {
    const cacheTargets = [
      path.join(app.getPath("userData"), "Cache"),
      path.join(app.getPath("userData"), "Code Cache"),
      path.join(app.getPath("userData"), "GPUCache"),
      path.join(app.getPath("userData"), "DawnCache"),
      path.join(await getStorageRoot(), "cache"),
      path.join(await getStorageRoot(), "style-package-cache"),
    ];
    await Promise.allSettled(cacheTargets.map((targetPath) => fs.rm(targetPath, { recursive: true, force: true })));
    return { cleared: true };
  });

  ipcMain.handle("storage:get-info", async () => getStorageInfo());

  ipcMain.handle("storage:choose-root", async () => {
    const current = await getStorageInfo();
    const result = await dialog.showOpenDialog({
      title: "閫夋嫨 TransparentLyrics 鏁版嵁瀛樺偍鐩綍",
      defaultPath: current.storageRoot,
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return current;
    await writeStorageRoot(result.filePaths[0]);
    return getStorageInfo();
  });

  ipcMain.handle("storage:open-root", async () => {
    const info = await getStorageInfo();
    await shell.openPath(info.storageRoot);
    return info;
  });

  ipcMain.handle("storage:migrate-legacy-media", async () => {
    const info = await getStorageInfo();
    await copyDirectoryContents(info.legacyMediaDir, info.mediaDir);
    return info;
  });

  ipcMain.handle("updater:check", async () => {
    if (isDev) {
      const status: UpdaterStatus = { status: "not-available", currentVersion: app.getVersion() };
      sendUpdaterStatus(status);
      return status;
    }
    const status: UpdaterStatus = { status: "checking", currentVersion: app.getVersion() };
    startUpdateCheckTimeout();
    sendUpdaterStatus(status);
    autoUpdater.checkForUpdates().catch((error) => {
      log.warn("[updater] manual check failed", error);
      sendUpdaterError(error);
    });
    return status;
  });

  ipcMain.handle("updater:download", async () => {
    if (isDev) {
      const status: UpdaterStatus = { status: "not-available", currentVersion: app.getVersion() };
      sendUpdaterStatus(status);
      return status;
    }
    await autoUpdater.downloadUpdate();
    return { status: "downloading", currentVersion: app.getVersion(), progress: 0 } satisfies UpdaterStatus;
  });

  ipcMain.handle("updater:install", () => {
    if (!isDev) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  ipcMain.handle("library:scan-folder", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择音乐文件夹",
      properties: ["openDirectory"],
    });

    if (result.canceled || !result.filePaths[0]) return [];
    return localMusicSource.importFolder(result.filePaths[0]);
  });

  ipcMain.handle("library:read-audio-tags", async (_event, filePath: string) => localMusicSource.readAudioTags(filePath));

  ipcMain.handle("library:search-lyrics", async (_event, query: LyricsSearchQuery) => {
    return searchLyricsWithProviders(lyricsProviders, query);
  });

  ipcMain.handle("library:load-audio", async (_event, filePath: string) => {
    const bytes = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType =
      ext === ".mp3"
        ? "audio/mpeg"
        : ext === ".wav"
          ? "audio/wav"
          : ext === ".ogg"
            ? "audio/ogg"
            : ext === ".m4a" || ext === ".aac"
              ? "audio/mp4"
              : ext === ".flac"
                ? "audio/flac"
                : "audio/*";
    return {
      bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      mimeType,
    };
  });

  ipcMain.handle("library:open-lrc", async () => {
    const result = await dialog.showOpenDialog({
      title: "瀵煎叆姝岃瘝",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "LRC Lyrics", extensions: ["lrc"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("library:read-lrc", async (_event, filePath: string) => {
    return fs.readFile(filePath, "utf8");
  });

  ipcMain.handle("library:open-image", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择背景图片",
      properties: ["openFile"],
      filters: [
        { name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const imagePath = result.filePaths[0];
    const bytes = await fs.readFile(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType =
      ext === ".png" ? "image/png"
      : ext === ".webp" ? "image/webp"
      : ext === ".gif" ? "image/gif"
      : "image/jpeg";
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  });

  createMainWindow();
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((error) => {
        log.warn("[updater] startup check failed", error);
        sendUpdaterError(error);
      });
    }, 3500);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
