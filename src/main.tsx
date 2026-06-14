import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type View = "main" | "playlist" | "recent" | "import" | "lyrics" | "mini";

type LyricStyle = {
  presetId: string;
  x: number;
  y: number;
  scale: number;
  rotateZ: number;
  rotateX: number;
  rotateY: number;
  skewX: number;
  skewY: number;
  perspective: number;
  opacity: number;
  fontSize: number;
  color: string;
  stroke: string;
  shadow: number;
  glow: number;
  inactiveColor: string;
  inactiveOpacity: number;
  lineGap: number;
  backgroundBlur: number;
  backgroundDim: number;
  backgroundSaturation: number;
  panelOpacity: number;
  scanline: boolean;
  coverEnabled: boolean;
  coverX: number;
  coverY: number;
  coverSize: number;
  coverRotationSeconds: number;
  lyricDisplayMode: "scroll" | "stack" | "single";
  lyricOffset: number;
  backgroundImage?: string;
};

type LyricsStatus = "unmatched" | "matched" | "not-found" | "failed";

type TrackLyrics = {
  source: "lrclib" | "manual";
  status: LyricsStatus;
  syncedText?: string;
  plainText?: string;
  matchedAt?: string;
  providerId?: number;
  error?: string;
};

type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  durationLabel: string;
  added: string;
  format: string;
  path?: string;
  originalPath?: string;
  url?: string;
  lrcPath?: string;
  coverImage?: string;
  lyrics?: TrackLyrics;
  lyricStyle: LyricStyle;
};

type LyricPreset = {
  id: string;
  name: string;
  style: LyricStyle;
  custom?: boolean;
};

const defaultLyricStyle: LyricStyle = {
  presetId: "night-tilt",
  x: 8,
  y: -2,
  scale: 1,
  rotateZ: -2,
  rotateX: 16,
  rotateY: -18,
  skewX: 0,
  skewY: 0,
  perspective: 980,
  opacity: 1,
  fontSize: 56,
  color: "#a7e0ff",
  stroke: "rgba(0,0,0,.35)",
  shadow: 24,
  glow: 20,
  inactiveColor: "#e5e2e1",
  inactiveOpacity: 0.44,
  lineGap: 22,
  backgroundBlur: 8,
  backgroundDim: 62,
  backgroundSaturation: 118,
  panelOpacity: 38,
  scanline: false,
  coverEnabled: true,
  coverX: -26,
  coverY: -5,
  coverSize: 210,
  coverRotationSeconds: 12,
  lyricDisplayMode: "scroll",
  lyricOffset: 0,
};

const lyricPresets: LyricPreset[] = [
  {
    id: "night-tilt",
    name: "QQ \u5531\u7247",
    style: defaultLyricStyle,
  },
  {
    id: "anime-memory",
    name: "\u52a8\u6f2b\u56de\u5fc6",
    style: {
      ...defaultLyricStyle,
      presetId: "anime-memory",
      x: 18,
      y: -4,
      scale: 0.9,
      rotateZ: 0,
      rotateX: 0,
      rotateY: 0,
      perspective: 900,
      fontSize: 34,
      color: "#f7fbff",
      inactiveColor: "#d8d6dc",
      inactiveOpacity: 0.42,
      lineGap: 12,
      backgroundBlur: 1,
      backgroundDim: 58,
      backgroundSaturation: 88,
      panelOpacity: 24,
      scanline: false,
      coverEnabled: true,
      coverX: -24,
      coverY: -2,
      coverSize: 230,
      coverRotationSeconds: 16,
    },
  },
  {
    id: "heart-share",
    name: "\u4eca\u65e5\u5206\u4eab",
    style: {
      ...defaultLyricStyle,
      presetId: "heart-share",
      x: -12,
      y: -4,
      scale: 0.88,
      rotateZ: -8,
      rotateX: 8,
      rotateY: -10,
      fontSize: 42,
      color: "#f8fbff",
      inactiveColor: "#8fa5bd",
      inactiveOpacity: 0.52,
      backgroundBlur: 3,
      backgroundDim: 26,
      backgroundSaturation: 72,
      panelOpacity: 30,
      coverEnabled: true,
      coverX: 26,
      coverY: -12,
      coverSize: 300,
      coverRotationSeconds: 14,
    },
  },
  {
    id: "raster-water",
    name: "\u84dd\u8272\u5149\u6805",
    style: {
      ...defaultLyricStyle,
      presetId: "raster-water",
      x: 12,
      y: -8,
      scale: 0.9,
      rotateZ: 0,
      rotateX: 12,
      rotateY: -24,
      fontSize: 38,
      color: "#c7fff8",
      inactiveColor: "#a9d8ee",
      inactiveOpacity: 0.58,
      backgroundBlur: 2,
      backgroundDim: 54,
      backgroundSaturation: 148,
      panelOpacity: 42,
      scanline: true,
      coverEnabled: true,
      coverX: -29,
      coverY: 10,
      coverSize: 180,
      coverRotationSeconds: 10,
    },
  },
];

function normalizeLyricStyle(style?: Partial<LyricStyle>): LyricStyle {
  return { ...defaultLyricStyle, ...(style ?? {}) };
}

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
const defaultCover =
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200&auto=format&fit=crop";

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

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
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

function lyricStatusLabel(status?: LyricsStatus) {
  if (status === "matched") return "\u5df2\u5339\u914d";
  if (status === "not-found") return "\u65e0\u7ed3\u679c";
  if (status === "failed") return "\u5339\u914d\u5931\u8d25";
  return "\u672a\u5339\u914d";
}

function parseLrcLines(text?: string) {
  if (!text) return [] as Array<{ time: number; text: string }>;
  const lines: Array<{ time: number; text: string }> = [];
  text.split(/\r?\n/).forEach((line) => {
    const matches = Array.from(line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g));
    const content = line.replace(/\[[^\]]+\]/g, "").trim();
    if (!matches.length || !content) return;
    matches.forEach((match) => {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = Number((match[3] ?? "0").padEnd(3, "0"));
      lines.push({ time: minutes * 60 + seconds + fraction / 1000, text: content });
    });
  });
  return lines.sort((left, right) => left.time - right.time);
}

function getLyricWindow(track: Track, currentTime: number, offset = 0) {
  const lyricTime = Math.max(0, currentTime + offset);
  const synced = parseLrcLines(track.lyrics?.syncedText);
  if (!synced.length) {
    const plain = track.lyrics?.plainText
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const plainIndex = plain?.length && track.duration
      ? Math.max(0, Math.min(plain.length - 1, Math.floor((lyricTime / track.duration) * plain.length)))
      : 2;
    return plain?.length
      ? { previous: [plain[plainIndex - 2], plain[plainIndex - 1]].filter(Boolean), active: plain[plainIndex] ?? plain[0], next: [plain[plainIndex + 1], plain[plainIndex + 2]].filter(Boolean) }
      : { previous: ["You've been running through my mind", "Looking for a place to hide"], active: "In the luminous clarity of the night", next: ["We finally found our way", "Out of the dark and into the light"] };
  }
  const activeIndex = Math.max(0, synced.findIndex((line, index) => {
    const next = synced[index + 1];
    return lyricTime >= line.time && (!next || lyricTime < next.time);
  }));
  return {
    previous: [synced[activeIndex - 2]?.text, synced[activeIndex - 1]?.text].filter(Boolean),
    active: synced[activeIndex]?.text ?? synced[0]?.text,
    next: [synced[activeIndex + 1]?.text, synced[activeIndex + 2]?.text].filter(Boolean),
  };
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
  const [imageImportTarget, setImageImportTarget] = useState<"background" | "cover">("background");
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlsRef = useRef<Map<string, string>>(new Map());
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);
  const activeTrack = tracks.find((track) => track.id === activeTrackId) ?? tracks[0] ?? placeholderTrack;
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

  const retryActiveLyrics = useCallback(async () => {
    if (!activeTrack || activeTrack.id.startsWith("demo-")) return;
    const matched = await matchLyricsForTrack(activeTrack);
    commitTracks(tracks.map((track) => (track.id === matched.id ? matched : track)));
  }, [activeTrack, commitTracks, matchLyricsForTrack, tracks]);

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
      const nextTracks = tracks.map((track) =>
        track.id === activeTrack.id ? { ...track, lrcPath: paths[0] } : track,
      );
      commitTracks(nextTracks);
      return;
    }
    lrcInputRef.current?.click();
  }, [activeTrack, commitTracks, tracks]);

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
  }, [activeTrack, currentTime, matchingLyrics, playTrack, playing, tracks, view, volume]);

  useEffect(() => {
    writeLibrary(tracks);
  }, [tracks]);

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

  const lyricPageBackground = globalLyricStyle.backgroundImage || activeTrack.lyricStyle.backgroundImage || getCover(activeTrack);

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
          <LibraryPage tracks={tracks} activeTrack={activeTrack} playing={playing} playTrack={playTrack} playAll={() => tracks[0] && playTrack(tracks[0].id)} />
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
            retryActiveLyrics={retryActiveLyrics}
          />
        )}
        {view === "playlist" && (
          <PlaylistPage playlistName={selectedPlaylist} tracks={tracks} activeTrack={activeTrack} playing={playing} playTrack={playTrack} />
        )}
        {view === "lyrics" && (
          <LyricsPage
            activeTrack={activeTrack}
            currentTime={currentTime}
            playing={playing}
            lyricStyle={normalizeLyricStyle({ ...activeTrack.lyricStyle, ...globalLyricStyle })}
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
      <input ref={lrcInputRef} className="hidden-input" type="file" accept=".lrc" multiple />
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
    </main>
  );
}

function Icon({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function WindowChrome() {
  return (
    <>
      <div className="window-drag-region" />
      <div className="window-controls">
        <button type="button" aria-label={"\u6700\u5c0f\u5316"} onClick={() => window.transparentLyrics?.minimizeWindow?.()}>
          <Icon>remove</Icon>
        </button>
        <button type="button" aria-label={"\u6700\u5927\u5316"} onClick={() => window.transparentLyrics?.toggleMaximizeWindow?.()}>
          <Icon>crop_square</Icon>
        </button>
        <button type="button" aria-label={"\u5173\u95ed"} onClick={() => window.transparentLyrics?.closeWindow?.()}>
          <Icon>close</Icon>
        </button>
      </div>
    </>
  );
}

function getCover(track: Track) {
  return track.coverImage || defaultCover;
}

function getLibraryStats(tracks: Track[]) {
  const totalSeconds = tracks.reduce((sum, track) => sum + (Number(track.duration) || 0), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  return {
    count: `${tracks.length} \u9996\u6b4c\u66f2`,
    duration: hours ? `${hours} \u5c0f\u65f6 ${minutes} \u5206\u949f` : `${minutes} \u5206\u949f`,
  };
}

function SideNav({
  currentView,
  selectedPlaylist,
  navigate,
  navigatePlaylist,
}: {
  currentView: View;
  selectedPlaylist: string;
  navigate: (view: View) => void;
  navigatePlaylist: (playlistName: string) => void;
}) {
  const items: Array<{ view: View; icon: string; label: string }> = [
    { view: "main", icon: "library_music", label: "\u97f3\u4e50\u5e93" },
    { view: "recent", icon: "history", label: "\u6700\u8fd1\u64ad\u653e" },
    { view: "import", icon: "upload_file", label: "\u5bfc\u5165\u8d44\u6e90" },
  ];
  const playlists = [
    { icon: "playlist_play", label: "\u6df1\u591c\u6c89\u6d78" },
    { icon: "water_drop", label: "\u96e8\u5929\u6f2b\u6b65" },
    { icon: "playlist_play", label: "\u5de5\u4f5c\u7535\u53f0" },
  ];
  return (
    <aside className="side-nav">
      <div className="brand-block">
        <h1>{"\u97f3\u4e50"}</h1>
        <p>Luminous Clarity</p>
      </div>
      <div className="side-scroll">
        <nav className="nav-list">
          {items.map((item) => (
            <button key={item.view} className={`nav-item ${currentView === item.view ? "active" : ""}`} type="button" onClick={() => navigate(item.view)}>
              <Icon>{item.icon}</Icon><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="nav-section-title">{"\u6b4c\u5355"}</div>
        <nav className="nav-list">
          {playlists.map((item) => (
            <button key={item.label} className={`nav-item ${currentView === "playlist" && selectedPlaylist === item.label ? "active" : ""}`} type="button" onClick={() => navigatePlaylist(item.label)}>
              <Icon>{item.icon}</Icon><span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
      <div className="side-footer">
        <button className="new-playlist" type="button"><Icon>add</Icon>{"\u65b0\u5efa\u6b4c\u5355"}</button>
        <div className="side-tools">
          <button type="button"><Icon>settings</Icon><span>{"\u8bbe\u7f6e"}</span></button>
          <button type="button"><Icon>help</Icon><span>{"\u5e2e\u52a9"}</span></button>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ view, selectedPlaylist, goBack, goForward }: { view: View; selectedPlaylist: string; goBack: () => void; goForward: () => void }) {
  const title = view === "import" ? "\u8d44\u6e90\u5bfc\u5165" : view === "recent" ? "\u6700\u8fd1\u64ad\u653e" : view === "playlist" ? selectedPlaylist : "";
  return (
    <header className="top-bar">
      <div className="top-left">
        <button className="round-nav" type="button" onClick={goBack} aria-label={"\u8fd4\u56de"}><Icon>chevron_left</Icon></button>
        <button className="round-nav" type="button" onClick={goForward} aria-label={"\u524d\u8fdb"}><Icon>chevron_right</Icon></button>
        {title ? <h2>{title}</h2> : <label className="search-pill"><Icon>search</Icon><input placeholder={"\u641c\u7d22\u6b4c\u66f2\u3001\u6b4c\u624b\u6216\u4e13\u8f91..."} /></label>}
      </div>
      <div className="top-right">
        {view === "import" && <div className="segmented-control"><button className="active" type="button">{"\u5bfc\u5165\u5411\u5bfc"}</button><button type="button">{"\u6279\u91cf\u5904\u7406"}</button></div>}
        {view !== "import" && title && <label className="search-pill compact"><Icon>search</Icon><input placeholder={"\u641c\u7d22\u6b4c\u66f2\u3001\u827a\u4eba..."} /></label>}
        <button type="button" aria-label={"\u8d26\u6237"}><Icon>account_circle</Icon></button>
        <button type="button" aria-label={"\u901a\u77e5"}><Icon>notifications</Icon></button>
      </div>
    </header>
  );
}

function TrackCover({ track, active, playing }: { track: Track; active: boolean; playing: boolean }) {
  const hasImage = Boolean(track.lyricStyle.backgroundImage || track.id !== "placeholder");
  return <div className="cover-box">{hasImage ? <img alt="Album" src={getCover(track)} /> : <Icon>music_note</Icon>}<span className="cover-badge"><Icon>{active && playing ? "pause" : "play_arrow"}</Icon></span></div>;
}

function LibraryPage({ tracks, activeTrack, playing, playTrack, playAll }: { tracks: Track[]; activeTrack: Track; playing: boolean; playTrack: (trackId: string) => void; playAll: () => void }) {
  const stats = getLibraryStats(tracks);
  return (
    <div className="page-inner library-page">
      <section className="page-heading"><h2>{"\u97f3\u4e50\u5e93"}</h2><p><span>{stats.count}</span><span>•</span><span>{stats.duration}</span></p></section>
      <div className="toolbar-row"><div className="button-row"><button className="primary-pill" type="button" onClick={playAll}>{"\u5168\u90e8\u64ad\u653e"}</button><button className="ghost-pill" type="button"><Icon>shuffle</Icon>{"\u968f\u673a"}</button></div><button className="icon-button" type="button" aria-label={"\u7b5b\u9009"}><Icon>filter_list</Icon></button></div>
      <TrackTable tracks={tracks} activeTrack={activeTrack} playing={playing} playTrack={playTrack} emptyText={"\u97f3\u4e50\u5e93\u8fd8\u662f\u7a7a\u7684\uff0c\u5148\u53bb\u5bfc\u5165\u8d44\u6e90\u6dfb\u52a0\u672c\u5730\u6b4c\u66f2\u3002"} />
      <div className="load-more-wrap"><button className="load-more" type="button">{"\u52a0\u8f7d\u66f4\u591a"}</button></div>
    </div>
  );
}

function TrackTable({ tracks, activeTrack, playing, playTrack, emptyText }: { tracks: Track[]; activeTrack: Track; playing: boolean; playTrack: (trackId: string) => void; emptyText: string }) {
  return (
    <div className="glass-panel track-table">
      <div className="track-header"><div>{"\u6807\u9898"}</div><div>{"\u6b4c\u624b"}</div><div>{"\u4e13\u8f91"}</div><div>{"\u6dfb\u52a0\u65f6\u95f4"}</div><div><Icon>schedule</Icon></div></div>
      <div className="track-body">
        {!tracks.length && <div className="empty-state">{emptyText}</div>}
        {tracks.map((track) => {
          const active = track.id === activeTrack.id;
          return <button className={`track-row ${active ? "active" : ""}`} key={track.id} type="button" onClick={() => playTrack(track.id)}><div className="track-title-cell"><TrackCover track={track} active={active} playing={playing} /><span className={active ? "accent-text" : ""}>{track.title}</span></div><div>{track.artist}</div><div>{track.album}</div><div className="center-cell">{track.added || "\u521a\u521a"}</div><div className="right-cell">{track.durationLabel}</div></button>;
        })}
      </div>
    </div>
  );
}

function RecentPage({ tracks, activeTrack, playing, playTrack }: { tracks: Track[]; activeTrack: Track; playing: boolean; playTrack: (trackId: string) => void }) {
  return <div className="page-inner recent-page"><div className="recent-table-head"><span>{"\u6b4c\u66f2\u6807\u9898"}</span><span>{"\u827a\u4eba"}</span><span>{"\u4e13\u8f91"}</span><span>{"\u64ad\u653e\u4e8e"}</span><span>{"\u65f6\u957f"}</span></div><div className="recent-list">{!tracks.length && <div className="empty-state">{"\u6682\u65e0\u6700\u8fd1\u64ad\u653e\uff0c\u5f00\u59cb\u542c\u6b4c\u540e\u4f1a\u81ea\u52a8\u8bb0\u5f55\u6700\u8fd1 200 \u9996\u3002"}</div>}{tracks.map((track) => { const active = track.id === activeTrack.id; return <button className={`recent-row ${active ? "active" : ""}`} type="button" key={track.id} onClick={() => playTrack(track.id)}><span className="recent-title"><TrackCover track={track} active={active} playing={playing} />{track.title}</span><span>{track.artist}</span><span>{track.album}</span><span>{"\u521a\u521a"}</span><span>{track.durationLabel}</span></button>; })}</div></div>;
}

function ImportPage({ tracks, matchingLyrics, importAudio, importFolder, importLrc, importBackgroundImage, importCoverImage, matchAllLyrics, retryActiveLyrics }: { tracks: Track[]; matchingLyrics: boolean; importAudio: () => void; importFolder: () => void; importLrc: () => void; importBackgroundImage: () => void; importCoverImage: () => void; matchAllLyrics: () => void; retryActiveLyrics: () => void }) {
  const localTracks = tracks.filter((track) => !track.id.startsWith("demo-"));
  const matchedCount = localTracks.filter((track) => track.lyrics?.status === "matched").length;
  return <div className="page-inner import-page">{localTracks.length > 0 && <div className="success-banner"><Icon>check_circle</Icon><span>{"\u5df2\u5bfc\u5165 "}{localTracks.length}{" \u9996\u672c\u5730\u6b4c\u66f2\uff0c"}{matchedCount}{" \u9996\u5df2\u5339\u914d\u6b4c\u8bcd"}</span></div>}<div className="import-grid"><ImportCard icon="library_add" title={"\u5bfc\u5165\u672c\u5730\u6b4c\u66f2"} description={"\u9009\u62e9\u5355\u9996\u6b4c\u66f2\uff0c\u6216\u626b\u63cf\u6574\u4e2a\u97f3\u4e50\u6587\u4ef6\u5939\u3002"} body={"\u5bfc\u5165\u540e\u81ea\u52a8\u5c1d\u8bd5\u5339\u914d\u6b4c\u8bcd"} actions={[{ label: "\u9009\u62e9\u6b4c\u66f2\u6587\u4ef6", onClick: importAudio }, { label: "\u9009\u62e9\u97f3\u4e50\u6587\u4ef6\u5939", onClick: importFolder }]} /><ImportCard icon="lyrics" title={"\u6b4c\u8bcd\u8865\u5168"} description={"\u652f\u6301 LRC \u5bfc\u5165\uff0c\u4e5f\u53ef\u6279\u91cf\u5728\u7ebf\u5339\u914d\u672c\u5730\u6b4c\u66f2\u3002"} body={matchingLyrics ? "\u6b63\u5728\u5339\u914d\u6b4c\u8bcd..." : "\u4f18\u5148\u4fdd\u5b58\u540c\u6b65\u6b4c\u8bcd"} actions={[{ label: "\u6279\u91cf\u8865\u5168\u6b4c\u8bcd", onClick: matchAllLyrics }, { label: "\u5bfc\u5165 LRC \u6587\u4ef6", onClick: importLrc }]} /><ImportCard icon="wallpaper" title={"\u4e0a\u4f20\u58c1\u7eb8"} description={"\u4e3a\u6b4c\u8bcd\u9875\u9762\u8bbe\u7f6e\u4e13\u5c5e\u80cc\u666f\u56fe\u3002"} body={"\u652f\u6301 JPG\u3001PNG \u7b49\u56fe\u7247"} actions={[{ label: "\u9009\u62e9\u80cc\u666f\u56fe", onClick: importBackgroundImage }]} /><ImportCard icon="image" title={"\u5173\u8054\u5c01\u9762\u56fe"} description={"\u4e3a\u5f53\u524d\u6b4c\u66f2\u8865\u5145\u5c01\u9762\uff0c\u4e0d\u4f1a\u8986\u76d6\u6b4c\u8bcd\u80cc\u666f\u3002"} body={"\u5c01\u9762\u7528\u4e8e\u5e95\u90e8\u64ad\u653e\u5668\u548c\u5531\u7247\u52a8\u6548"} actions={[{ label: "\u9009\u62e9\u5c01\u9762\u56fe", onClick: importCoverImage }]} /></div><section className="resource-section"><div className="section-title-row"><h3>{"\u5df2\u5bfc\u5165\u8d44\u6e90"}</h3><label>{"\u663e\u793a:"}<select><option>{"\u5168\u90e8"}</option></select></label></div><div className="glass-panel resource-table"><div className="resource-head"><span>{"\u6b4c\u66f2\u540d\u79f0"}</span><span>{"\u683c\u5f0f"}</span><span>{"\u6b4c\u8bcd\u72b6\u6001"}</span><span>{"\u80cc\u666f\u72b6\u6001"}</span><span>{"\u5c01\u9762"}</span><span>{"\u64cd\u4f5c"}</span></div>{!localTracks.length && <div className="empty-state">{"\u8fd8\u6ca1\u6709\u5bfc\u5165\u8d44\u6e90\u3002"}</div>}{localTracks.map((track) => <div className="resource-row" key={track.id}><span className="resource-title"><span className="note-square"><Icon>music_note</Icon></span><span><b>{track.title}</b><small>{track.artist}</small></span></span><span>{track.format}</span><span className={track.lyrics?.status === "matched" ? "ok-text" : ""}>{lyricStatusLabel(track.lyrics?.status)}</span><span className={track.lyricStyle.backgroundImage ? "ok-text" : ""}>{track.lyricStyle.backgroundImage ? <Icon>check_circle</Icon> : "\u672a\u8bbe\u7f6e"}</span><span><TrackCover track={track} active={false} playing={false} /></span><button type="button" onClick={retryActiveLyrics}>{track.lyrics?.status === "matched" ? "\u91cd\u65b0\u5339\u914d" : "\u5339\u914d\u6b4c\u8bcd"}</button></div>)}</div></section></div>;
}

function ImportCard({ icon, title, description, body, actions }: { icon: string; title: string; description: string; body: string; actions: Array<{ label: string; onClick: () => void }> }) {
  return <div className="glass-card import-card"><div className="card-title"><Icon>{icon}</Icon><h2>{title}</h2></div><p>{description}</p><div className="drop-zone"><Icon>{icon === "library_add" ? "library_music" : icon === "lyrics" ? "subtitles" : "add_photo_alternate"}</Icon><span>{body}</span><div className="card-actions">{actions.map((action) => <button key={action.label} type="button" onClick={action.onClick}>{action.label}</button>)}</div></div></div>;
}

function PlaylistPage({ playlistName, tracks, activeTrack, playing, playTrack }: { playlistName: string; tracks: Track[]; activeTrack: Track; playing: boolean; playTrack: (trackId: string) => void }) {
  const descriptions: Record<string, string> = {
    "\u6df1\u591c\u6c89\u6d78": "\u5728\u9759\u8c27\u7684\u591c\u665a\uff0c\u8ba9\u8f7b\u76c8\u7684\u65cb\u5f8b\u5e26\u4f60\u8fdb\u5165\u6df1\u5c42\u51a5\u60f3\u3002",
    "\u96e8\u5929\u6f2b\u6b65": "\u9002\u5408\u96e8\u58f0\u548c\u57ce\u5e02\u706f\u5f71\u7684\u6162\u901f\u6b4c\u5355\u3002",
    "\u5de5\u4f5c\u7535\u53f0": "\u8282\u594f\u7a33\u5b9a\uff0c\u9002\u5408\u6574\u7406\u601d\u8def\u548c\u4e13\u6ce8\u5de5\u4f5c\u3002",
  };
  return <div className="page-inner playlist-page"><section className="playlist-hero"><Icon>play_circle</Icon><span>EXCLUSIVE PLAYLIST</span><h2>{playlistName}</h2><p>{descriptions[playlistName] ?? descriptions["\u6df1\u591c\u6c89\u6d78"]}</p></section><TrackTable tracks={tracks} activeTrack={activeTrack} playing={playing} playTrack={playTrack} emptyText={"\u6b4c\u5355\u8fd8\u6ca1\u6709\u6b4c\u66f2\uff0c\u5148\u4ece\u97f3\u4e50\u5e93\u6dfb\u52a0\u3002"} /></div>;
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onPreview,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const previewFrameRef = useRef<number | null>(null);
  const pendingPreviewRef = useRef(value);
  const committedValueRef = useRef(value);
  const hasPendingPreviewRef = useRef(false);

  useEffect(() => {
    setLocalValue(value);
    pendingPreviewRef.current = value;
    committedValueRef.current = value;
    hasPendingPreviewRef.current = false;
  }, [value]);

  useEffect(() => {
    return () => {
      if (previewFrameRef.current !== null) {
        window.cancelAnimationFrame(previewFrameRef.current);
      }
    };
  }, []);

  const nextValue = (raw: string) => Number(raw);
  const previewCurrent = (next: number) => {
    pendingPreviewRef.current = next;
    hasPendingPreviewRef.current = true;
    if (previewFrameRef.current !== null) return;
    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = null;
      onPreview(pendingPreviewRef.current);
    });
  };
  const commitValue = (next: number) => {
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
    pendingPreviewRef.current = next;
    setLocalValue(next);
    if (Object.is(committedValueRef.current, next) && !hasPendingPreviewRef.current) return;
    hasPendingPreviewRef.current = false;
    committedValueRef.current = next;
    onCommit(next);
  };
  const commitCurrent = (target: HTMLInputElement) => commitValue(nextValue(target.value));
  return (
    <label className="lyric-range">
      <span>{label}<b>{localValue}{unit}</b></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={(event) => {
          const value = nextValue(event.currentTarget.value);
          setLocalValue(value);
          previewCurrent(value);
        }}
        onPointerUp={(event) => commitCurrent(event.currentTarget)}
        onPointerCancel={(event) => commitCurrent(event.currentTarget)}
        onKeyUp={(event) => commitCurrent(event.currentTarget)}
        onBlur={(event) => commitCurrent(event.currentTarget)}
      />
    </label>
  );
}

function ColorControl({
  label,
  value,
  onPreview,
  onCommit,
}: {
  label: string;
  value: string;
  onPreview: (value: string) => void;
  onCommit: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const previewFrameRef = useRef<number | null>(null);
  const commitTimerRef = useRef<number | null>(null);
  const pendingPreviewRef = useRef(value);
  const committedValueRef = useRef(value);
  const hasPendingPreviewRef = useRef(false);

  useEffect(() => {
    setLocalValue(value);
    pendingPreviewRef.current = value;
    committedValueRef.current = value;
    hasPendingPreviewRef.current = false;
  }, [value]);

  useEffect(() => {
    return () => {
      if (previewFrameRef.current !== null) window.cancelAnimationFrame(previewFrameRef.current);
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    };
  }, []);

  const commitValue = (next: string) => {
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    pendingPreviewRef.current = next;
    setLocalValue(next);
    if (Object.is(committedValueRef.current, next) && !hasPendingPreviewRef.current) return;
    hasPendingPreviewRef.current = false;
    committedValueRef.current = next;
    onCommit(next);
  };

  const previewValue = (next: string) => {
    pendingPreviewRef.current = next;
    hasPendingPreviewRef.current = true;
    if (previewFrameRef.current === null) {
      previewFrameRef.current = window.requestAnimationFrame(() => {
        previewFrameRef.current = null;
        onPreview(pendingPreviewRef.current);
      });
    }
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = window.setTimeout(() => commitValue(pendingPreviewRef.current), 320);
  };

  return (
    <label>
      {label}
      <input
        type="color"
        value={localValue}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setLocalValue(next);
          previewValue(next);
        }}
        onBlur={(event) => commitValue(event.currentTarget.value)}
        onKeyUp={(event) => commitValue(event.currentTarget.value)}
      />
    </label>
  );
}

function LyricsPage({
  activeTrack,
  currentTime,
  playing,
  lyricStyle,
  updateLyricStyle,
  applyLyricStyleToAllTracks,
  customLyricPresets,
  saveCustomLyricPreset,
  renameCustomLyricPreset,
  deleteCustomLyricPreset,
  uploadBackground,
  uploadCover,
  exitLyrics,
}: {
  activeTrack: Track;
  currentTime: number;
  playing: boolean;
  lyricStyle: LyricStyle;
  updateLyricStyle: (patch: Partial<LyricStyle>) => void;
  applyLyricStyleToAllTracks: (style: LyricStyle) => void;
  customLyricPresets: LyricPreset[];
  saveCustomLyricPreset: (style: LyricStyle) => void;
  renameCustomLyricPreset: (presetId: string) => void;
  deleteCustomLyricPreset: (presetId: string) => void;
  uploadBackground: () => void;
  uploadCover: () => void;
  exitLyrics: () => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [previewPatch, setPreviewPatch] = useState<Partial<LyricStyle>>({});
  const dragRef = useRef<{ x: number; y: number; clientX: number; clientY: number; nextX: number; nextY: number } | null>(null);
  const lyricStackRef = useRef<HTMLDivElement>(null);
  const dragFrameRef = useRef<number | null>(null);
  const isTuning = Object.keys(previewPatch).length > 0;
  const style = normalizeLyricStyle({ ...lyricStyle, ...previewPatch });
  const lyricWindow = getLyricWindow(activeTrack, currentTime, style.lyricOffset);
  const cover = getCover(activeTrack);
  const background = style.backgroundImage || cover;
  const allPresets = [...lyricPresets, ...customLyricPresets];
  const previewNumber = (field: keyof LyricStyle, value: number) => setPreviewPatch((current) => ({ ...current, [field]: value }));
  const commitNumber = (field: keyof LyricStyle, value: number) => {
    setPreviewPatch((current) => {
      const next = { ...current };
      delete (next as Record<string, unknown>)[field];
      return next;
    });
    updateLyricStyle({ [field]: value } as Partial<LyricStyle>);
  };
  const previewColor = (field: keyof LyricStyle, value: string) => setPreviewPatch((current) => ({ ...current, [field]: value }));
  const commitColor = (field: keyof LyricStyle, value: string) => {
    setPreviewPatch((current) => {
      const next = { ...current };
      delete (next as Record<string, unknown>)[field];
      return next;
    });
    updateLyricStyle({ [field]: value } as Partial<LyricStyle>);
  };
  const applyPreset = (preset: LyricStyle) => {
    setPreviewPatch({});
    updateLyricStyle({ ...preset, backgroundImage: style.backgroundImage });
  };
  const fitReadableStyle = () => {
    setPreviewPatch({});
    const brightPreset = style.presetId === "heart-share";
    updateLyricStyle({
      backgroundDim: brightPreset ? 34 : 62,
      backgroundBlur: brightPreset ? 2 : 8,
      backgroundSaturation: brightPreset ? 86 : 112,
      color: brightPreset ? "#ffffff" : "#b9eeff",
      inactiveColor: brightPreset ? "#6f8298" : "#e7eef4",
      inactiveOpacity: brightPreset ? 0.5 : 0.42,
      glow: brightPreset ? 10 : 20,
      shadow: brightPreset ? 20 : 26,
      panelOpacity: 34,
    });
  };
  const buildLyricTransform = (x: number, y: number) => `translate(-50%, -50%) translate(${x}vw, ${y}vh) scale(${style.scale}) rotateX(${style.rotateX}deg) rotateY(${style.rotateY}deg) rotateZ(${style.rotateZ}deg) skew(${style.skewX}deg, ${style.skewY}deg)`;
  const transform = buildLyricTransform(style.x, style.y);
  const lyricTextStyle: React.CSSProperties = {
    transform,
    opacity: style.opacity,
    perspective: `${style.perspective}px`,
    gap: `${style.lineGap}px`,
    WebkitTextStroke: `1px ${style.stroke}`,
  };
  const activeTextStyle: React.CSSProperties = {
    color: style.color,
    fontSize: style.fontSize,
    textShadow: `0 0 ${style.glow}px ${style.color}, 0 ${Math.round(style.shadow / 3)}px ${style.shadow}px rgba(0,0,0,.5)`,
  };
  const inactiveTextStyle: React.CSSProperties = {
    color: style.inactiveColor,
    opacity: style.inactiveOpacity,
  };
  const finishLyricDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    lyricStackRef.current?.classList.remove("dragging");
    updateLyricStyle({ x: drag.nextX, y: drag.nextY });
  };
  return (
    <div
      className={`lyrics-page-native preset-${style.presetId} mode-${style.lyricDisplayMode} ${style.scanline ? "has-scanline" : ""} ${isTuning ? "is-tuning" : ""}`}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const nextX = Math.max(-40, Math.min(40, drag.x + ((event.clientX - drag.clientX) / window.innerWidth) * 100));
        const nextY = Math.max(-40, Math.min(40, drag.y + ((event.clientY - drag.clientY) / window.innerHeight) * 100));
        drag.nextX = Number(nextX.toFixed(1));
        drag.nextY = Number(nextY.toFixed(1));
        if (dragFrameRef.current !== null) return;
        dragFrameRef.current = window.requestAnimationFrame(() => {
          dragFrameRef.current = null;
          const current = dragRef.current;
          if (!current || !lyricStackRef.current) return;
          lyricStackRef.current.style.transform = buildLyricTransform(current.nextX, current.nextY);
        });
      }}
      onPointerUp={finishLyricDrag}
      onPointerCancel={finishLyricDrag}
    >
      <div className="lyrics-bg" style={{ backgroundImage: `url(${background})`, filter: `blur(${style.backgroundBlur}px) saturate(${style.backgroundSaturation}%)` }} />
      <div className="lyrics-dim" style={{ background: `rgba(0, 0, 0, ${style.backgroundDim / 100})` }} />
      <div className="lyric-decor">
        <div className="decor-title">{activeTrack.title}</div>
        <div className="decor-card"><img alt="" src={cover} /></div>
        <div className="decor-disc"><img alt="" src={cover} /></div>
        <div className="decor-line" />
      </div>
      <button className="lyric-exit" type="button" onClick={exitLyrics} aria-label={"\u9000\u51fa\u6b4c\u8bcd\u9875"}>
        <Icon>keyboard_arrow_down</Icon>
      </button>
      {style.coverEnabled && (
        <div className="lyric-cover-orbit" style={{ left: `calc(50% + ${style.coverX}vw)`, top: `calc(50% + ${style.coverY}vh)`, width: style.coverSize, height: style.coverSize }}>
          <div className={`lyric-cover-disc ${playing && style.coverRotationSeconds > 0 ? "is-spinning" : ""}`} style={{ animationDuration: `${Math.max(1, style.coverRotationSeconds)}s` }}>
            <img alt="Album cover" src={cover} />
            <span />
          </div>
        </div>
      )}
      <div
        ref={lyricStackRef}
        className="lyric-stack"
        style={lyricTextStyle}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.classList.add("dragging");
          dragRef.current = { x: style.x, y: style.y, clientX: event.clientX, clientY: event.clientY, nextX: style.x, nextY: style.y };
        }}
      >
        {style.lyricDisplayMode === "single" ? (
          <h2 key={lyricWindow.active} className="single-line" style={activeTextStyle}>{lyricWindow.active}</h2>
        ) : (
          <>
            {lyricWindow.previous.map((line) => <p key={line} style={inactiveTextStyle}>{line}</p>)}
            <h2 key={lyricWindow.active} style={activeTextStyle}>{lyricWindow.active}</h2>
            {lyricWindow.next.map((line) => <p key={line} style={inactiveTextStyle}>{line}</p>)}
          </>
        )}
      </div>
      <button className="lyric-panel-toggle" type="button" onClick={() => setPanelOpen((current) => !current)} aria-label={"\u6b4c\u8bcd\u6837\u5f0f"}>
        <Icon>{panelOpen ? "close" : "tune"}</Icon>
      </button>
      <aside className={`lyric-style-panel ${panelOpen ? "open" : ""}`} style={{ background: `rgba(18, 20, 22, ${0.3 + style.panelOpacity / 100})` }}>
        <div className="lyric-panel-head">
          <span>{activeTrack.title}</span>
          <b>{activeTrack.artist}</b>
        </div>
        <div className="lyric-panel-actions">
          <button type="button" onClick={uploadBackground}><Icon>wallpaper</Icon>{"\u4e0a\u4f20\u80cc\u666f"}</button>
          <button type="button" onClick={uploadCover}><Icon>album</Icon>{"\u4e0a\u4f20\u5c01\u9762"}</button>
          <button type="button" onClick={() => updateLyricStyle(defaultLyricStyle)}><Icon>restart_alt</Icon>{"\u91cd\u7f6e\u6837\u5f0f"}</button>
        </div>
        <div className="lyric-quick-actions">
          <button type="button" onClick={fitReadableStyle}><Icon>auto_fix_high</Icon>{"\u667a\u80fd\u9002\u914d"}</button>
          <button type="button" onClick={() => saveCustomLyricPreset(style)}><Icon>bookmark_add</Icon>{"\u4fdd\u5b58\u6837\u5f0f"}</button>
          <button type="button" onClick={() => applyLyricStyleToAllTracks(style)}><Icon>library_music</Icon>{"\u5e94\u7528\u5168\u90e8"}</button>
        </div>
        <div className="preset-row">
          {allPresets.map((preset) => (
            <div key={preset.id} className={`preset-card-wrap ${preset.custom ? "is-custom" : ""}`}>
              <button type="button" className={`preset-card preset-thumb-${preset.style.presetId} ${style.presetId === preset.style.presetId ? "active" : ""}`} onClick={() => applyPreset(preset.style)}>
                <span className="preset-thumb"><i /><b /></span>
                <span>{preset.name}</span>
                {preset.custom && <small>{"\u6211\u7684"}</small>}
              </button>
              {preset.custom && (
                <span className="preset-manage">
                  <button type="button" aria-label={`重命名 ${preset.name}`} onClick={() => renameCustomLyricPreset(preset.id)}><Icon>edit</Icon></button>
                  <button type="button" aria-label={`删除 ${preset.name}`} onClick={() => deleteCustomLyricPreset(preset.id)}><Icon>delete</Icon></button>
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mode-row">
          <button type="button" className={style.lyricDisplayMode === "scroll" ? "active" : ""} onClick={() => updateLyricStyle({ lyricDisplayMode: "scroll" })}>{"\u9ed8\u8ba4\u6eda\u52a8"}</button>
          <button type="button" className={style.lyricDisplayMode === "stack" ? "active" : ""} onClick={() => updateLyricStyle({ lyricDisplayMode: "stack" })}>{"3D \u591a\u884c"}</button>
          <button type="button" className={style.lyricDisplayMode === "single" ? "active" : ""} onClick={() => updateLyricStyle({ lyricDisplayMode: "single" })}>{"\u5355\u53e5\u6de1\u5165"}</button>
        </div>
        <div className="lyric-panel-grid compact">
          <RangeControl label="X" value={style.x} min={-40} max={40} step={0.5} unit="vw" onPreview={(value) => previewNumber("x", value)} onCommit={(value) => commitNumber("x", value)} />
          <RangeControl label="Y" value={style.y} min={-40} max={40} step={0.5} unit="vh" onPreview={(value) => previewNumber("y", value)} onCommit={(value) => commitNumber("y", value)} />
          <RangeControl label={"\u5b57\u53f7"} value={style.fontSize} min={28} max={96} unit="px" onPreview={(value) => previewNumber("fontSize", value)} onCommit={(value) => commitNumber("fontSize", value)} />
          <RangeControl label={"\u80cc\u666f\u538b\u6697"} value={style.backgroundDim} min={0} max={85} unit="%" onPreview={(value) => previewNumber("backgroundDim", value)} onCommit={(value) => commitNumber("backgroundDim", value)} />
          <RangeControl label={"\u80cc\u666f\u6a21\u7cca"} value={style.backgroundBlur} min={0} max={32} unit="px" onPreview={(value) => previewNumber("backgroundBlur", value)} onCommit={(value) => commitNumber("backgroundBlur", value)} />
          <RangeControl label={"\u5c01\u9762\u5927\u5c0f"} value={style.coverSize} min={120} max={340} unit="px" onPreview={(value) => previewNumber("coverSize", value)} onCommit={(value) => commitNumber("coverSize", value)} />
        </div>
        <button className="advanced-toggle" type="button" onClick={() => setAdvancedOpen((current) => !current)}>
          <Icon>{advancedOpen ? "expand_less" : "expand_more"}</Icon>{advancedOpen ? "\u6536\u8d77\u9ad8\u7ea7\u53c2\u6570" : "\u9ad8\u7ea7\u53c2\u6570"}
        </button>
        {advancedOpen && <div className="lyric-panel-grid advanced">
          <RangeControl label={"\u7f29\u653e"} value={style.scale} min={0.6} max={1.8} step={0.05} onPreview={(value) => previewNumber("scale", value)} onCommit={(value) => commitNumber("scale", value)} />
          <RangeControl label="X 3D" value={style.rotateX} min={-45} max={45} unit="deg" onPreview={(value) => previewNumber("rotateX", value)} onCommit={(value) => commitNumber("rotateX", value)} />
          <RangeControl label="Y 3D" value={style.rotateY} min={-45} max={45} unit="deg" onPreview={(value) => previewNumber("rotateY", value)} onCommit={(value) => commitNumber("rotateY", value)} />
          <RangeControl label="Z" value={style.rotateZ} min={-20} max={20} unit="deg" onPreview={(value) => previewNumber("rotateZ", value)} onCommit={(value) => commitNumber("rotateZ", value)} />
          <RangeControl label="Skew X" value={style.skewX} min={-20} max={20} unit="deg" onPreview={(value) => previewNumber("skewX", value)} onCommit={(value) => commitNumber("skewX", value)} />
          <RangeControl label="Skew Y" value={style.skewY} min={-20} max={20} unit="deg" onPreview={(value) => previewNumber("skewY", value)} onCommit={(value) => commitNumber("skewY", value)} />
          <RangeControl label={"\u900f\u89c6"} value={style.perspective} min={500} max={1800} unit="px" onPreview={(value) => previewNumber("perspective", value)} onCommit={(value) => commitNumber("perspective", value)} />
          <RangeControl label={"\u900f\u660e"} value={style.opacity} min={0.35} max={1} step={0.05} onPreview={(value) => previewNumber("opacity", value)} onCommit={(value) => commitNumber("opacity", value)} />
          <RangeControl label={"\u6b4c\u8bcd\u504f\u79fb"} value={style.lyricOffset} min={-5} max={5} step={0.1} unit="s" onPreview={(value) => previewNumber("lyricOffset", value)} onCommit={(value) => commitNumber("lyricOffset", value)} />
          <RangeControl label={"\u526f\u8bcd\u900f\u660e"} value={style.inactiveOpacity} min={0.15} max={0.9} step={0.05} onPreview={(value) => previewNumber("inactiveOpacity", value)} onCommit={(value) => commitNumber("inactiveOpacity", value)} />
          <RangeControl label={"\u884c\u8ddd"} value={style.lineGap} min={8} max={48} unit="px" onPreview={(value) => previewNumber("lineGap", value)} onCommit={(value) => commitNumber("lineGap", value)} />
          <RangeControl label={"\u80cc\u666f\u6a21\u7cca"} value={style.backgroundBlur} min={0} max={32} unit="px" onPreview={(value) => previewNumber("backgroundBlur", value)} onCommit={(value) => commitNumber("backgroundBlur", value)} />
          <RangeControl label={"\u80cc\u666f\u538b\u6697"} value={style.backgroundDim} min={0} max={85} unit="%" onPreview={(value) => previewNumber("backgroundDim", value)} onCommit={(value) => commitNumber("backgroundDim", value)} />
          <RangeControl label={"\u9971\u548c\u5ea6"} value={style.backgroundSaturation} min={60} max={160} unit="%" onPreview={(value) => previewNumber("backgroundSaturation", value)} onCommit={(value) => commitNumber("backgroundSaturation", value)} />
          <RangeControl label={"\u53d1\u5149"} value={style.glow} min={0} max={48} unit="px" onPreview={(value) => previewNumber("glow", value)} onCommit={(value) => commitNumber("glow", value)} />
          <RangeControl label={"\u9634\u5f71"} value={style.shadow} min={0} max={48} unit="px" onPreview={(value) => previewNumber("shadow", value)} onCommit={(value) => commitNumber("shadow", value)} />
          <RangeControl label={"\u9762\u677f"} value={style.panelOpacity} min={0} max={70} unit="%" onPreview={(value) => previewNumber("panelOpacity", value)} onCommit={(value) => commitNumber("panelOpacity", value)} />
          <RangeControl label={"\u5c01\u9762 X"} value={style.coverX} min={-40} max={40} step={0.5} unit="vw" onPreview={(value) => previewNumber("coverX", value)} onCommit={(value) => commitNumber("coverX", value)} />
          <RangeControl label={"\u5c01\u9762 Y"} value={style.coverY} min={-40} max={40} step={0.5} unit="vh" onPreview={(value) => previewNumber("coverY", value)} onCommit={(value) => commitNumber("coverY", value)} />
          <RangeControl label={"\u65cb\u8f6c\u901f\u5ea6"} value={style.coverRotationSeconds} min={0} max={18} unit="s" onPreview={(value) => previewNumber("coverRotationSeconds", value)} onCommit={(value) => commitNumber("coverRotationSeconds", value)} />
        </div>}
        <div className="lyric-color-row">
          <ColorControl label={"\u4e3b\u6b4c\u8bcd"} value={style.color} onPreview={(value) => previewColor("color", value)} onCommit={(value) => commitColor("color", value)} />
          <ColorControl label={"\u526f\u6b4c\u8bcd"} value={style.inactiveColor} onPreview={(value) => previewColor("inactiveColor", value)} onCommit={(value) => commitColor("inactiveColor", value)} />
        </div>
        <div className="lyric-toggle-row">
          <label><input type="checkbox" checked={style.scanline} onChange={(event) => updateLyricStyle({ scanline: event.currentTarget.checked })} />{'\u5149\u6805'}</label>
          <label><input type="checkbox" checked={style.coverEnabled} onChange={(event) => updateLyricStyle({ coverEnabled: event.currentTarget.checked })} />{'\u65cb\u8f6c\u5c01\u9762'}</label>
        </div>
      </aside>
    </div>
  );
}

function MiniPage({ activeTrack }: { activeTrack: Track }) {
  return <div className="page-inner mini-queue"><div className="empty-state">{"\u64ad\u653e\u5217\u8868\u9884\u89c8\uff1a"}{activeTrack.title}</div></div>;
}

function PlayerBar({
  activeTrack,
  playing,
  currentTime,
  volume,
  setVolume,
  playRelative,
  togglePlayback,
  seekTo,
  navigate,
}: {
  activeTrack: Track;
  playing: boolean;
  currentTime: number;
  volume: number;
  setVolume: (volume: number) => void;
  playRelative: (offset: number) => void;
  togglePlayback: () => void;
  seekTo: (seconds: number) => void;
  navigate: (view: View) => void;
}) {
  const progress = activeTrack.duration ? Math.min(100, (currentTime / activeTrack.duration) * 100) : 0;
  const updateFromPointer = (event: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    seekTo(percent * activeTrack.duration);
  };
  return (
    <footer className="player-bar">
      <div className="now-playing">
        <div className="now-cover"><img alt="Now Playing" src={getCover(activeTrack)} /></div>
        <div><b>{activeTrack.title}</b><span>{activeTrack.artist}</span></div>
        <button type="button" className="favorite"><Icon>favorite</Icon></button>
      </div>
      <div className="player-center">
        <div className="player-buttons">
          <button type="button"><Icon>shuffle</Icon></button>
          <button type="button" onClick={() => playRelative(-1)}><Icon>skip_previous</Icon></button>
          <button className="play-main" type="button" onClick={togglePlayback} aria-label={playing ? "\u6682\u505c" : "\u64ad\u653e"}><Icon>{playing ? "pause" : "play_arrow"}</Icon></button>
          <button type="button" onClick={() => playRelative(1)}><Icon>skip_next</Icon></button>
          <button type="button"><Icon>repeat</Icon></button>
        </div>
        <div className="progress-line">
          <span>{formatDuration(currentTime)}</span>
          <div className="progress-track" onPointerDown={updateFromPointer} onClick={updateFromPointer}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <div className="progress-thumb" style={{ left: `${progress}%` }} />
          </div>
          <span>{activeTrack.durationLabel}</span>
        </div>
      </div>
      <div className="player-actions">
        <button type="button" onClick={() => navigate("lyrics")} aria-label={"\u6b4c\u8bcd"}><Icon>lyrics</Icon></button>
        <button type="button" onClick={() => navigate("mini")} aria-label={"\u64ad\u653e\u5217\u8868"}><Icon>queue_music</Icon></button>
        <div className="volume-control" onWheel={(event) => {
          event.preventDefault();
          setVolume(Math.max(0, Math.min(1, volume + (event.deltaY < 0 ? 0.04 : -0.04))));
        }}>
          <Icon>volume_up</Icon>
          <input type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={(event) => setVolume(Number(event.currentTarget.value) / 100)} />
          <span>{Math.round(volume * 100)}</span>
        </div>
        <button type="button" aria-label={"\u5168\u5c4f"}><Icon>fullscreen</Icon></button>
      </div>
    </footer>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
