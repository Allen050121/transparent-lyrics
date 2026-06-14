import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFile } from "music-metadata";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const preloadPath = isDev
  ? path.join(__dirname, "../electron/preload.cjs")
  : path.join(__dirname, "preload.cjs");
const audioExtensions = new Set([".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac"]);

if (isDev) {
  app.commandLine.appendSwitch("remote-debugging-port", "9222");
}

async function copyToLibrary(filePath: string, index: number) {
  const parsed = path.parse(filePath);
  const mediaDir = path.join(app.getPath("userData"), "media-library");
  await fs.mkdir(mediaDir, { recursive: true });
  const safeName = `${Date.now()}-${index}${parsed.ext.toLowerCase()}`;
  const storedPath = path.join(mediaDir, safeName);
  await fs.copyFile(filePath, storedPath);
  return storedPath;
}

function parseTitleArtistFromFilename(filePath: string) {
  const name = path.parse(filePath).name.replace(/[_]+/g, " ").trim();
  const [artist, ...titleParts] = name.split(/\s+-\s+/);
  if (titleParts.length) {
    return {
      title: titleParts.join(" - ").trim(),
      artist: artist.trim(),
    };
  }
  return { title: name, artist: "" };
}

async function readAudioInfo(filePath: string) {
  const fallback = parseTitleArtistFromFilename(filePath);
  try {
    const metadata = await parseFile(filePath, { duration: true });
    const common = metadata.common;
    const ext = path.extname(filePath).replace(".", "").toUpperCase();
    return {
      title: common.title || fallback.title,
      artist: common.artist || fallback.artist || "本地音乐",
      album: common.album || "Local Library",
      duration: metadata.format.duration || 0,
      format: ext || metadata.format.container || "AUDIO",
    };
  } catch {
    return {
      title: fallback.title,
      artist: fallback.artist || "本地音乐",
      album: "Local Library",
      duration: 0,
      format: path.extname(filePath).replace(".", "").toUpperCase() || "AUDIO",
    };
  }
}

async function collectAudioFiles(directory: string) {
  const results: string[] = [];
  async function walk(current: string) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      console.warn("[Transparent Lyrics] Skip unreadable music folder", current, error);
      return;
    }
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(nextPath);
        continue;
      }
      if (entry.isFile() && audioExtensions.has(path.extname(entry.name).toLowerCase())) {
        results.push(nextPath);
      }
    }
  }
  await walk(directory);
  return results;
}

async function buildImportedAudio(filePath: string, index: number) {
  const storedPath = await copyToLibrary(filePath, index);
  const info = await readAudioInfo(filePath);
  return {
    ...info,
    path: storedPath,
    originalPath: filePath,
    ext: info.format,
  };
}

function scoreLyricsCandidate(candidate: any, query: any) {
  const title = String(candidate.trackName ?? "").toLowerCase();
  const artist = String(candidate.artistName ?? "").toLowerCase();
  const album = String(candidate.albumName ?? "").toLowerCase();
  let score = 0;
  if (query.title && title === String(query.title).toLowerCase()) score += 5;
  if (query.artist && artist === String(query.artist).toLowerCase()) score += 4;
  if (query.album && album === String(query.album).toLowerCase()) score += 2;
  if (candidate.syncedLyrics) score += 3;
  if (query.duration && candidate.duration) {
    const diff = Math.abs(Number(candidate.duration) - Number(query.duration));
    if (diff <= 2) score += 3;
    else if (diff <= 6) score += 1;
  }
  return score;
}

function buildLyricsSearchQueries(query: {
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
}) {
  const artists = String(query.artist ?? "")
    .split(/[,，/&、]| feat\.? | ft\.? /i)
    .map((artist) => artist.trim())
    .filter(Boolean);
  const primaryArtist = artists[0] || query.artist;
  const candidates = [
    query,
    { ...query, artist: primaryArtist, album: undefined },
    { ...query, artist: undefined, album: undefined },
    { ...query, artist: primaryArtist, album: undefined, duration: undefined },
    { ...query, artist: undefined, album: undefined, duration: undefined },
  ];
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchLrclibOnce(query: {
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
}) {
  const params = new URLSearchParams();
  params.set("track_name", query.title);
  if (query.artist) params.set("artist_name", query.artist);
  if (query.album) params.set("album_name", query.album);
  if (query.duration && Number.isFinite(query.duration)) params.set("duration", String(Math.round(query.duration)));

  const response = await fetch(`https://lrclib.net/api/search?${params.toString()}`, {
    headers: {
      "User-Agent": "TransparentLyrics/0.1.0 (local personal music player)",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    return { ok: false as const, error: `LRCLIB ${response.status}` };
  }
  const candidates = await response.json();
  return { ok: true as const, candidates: Array.isArray(candidates) ? candidates : [], query };
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
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  win.setTitle("");
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ipcMain.handle("library:open-audio", async () => {
    const result = await dialog.showOpenDialog({
      title: "导入歌曲",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Audio", extensions: ["mp3", "flac", "wav", "ogg", "m4a", "aac"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled) return [];
    return Promise.all(result.filePaths.map(async (filePath, index) => buildImportedAudio(filePath, index)));
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

  ipcMain.handle("library:scan-folder", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择音乐文件夹",
      properties: ["openDirectory"],
    });

    if (result.canceled || !result.filePaths[0]) return [];
    const files = await collectAudioFiles(result.filePaths[0]);
    return Promise.all(files.map(async (filePath, index) => buildImportedAudio(filePath, index)));
  });

  ipcMain.handle("library:read-audio-tags", async (_event, filePath: string) => readAudioInfo(filePath));

  ipcMain.handle("library:search-lyrics", async (_event, query: {
    title: string;
    artist?: string;
    album?: string;
    duration?: number;
  }) => {
    try {
      let lastCandidates: any[] = [];
      let lastError = "";
      for (const searchQuery of buildLyricsSearchQueries(query)) {
        const searchResult = await searchLrclibOnce(searchQuery);
        if (!searchResult.ok) {
          lastError = searchResult.error;
          continue;
        }
        const candidates = searchResult.candidates;
        lastCandidates = candidates.length ? candidates : lastCandidates;
        if (!candidates.length) {
          continue;
        }
        const sorted = candidates
          .map((candidate) => ({ candidate, score: scoreLyricsCandidate(candidate, searchQuery) }))
          .sort((left, right) => right.score - left.score);
        const best = sorted[0]?.candidate;
        if (!best?.syncedLyrics && !best?.plainLyrics) {
          continue;
        }
        return {
          status: "matched",
          source: "lrclib",
          id: best.id,
          trackName: best.trackName,
          artistName: best.artistName,
          albumName: best.albumName,
          duration: best.duration,
          syncedLyrics: best.syncedLyrics || undefined,
          plainLyrics: best.plainLyrics || undefined,
          candidates,
        };
      }
      if (lastError && !lastCandidates.length) {
        return { status: "failed", error: lastError };
      }
      return { status: "not-found", candidates: lastCandidates };
    } catch (error) {
      return { status: "failed", error: error instanceof Error ? error.message : String(error) };
    }
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
      title: "导入歌词",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "LRC Lyrics", extensions: ["lrc"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("library:open-image", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择背景图",
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
