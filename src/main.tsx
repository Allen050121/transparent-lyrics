import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { ManualLyricsDialog } from "./ManualLyricsDialog";
import { SideNav, TopBar, WindowChrome } from "./components/AppChrome";
import { Icon } from "./components/Icon";
import { PlayerBar } from "./components/PlayerBar";
import { defaultLyricStyle, normalizeLyricStyle } from "./lyricStyles";
import { defaultCover, formatDuration, getCover } from "./media";
import { ImportPage } from "./pages/ImportPage";
import { LibraryPage } from "./pages/LibraryPage";
import { LyricsPage } from "./pages/LyricsPage";
import { MiniPage } from "./pages/MiniPage";
import { PlaylistPage } from "./pages/PlaylistPage";
import { RecentPage } from "./pages/RecentPage";
import { SettingsPage } from "./pages/SettingsPage";
import { parseLrcLines, type LyricsCandidate, type ManualLyricsState } from "./lyrics";
import type { LyricPreset, LyricStyle, Track, TrackLyrics, View } from "./types";

function readCustomLyricPresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(customLyricPresetsKey) ?? "[]") as LyricPreset[];
    return Array.isArray(parsed)
      ? parsed
          .filter((preset) => preset?.id && preset?.name && preset?.style)
          .map((preset) => ({ ...preset, custom: true, style: normalizeLyricStyle(preset.style) }))
      : [];
  } catch {
    return [];
  }
}

function writeCustomLyricPresets(presets: LyricPreset[]) {
  localStorage.setItem(customLyricPresetsKey, JSON.stringify(presets.map((preset) => ({
    ...preset,
    custom: true,
    style: normalizeLyricStyle(preset.style),
  }))));
}

const placeholderTrack: Track = {
  id: "placeholder",
  title: "\u6682\u65e0\u64ad\u653e",
  artist: "\u5bfc\u5165\u6b4c\u66f2\u540e\u5f00\u59cb\u64ad\u653e",
  album: "",
  duration: 0,
  durationLabel: "00:00",
  added: "",
  format: "",
  lyricStyle: normalizeLyricStyle(),
  lyrics: { source: "lrclib", status: "unmatched" },
};

const libraryKey = "transparent-lyrics:library:v1";
const activeTrackKey = "transparent-lyrics:active-track:v1";
const recentTrackIdsKey = "transparent-lyrics:recent-track-ids:v1";
const lyricStyleKey = "transparent-lyrics:lyric-style:v1";
const customLyricPresetsKey = "transparent-lyrics:custom-lyric-presets:v1";
const recentTrackLimit = 200;
const reimportLabel = "\u9700\u91cd\u65b0\u5bfc\u5165";
const localMusicLabel = "\u672c\u5730\u97f3\u4e50";
const justNowLabel = "\u521a\u521a";

function readGlobalLyricStyle() {
  try {
    const parsed = JSON.parse(localStorage.getItem(lyricStyleKey) ?? "null") as Partial<LyricStyle> | null;
    return normalizeLyricStyle(parsed ?? undefined);
  } catch {
    return normalizeLyricStyle();
  }
}

function writeGlobalLyricStyle(style: LyricStyle) {
  localStorage.setItem(lyricStyleKey, JSON.stringify(normalizeLyricStyle(style)));
}

function getEffectiveLyricStyle(track: Track, tracks: Track[], globalStyle: LyricStyle) {
  const isLibraryTrack = tracks.some((item) => item.id === track.id);
  return isLibraryTrack
    ? normalizeLyricStyle({ ...globalStyle, ...track.lyricStyle })
    : normalizeLyricStyle(globalStyle);
}

function createTrackFromImportedFile(file: ImportedAudioFile, index: number): Track {
  const title = file.title || file.name || "\u672c\u5730\u97f3\u4e50";
  const duration = Number(file.duration ?? 0);
  return {
    id: `track-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    artist: file.artist || localMusicLabel,
    album: file.album || "Local Library",
    duration,
    durationLabel: formatDuration(duration),
    added: justNowLabel,
    format: file.format || file.ext || "AUDIO",
    path: file.path,
    originalPath: file.originalPath,
    url: file.url,
    lyrics: { source: "lrclib", status: "unmatched" },
    lyricStyle: normalizeLyricStyle(),
  };
}

function mergeImportedTracks(imported: Track[], currentTracks: Track[]) {
  const seen = new Set<string>();
  const keyOf = (track: Track) => track.originalPath || track.path || track.url || `${track.title}:${track.artist}`;
  const merged = [...imported, ...currentTracks.filter((track) => !track.id.startsWith("demo-"))];
  return merged.filter((track) => {
    const key = keyOf(track);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createDemoAudioUrl(trackId: string) {
  const seconds = 12;
  const sampleRate = 44_100;
  const channels = 1;
  const bitsPerSample = 16;
  const dataSize = seconds * sampleRate * channels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  const seed = trackId.charCodeAt(trackId.length - 1) || 1;
  const frequency = 220 + seed * 55;
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
  view.setUint16(32, channels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let index = 0; index < seconds * sampleRate; index += 1) {
    const fadeIn = Math.min(1, index / (sampleRate * 0.05));
    const fadeOut = Math.min(1, (seconds * sampleRate - index) / (sampleRate * 0.15));
    const envelope = Math.min(fadeIn, fadeOut);
    const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.18 * envelope;
    view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
    offset += 2;
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function readLibrary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(libraryKey) ?? "null") as Track[] | null;
    const migrated: Track[] =
      parsed?.reduce<Track[]>((acc, track) => {
        if (track.added === reimportLabel) {
          return acc;
        }
        acc.push({
          ...track,
          url: track.url?.startsWith("blob:") ? undefined : track.url,
          lyrics: track.lyrics ?? { source: "lrclib", status: "unmatched" },
          lyricStyle: normalizeLyricStyle(track.lyricStyle),
        });
        return acc;
      }, []) ?? [];
    return migrated;
  } catch {
    return [];
  }
}

function writeLibrary(tracks: Track[]) {
  const cleaned = tracks.filter((track) => !track.url?.startsWith("blob:") && track.added !== reimportLabel);
  localStorage.setItem(libraryKey, JSON.stringify(cleaned));
}

function readRecentTrackIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentTrackIdsKey) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string").slice(0, recentTrackLimit)
      : [];
  } catch {
    return [];
  }
}

function writeRecentTrackIds(trackIds: string[]) {
  localStorage.setItem(recentTrackIdsKey, JSON.stringify(trackIds.slice(0, recentTrackLimit)));
}

function App() {
  const [view, setView] = useState<View>("main");
  const [selectedPlaylist, setSelectedPlaylist] = useState("\u6df1\u591c\u6c89\u6d78");
  const [history, setHistory] = useState<View[]>(["main"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tracks, setTracks] = useState<Track[]>(readLibrary);
  const [activeTrackId, setActiveTrackId] = useState(() => localStorage.getItem(activeTrackKey) ?? readLibrary()[0]?.id);
  const [recentTrackIds, setRecentTrackIds] = useState<string[]>(readRecentTrackIds);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [matchingLyrics, setMatchingLyrics] = useState(false);
  const [globalLyricStyle, setGlobalLyricStyle] = useState<LyricStyle>(readGlobalLyricStyle);
  const [customLyricPresets, setCustomLyricPresets] = useState<LyricPreset[]>(readCustomLyricPresets);
  const [manualLyrics, setManualLyrics] = useState<ManualLyricsState>({
    open: false,
    trackId: "",
    title: "",
    artist: "",
    album: "",
    pasteText: "",
    searching: false,
    error: "",
    candidates: [],
  });
  const [imageImportTarget, setImageImportTarget] = useState<"background" | "cover">("background");
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus>({ status: "idle", currentVersion: "0.1.0" });
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlsRef = useRef<Map<string, string>>(new Map());
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);
  const activeTrack = tracks.find((track) => track.id === activeTrackId) ?? tracks[0] ?? placeholderTrack;
  const effectiveLyricStyle = useMemo(
    () => getEffectiveLyricStyle(activeTrack, tracks, globalLyricStyle),
    [activeTrack, globalLyricStyle, tracks],
  );
  const recentTracks = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return recentTrackIds
      .map((trackId) => byId.get(trackId))
      .filter((track): track is Track => Boolean(track));
  }, [recentTrackIds, tracks]);

  useEffect(() => {
    if (activeTrack.id === activeTrackId) return;
    setActiveTrackId(activeTrack.id);
    localStorage.setItem(activeTrackKey, activeTrack.id);
  }, [activeTrack.id, activeTrackId]);

  const navigate = useCallback(
    (nextView: View) => {
      if (nextView === view) return;
      setView(nextView);
      setHistory((current) => {
        const next = [...current.slice(0, historyIndex + 1), nextView];
        setHistoryIndex(next.length - 1);
        return next;
      });
    },
    [historyIndex, view],
  );

  const navigatePlaylist = useCallback((playlistName: string) => {
    setSelectedPlaylist(playlistName);
    navigate("playlist");
  }, [navigate]);

  const goBack = useCallback(() => {
    setHistoryIndex((currentIndex) => {
      const nextIndex = Math.max(0, currentIndex - 1);
      setView(history[nextIndex] ?? "main");
      return nextIndex;
    });
  }, [history]);

  const goForward = useCallback(() => {
    setHistoryIndex((currentIndex) => {
      const nextIndex = Math.min(history.length - 1, currentIndex + 1);
      setView(history[nextIndex] ?? view);
      return nextIndex;
    });
  }, [history, view]);

  const commitTracks = useCallback((nextTracks: Track[]) => {
    setTracks(nextTracks);
    writeLibrary(nextTracks);
  }, []);

  const matchLyricsForTrack = useCallback(async (track: Track): Promise<Track> => {
    if (!window.transparentLyrics?.searchLyrics) {
      return { ...track, lyrics: { source: "lrclib", status: "failed", error: "Lyrics API is unavailable" } };
    }
    const result = await window.transparentLyrics.searchLyrics({
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
    });
    if (result.status === "matched") {
      return {
        ...track,
        title: result.trackName || track.title,
        artist: result.artistName || track.artist,
        album: result.albumName || track.album,
        duration: result.duration || track.duration,
        durationLabel: result.duration ? formatDuration(result.duration) : track.durationLabel,
        lyrics: {
          source: "lrclib",
          status: "matched",
          syncedText: result.syncedLyrics,
          plainText: result.plainLyrics,
          matchedAt: new Date().toISOString(),
          providerId: result.id,
        },
      };
    }
    if (result.status === "not-found") {
      return { ...track, lyrics: { source: "lrclib", status: "not-found", matchedAt: new Date().toISOString() } };
    }
    return {
      ...track,
      lyrics: {
        source: "lrclib",
        status: "failed",
        matchedAt: new Date().toISOString(),
        error: result.error,
      },
    };
  }, []);

  const applyLyricsToTrack = useCallback((trackId: string, lyrics: TrackLyrics, metadata?: Partial<Track>) => {
    commitTracks(tracks.map((track) =>
      track.id === trackId
        ? ({
            ...track,
            ...(metadata?.title ? { title: metadata.title } : {}),
            ...(metadata?.artist ? { artist: metadata.artist } : {}),
            ...(metadata?.album ? { album: metadata.album } : {}),
            ...(metadata?.duration ? { duration: metadata.duration, durationLabel: formatDuration(metadata.duration) } : {}),
            ...(metadata?.lrcPath ? { lrcPath: metadata.lrcPath } : {}),
            lyrics,
          })
        : track,
    ));
  }, [commitTracks, tracks]);

  const openManualLyrics = useCallback((track: Track) => {
    setManualLyrics({
      open: true,
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      pasteText: track.lyrics?.syncedText || track.lyrics?.plainText || "",
      searching: false,
      error: track.lyrics?.error || "",
      candidates: [],
    });
  }, []);

  const closeManualLyrics = useCallback(() => {
    setManualLyrics((current) => ({ ...current, open: false, searching: false }));
  }, []);

  const searchManualLyrics = useCallback(async () => {
    const track = tracks.find((item) => item.id === manualLyrics.trackId);
    if (!track || !window.transparentLyrics?.searchLyrics) return;
    setManualLyrics((current) => ({ ...current, searching: true, error: "", candidates: [] }));
    const result = await window.transparentLyrics.searchLyrics({
      title: manualLyrics.title.trim() || track.title,
      artist: manualLyrics.artist.trim() || undefined,
      album: manualLyrics.album.trim() || undefined,
      duration: track.duration,
    });
    if (result.status === "matched") {
      setManualLyrics((current) => ({
        ...current,
        searching: false,
        candidates: result.candidates?.length
          ? result.candidates
          : [{
              id: result.id,
              trackName: result.trackName,
              artistName: result.artistName,
              albumName: result.albumName,
              duration: result.duration,
              syncedLyrics: result.syncedLyrics,
              plainLyrics: result.plainLyrics,
            }],
      }));
      return;
    }
    if (result.status === "not-found") {
      setManualLyrics((current) => ({
        ...current,
        searching: false,
        candidates: result.candidates ?? [],
        error: result.candidates?.length ? "" : "\u6ca1\u6709\u627e\u5230\u5019\u9009\u6b4c\u8bcd\uff0c\u53ef\u4ee5\u6539\u5173\u952e\u8bcd\u6216\u7c98\u8d34 LRC\u3002",
      }));
      return;
    }
    setManualLyrics((current) => ({
      ...current,
      searching: false,
      error: result.error || "\u6b4c\u8bcd\u641c\u7d22\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002",
    }));
  }, [manualLyrics.album, manualLyrics.artist, manualLyrics.title, manualLyrics.trackId, tracks]);

  const saveLyricsCandidate = useCallback((candidate: LyricsCandidate) => {
    if (!manualLyrics.trackId) return;
    applyLyricsToTrack(
      manualLyrics.trackId,
      {
        source: "lrclib",
        status: "matched",
        syncedText: candidate.syncedLyrics,
        plainText: candidate.plainLyrics,
        matchedAt: new Date().toISOString(),
        providerId: candidate.id,
      },
      {
        title: candidate.trackName,
        artist: candidate.artistName,
        album: candidate.albumName,
        duration: candidate.duration,
      },
    );
    closeManualLyrics();
  }, [applyLyricsToTrack, closeManualLyrics, manualLyrics.trackId]);

  const savePastedLyrics = useCallback(() => {
    const text = manualLyrics.pasteText.trim();
    if (!manualLyrics.trackId || !text) {
      setManualLyrics((current) => ({ ...current, error: "\u8bf7\u5148\u7c98\u8d34 LRC \u6216\u666e\u901a\u6b4c\u8bcd\u6587\u672c\u3002" }));
      return;
    }
    const isSynced = parseLrcLines(text).length > 0;
    applyLyricsToTrack(manualLyrics.trackId, {
      source: "manual",
      status: "matched",
      syncedText: isSynced ? text : undefined,
      plainText: isSynced ? undefined : text,
      matchedAt: new Date().toISOString(),
    });
    closeManualLyrics();
  }, [applyLyricsToTrack, closeManualLyrics, manualLyrics.pasteText, manualLyrics.trackId]);

  const matchLyricsForTracks = useCallback(
    async (targetTracks: Track[]) => {
      if (!targetTracks.length) return targetTracks;
      setMatchingLyrics(true);
      const nextTracks: Track[] = [];
      for (const track of targetTracks) {
        nextTracks.push(await matchLyricsForTrack(track));
      }
      setMatchingLyrics(false);
      return nextTracks;
    },
    [matchLyricsForTrack],
  );

  const matchAllLyrics = useCallback(async () => {
    const matched = await matchLyricsForTracks(tracks.filter((track) => !track.id.startsWith("demo-")));
    const matchedById = new Map(matched.map((track) => [track.id, track]));
    const nextTracks = tracks.map((track) => matchedById.get(track.id) ?? track);
    commitTracks(nextTracks);
  }, [commitTracks, matchLyricsForTracks, tracks]);

  const retryLyricsForTrack = useCallback(async (trackId: string) => {
    const targetTrack = tracks.find((track) => track.id === trackId);
    if (!targetTrack || targetTrack.id.startsWith("demo-")) return;
    const matched = await matchLyricsForTrack(targetTrack);
    commitTracks(tracks.map((track) => (track.id === matched.id ? matched : track)));
  }, [commitTracks, matchLyricsForTrack, tracks]);

  const ensurePlayableUrl = useCallback(async (track: Track) => {
    if (track.url && !track.url.startsWith("blob:")) return track.url;
    const cached = objectUrlsRef.current.get(track.id);
    if (cached) return cached;
    if (!track.path || !window.transparentLyrics?.loadAudioFile) {
      if (track.id.startsWith("demo-")) {
        const demoUrl = createDemoAudioUrl(track.id);
        objectUrlsRef.current.set(track.id, demoUrl);
        return demoUrl;
      }
      return track.url;
    }
    const payload = await window.transparentLyrics.loadAudioFile(track.path);
    const blob = new Blob([payload.bytes], { type: payload.mimeType });
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.set(track.id, url);
    return url;
  }, []);

  const playTrack = useCallback(
    async (trackId: string) => {
      const nextTrack = tracks.find((track) => track.id === trackId);
      if (!nextTrack) return;
      const playableUrl = await ensurePlayableUrl(nextTrack);
      setActiveTrackId(trackId);
      localStorage.setItem(activeTrackKey, trackId);
      if (!playableUrl) {
        setPlaying(false);
        console.warn("[Transparent Lyrics] Track has no playable source", nextTrack);
        return;
      }
      setCurrentTime(0);
      const audio = audioRef.current;
      if (audio) {
        if (audio.src !== playableUrl) {
          audio.src = playableUrl;
          audio.load();
        }
        audio.currentTime = 0;
        try {
          await audio.play();
          setPlaying(true);
          setRecentTrackIds((current) => {
            const next = [trackId, ...current.filter((id) => id !== trackId)].slice(0, recentTrackLimit);
            writeRecentTrackIds(next);
            return next;
          });
        } catch (error) {
          setPlaying(false);
          console.error("[Transparent Lyrics] Audio play failed", error);
        }
        return;
      }
      setPlaying(true);
      setRecentTrackIds((current) => {
        const next = [trackId, ...current.filter((id) => id !== trackId)].slice(0, recentTrackLimit);
        writeRecentTrackIds(next);
        return next;
      });
    },
    [ensurePlayableUrl, tracks],
  );

  const playRelative = useCallback(
    (offset: number) => {
      if (!tracks.length) return;
      const index = Math.max(0, tracks.findIndex((track) => track.id === activeTrack.id));
      const next = tracks[(index + offset + tracks.length) % tracks.length];
      if (next) playTrack(next.id);
    },
    [activeTrack.id, playTrack, tracks],
  );

  const importAudio = useCallback(async () => {
    const fromElectron = await window.transparentLyrics?.openAudioFiles?.();
    if (fromElectron?.length) {
      const imported = fromElectron.map(createTrackFromImportedFile);
      const matched = await matchLyricsForTracks(imported);
      const nextTracks = mergeImportedTracks(matched, tracks);
      commitTracks(nextTracks);
      setActiveTrackId(matched[0].id);
      localStorage.setItem(activeTrackKey, matched[0].id);
      return;
    }

    audioInputRef.current?.click();
  }, [commitTracks, matchLyricsForTracks, tracks]);

  const importFolder = useCallback(async () => {
    const fromFolder = await window.transparentLyrics?.scanMusicFolder?.();
    if (!fromFolder?.length) return;
    const imported = fromFolder.map(createTrackFromImportedFile);
    const matched = await matchLyricsForTracks(imported);
    const nextTracks = mergeImportedTracks(matched, tracks);
    commitTracks(nextTracks);
    setActiveTrackId(matched[0].id);
    localStorage.setItem(activeTrackKey, matched[0].id);
  }, [commitTracks, matchLyricsForTracks, tracks]);

  const importLrc = useCallback(async () => {
    const paths = await window.transparentLyrics?.openLrcFiles?.();
    if (paths?.length && activeTrack) {
      const lrcText = await window.transparentLyrics?.readLrcFile?.(paths[0]);
      if (lrcText) {
        const isSynced = parseLrcLines(lrcText).length > 0;
        applyLyricsToTrack(activeTrack.id, {
          source: "manual",
          status: "matched",
          syncedText: isSynced ? lrcText : undefined,
          plainText: isSynced ? undefined : lrcText,
          matchedAt: new Date().toISOString(),
        }, { lrcPath: paths[0] });
      }
      return;
    }
    lrcInputRef.current?.click();
  }, [activeTrack, applyLyricsToTrack]);

  const applyBackgroundImage = useCallback((imageUrl: string) => {
    const nextGlobalStyle = normalizeLyricStyle({ ...globalLyricStyle, backgroundImage: imageUrl });
    setGlobalLyricStyle(nextGlobalStyle);
    writeGlobalLyricStyle(nextGlobalStyle);
    commitTracks(tracks.map((track) =>
      track.id === activeTrack.id
        ? { ...track, lyricStyle: { ...normalizeLyricStyle(track.lyricStyle), backgroundImage: imageUrl } }
        : track,
    ));
  }, [activeTrack.id, commitTracks, globalLyricStyle, tracks]);

  const applyCoverImage = useCallback((imageUrl: string) => {
    commitTracks(tracks.map((track) =>
      track.id === activeTrack.id ? { ...track, coverImage: imageUrl } : track,
    ));
  }, [activeTrack.id, commitTracks, tracks]);

  const importBackgroundImage = useCallback(async () => {
    setImageImportTarget("background");
    const imageUrl = await window.transparentLyrics?.openImageFile?.();
    if (imageUrl) {
      applyBackgroundImage(imageUrl);
      return;
    }
    imageInputRef.current?.click();
  }, [applyBackgroundImage]);

  const importCoverImage = useCallback(async () => {
    setImageImportTarget("cover");
    const imageUrl = await window.transparentLyrics?.openImageFile?.();
    if (imageUrl) {
      applyCoverImage(imageUrl);
      return;
    }
    imageInputRef.current?.click();
  }, [applyCoverImage]);

  const updateLyricStyle = useCallback(
    (patch: Partial<LyricStyle>) => {
      const nextStyle = normalizeLyricStyle({ ...globalLyricStyle, ...patch });
      setGlobalLyricStyle(nextStyle);
      writeGlobalLyricStyle(nextStyle);
      if (!tracks.some((track) => track.id === activeTrack.id)) {
        return;
      }
      const nextTracks = tracks.map((track) =>
        track.id === activeTrack.id
          ? { ...track, lyricStyle: normalizeLyricStyle({ ...track.lyricStyle, ...patch }) }
          : track,
      );
      commitTracks(nextTracks);
    },
    [activeTrack.id, commitTracks, globalLyricStyle, tracks],
  );

  const applyLyricStyleToAllTracks = useCallback((style: LyricStyle) => {
    const nextStyle = normalizeLyricStyle(style);
    setGlobalLyricStyle(nextStyle);
    writeGlobalLyricStyle(nextStyle);
    commitTracks(tracks.map((track) => ({
      ...track,
      lyricStyle: normalizeLyricStyle({
        ...nextStyle,
        backgroundImage: track.lyricStyle.backgroundImage || nextStyle.backgroundImage,
      }),
    })));
  }, [commitTracks, tracks]);

  const saveCustomLyricPreset = useCallback((style: LyricStyle) => {
    const id = `custom-${Date.now()}`;
    const preset: LyricPreset = {
      id,
      name: `我的样式 ${customLyricPresets.length + 1}`,
      custom: true,
      style: normalizeLyricStyle({ ...style, presetId: id }),
    };
    const nextPresets = [preset, ...customLyricPresets].slice(0, 8);
    setCustomLyricPresets(nextPresets);
    writeCustomLyricPresets(nextPresets);
  }, [customLyricPresets]);

  const renameCustomLyricPreset = useCallback((presetId: string) => {
    const preset = customLyricPresets.find((item) => item.id === presetId);
    if (!preset) return;
    const nextName = window.prompt("重命名样式", preset.name)?.trim();
    if (!nextName) return;
    const nextPresets = customLyricPresets.map((item) =>
      item.id === presetId ? { ...item, name: nextName } : item,
    );
    setCustomLyricPresets(nextPresets);
    writeCustomLyricPresets(nextPresets);
  }, [customLyricPresets]);

  const deleteCustomLyricPreset = useCallback((presetId: string) => {
    const nextPresets = customLyricPresets.filter((preset) => preset.id !== presetId);
    setCustomLyricPresets(nextPresets);
    writeCustomLyricPresets(nextPresets);
  }, [customLyricPresets]);

  const migrateLegacyTrackPaths = useCallback((info: StorageInfo) => {
    const normalizeDir = (value: string) => value.replace(/[\\/]+$/, "");
    const legacyDir = normalizeDir(info.legacyMediaDir);
    const mediaDir = normalizeDir(info.mediaDir);
    const legacyDirLower = legacyDir.toLowerCase();
    let changed = false;
    const nextTracks = tracks.map((track) => {
      if (!track.path || !track.path.toLowerCase().startsWith(legacyDirLower)) return track;
      const relativePath = track.path.slice(legacyDir.length).replace(/^[\\/]+/, "");
      changed = true;
      return { ...track, path: `${mediaDir}\\${relativePath}` };
    });
    if (changed) commitTracks(nextTracks);
  }, [commitTracks, tracks]);

  const downloadUpdate = useCallback(async () => {
    try {
      await window.transparentLyrics?.downloadUpdate?.();
    } catch (error) {
      console.warn("[Transparent Lyrics] Update download failed", error);
    }
  }, []);

  const checkForUpdates = useCallback(async () => {
    const currentVersion = updaterStatus.currentVersion;
    setUpdaterStatus({ status: "checking", currentVersion });
    try {
      const status = await window.transparentLyrics?.checkForUpdates?.();
      if (status) setUpdaterStatus(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[Transparent Lyrics] Update check failed", error);
      setUpdaterStatus({ status: "error", currentVersion, error: message });
    }
  }, [updaterStatus.currentVersion]);

  const installUpdate = useCallback(async () => {
    try {
      await window.transparentLyrics?.installUpdate?.();
    } catch (error) {
      console.warn("[Transparent Lyrics] Update install failed", error);
    }
  }, []);

  const togglePlayback = useCallback(() => {
    if (!activeTrack) {
      return;
    }
    const audio = audioRef.current;
    if (playing || (audio && !audio.paused)) {
      setPlaying(false);
      return;
    }
    if (audio?.src && audio.currentTime > 0 && !audio.ended) {
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      return;
    }
    void playTrack(activeTrack.id);
  }, [activeTrack, playTrack, playing]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : activeTrack.duration;
    const nextTime = Math.max(0, Math.min(duration || 0, seconds));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, [activeTrack.duration]);

  useEffect(() => {
    (window as unknown as { __tlDebug?: unknown }).__tlDebug = {
      getState: () => {
        const audio = audioRef.current;
        return {
          view,
          playing,
          currentTime,
          volume,
          activeTrack,
          effectiveLyricStyle,
          tracks,
          matchingLyrics,
          audio: audio
            ? {
                src: audio.currentSrc || audio.src,
                paused: audio.paused,
                currentTime: audio.currentTime,
                duration: audio.duration,
                readyState: audio.readyState,
                networkState: audio.networkState,
                error: audio.error
                  ? {
                      code: audio.error.code,
                      message: audio.error.message,
                    }
                  : null,
              }
            : null,
        };
      },
      playActive: () => playTrack(activeTrack.id),
    };
  }, [activeTrack, currentTime, effectiveLyricStyle, matchingLyrics, playTrack, playing, tracks, view, volume]);

  useEffect(() => {
    writeLibrary(tracks);
  }, [tracks]);

  useEffect(() => {
    let mounted = true;
    window.transparentLyrics?.getAppVersion?.()
      .then((version) => {
        if (mounted && version) setUpdaterStatus({ status: "idle", currentVersion: version });
      })
      .catch((error) => console.warn("[Transparent Lyrics] Failed to read app version", error));
    const unsubscribe = window.transparentLyrics?.onUpdaterStatus?.((status) => {
      if (!mounted) return;
      if (status.status === "error") {
        console.warn("[Transparent Lyrics] Update check failed", status.error);
      }
      setUpdaterStatus(status);
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [playing]);

  const lyricPageBackground = effectiveLyricStyle.backgroundImage || getCover(activeTrack);

  return (
    <main
      className={`app-shell ${view === "lyrics" ? "lyrics-mode" : ""}`}
      style={{ "--lyrics-background": `url(${lyricPageBackground})` } as React.CSSProperties}
    >
      <WindowChrome />
      <SideNav currentView={view} selectedPlaylist={selectedPlaylist} navigate={navigate} navigatePlaylist={navigatePlaylist} />
      <TopBar view={view} selectedPlaylist={selectedPlaylist} goBack={goBack} goForward={goForward} />
      <section className="content-shell">
        {view === "main" && (
          <LibraryPage
            tracks={tracks}
            activeTrack={activeTrack}
            playing={playing}
            playTrack={playTrack}
            playAll={() => tracks[0] && playTrack(tracks[0].id)}
            updaterStatus={updaterStatus}
            checkForUpdates={checkForUpdates}
            downloadUpdate={downloadUpdate}
            installUpdate={installUpdate}
          />
        )}
        {view === "recent" && (
          <RecentPage tracks={recentTracks} activeTrack={activeTrack} playing={playing} playTrack={playTrack} />
        )}
        {view === "import" && (
          <ImportPage
            tracks={tracks}
            matchingLyrics={matchingLyrics}
            importAudio={importAudio}
            importFolder={importFolder}
            importLrc={importLrc}
            importBackgroundImage={importBackgroundImage}
            importCoverImage={importCoverImage}
            matchAllLyrics={matchAllLyrics}
            retryLyricsForTrack={retryLyricsForTrack}
            openManualLyrics={openManualLyrics}
          />
        )}
        {view === "playlist" && (
          <PlaylistPage playlistName={selectedPlaylist} tracks={tracks} activeTrack={activeTrack} playing={playing} playTrack={playTrack} />
        )}
        {view === "settings" && (
          <SettingsPage
            updaterStatus={updaterStatus}
            checkForUpdates={checkForUpdates}
            downloadUpdate={downloadUpdate}
            installUpdate={installUpdate}
            lyricStyle={effectiveLyricStyle}
            updateLyricStyle={updateLyricStyle}
            resetLyricStyle={() => updateLyricStyle(defaultLyricStyle)}
            onLegacyMediaMigrated={migrateLegacyTrackPaths}
          />
        )}
        {view === "lyrics" && (
          <LyricsPage
            activeTrack={activeTrack}
            currentTime={currentTime}
            playing={playing}
            lyricStyle={effectiveLyricStyle}
            updateLyricStyle={updateLyricStyle}
            applyLyricStyleToAllTracks={applyLyricStyleToAllTracks}
            customLyricPresets={customLyricPresets}
            saveCustomLyricPreset={saveCustomLyricPreset}
            renameCustomLyricPreset={renameCustomLyricPreset}
            deleteCustomLyricPreset={deleteCustomLyricPreset}
            uploadBackground={importBackgroundImage}
            uploadCover={importCoverImage}
            exitLyrics={() => navigate("main")}
          />
        )}
        {view === "mini" && <MiniPage activeTrack={activeTrack} />}
      </section>
      <PlayerBar
        activeTrack={activeTrack}
        playing={playing}
        currentTime={currentTime}
        volume={volume}
        setVolume={setVolume}
        playRelative={playRelative}
        togglePlayback={togglePlayback}
        seekTo={seekTo}
        navigate={navigate}
      />
      <audio
        ref={audioRef}
        onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration;
          if (!Number.isFinite(duration)) return;
          const nextTracks = tracks.map((track) =>
            track.id === activeTrack.id
              ? { ...track, duration, durationLabel: formatDuration(duration) }
              : track,
          );
          commitTracks(nextTracks);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onError={() => {
          setPlaying(false);
          if (!activeTrack?.id) return;
          const nextTracks = tracks.map((track) =>
            track.id === activeTrack.id && !track.path ? { ...track, added: reimportLabel } : track,
          );
          commitTracks(nextTracks);
        }}
        onEnded={() => {
          setPlaying(false);
          void playRelative(1);
        }}
      />
      <input
        ref={audioInputRef}
        className="hidden-input"
        type="file"
        accept="audio/*"
        multiple
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          if (!files.length) return;
          const imported = files.map((file, index) =>
            createTrackFromImportedFile(
              {
                title: file.name.replace(/\.[^.]+$/, ""),
                artist: localMusicLabel,
                album: "Local Library",
                format: file.name.split(".").pop()?.toUpperCase() ?? "AUDIO",
                path: "",
                url: URL.createObjectURL(file),
              },
              index,
            ),
          );
          const matched = await matchLyricsForTracks(imported);
          commitTracks(mergeImportedTracks(matched, tracks));
          setActiveTrackId(matched[0].id);
        }}
      />
      <input
        ref={lrcInputRef}
        className="hidden-input"
        type="file"
        accept=".lrc"
        multiple
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          if (!file || !activeTrack) return;
          const text = await file.text();
          const isSynced = parseLrcLines(text).length > 0;
          applyLyricsToTrack(activeTrack.id, {
            source: "manual",
            status: "matched",
            syncedText: isSynced ? text : undefined,
            plainText: isSynced ? undefined : text,
            matchedAt: new Date().toISOString(),
          });
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={imageInputRef}
        className="hidden-input"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (!file) return;
          const imageUrl = URL.createObjectURL(file);
          if (imageImportTarget === "cover") {
            applyCoverImage(imageUrl);
          } else {
            applyBackgroundImage(imageUrl);
          }
          event.currentTarget.value = "";
        }}
      />
      {manualLyrics.open && (
        <ManualLyricsDialog
          state={manualLyrics}
          setState={setManualLyrics}
          onClose={closeManualLyrics}
          onSearch={searchManualLyrics}
          onSaveCandidate={saveLyricsCandidate}
          onSavePasted={savePastedLyrics}
          formatDuration={formatDuration}
          Icon={Icon}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
