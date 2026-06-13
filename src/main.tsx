import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type View = "main" | "playlist" | "recent" | "import" | "lyrics" | "mini";

type LyricStyle = {
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
  lyrics?: TrackLyrics;
  lyricStyle: LyricStyle;
};

const stitchPages: Record<View, string> = {
  main: "stitch/main.html",
  playlist: "stitch/playlist.html",
  recent: "stitch/recent.html",
  import: "stitch/import.html",
  lyrics: "stitch/lyrics.html",
  mini: "stitch/mini.html",
};

const defaultLyricStyle: LyricStyle = {
  x: 0,
  y: 0,
  scale: 1,
  rotateZ: 0,
  rotateX: 0,
  rotateY: 0,
  skewX: 0,
  skewY: 0,
  perspective: 900,
  opacity: 1,
  fontSize: 48,
  color: "#a7e0ff",
  stroke: "rgba(0,0,0,.35)",
  shadow: 24,
  glow: 20,
};

const starterTracks: Track[] = [
  {
    id: "demo-1",
    title: "Luminous Drift",
    artist: "Echoes of Silence",
    album: "Neon Nights Vol. 1",
    duration: 252,
    durationLabel: "04:12",
    added: "2澶╁墠",
    format: "FLAC",
    lyricStyle: defaultLyricStyle,
  },
  {
    id: "demo-2",
    title: "Synthesizer Dreams",
    artist: "Aurora Borealis",
    album: "Midnight Drives",
    duration: 225,
    durationLabel: "03:45",
    added: "1鍛ㄥ墠",
    format: "MP3",
    lyricStyle: defaultLyricStyle,
  },
  {
    id: "demo-3",
    title: "Glass Resonance",
    artist: "The Architects",
    album: "Structure & Form",
    duration: 321,
    durationLabel: "05:21",
    added: "2鍛ㄥ墠",
    format: "WAV",
    lyricStyle: defaultLyricStyle,
  },
];

const placeholderTrack: Track = {
  id: "placeholder",
  title: "暂无播放",
  artist: "导入歌曲后开始播放",
  album: "",
  duration: 0,
  durationLabel: "00:00",
  added: "",
  format: "",
  lyricStyle: defaultLyricStyle,
  lyrics: { source: "lrclib", status: "unmatched" },
};

const libraryKey = "transparent-lyrics:library:v1";
const activeTrackKey = "transparent-lyrics:active-track:v1";
const recentTrackIdsKey = "transparent-lyrics:recent-track-ids:v1";
const recentTrackLimit = 200;
const reimportLabel = "\u9700\u91cd\u65b0\u5bfc\u5165";
const localMusicLabel = "\u672c\u5730\u97f3\u4e50";
const justNowLabel = "\u521a\u521a";

function textOf(element: Element) {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
}

function createTrackFromImportedFile(file: ImportedAudioFile, index: number): Track {
  const title = file.title || file.name || "鏈湴闊充箰";
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
    lyricStyle: defaultLyricStyle,
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
  if (status === "matched") return "已匹配";
  if (status === "not-found") return "无结果";
  if (status === "failed") return "匹配失败";
  return "未匹配";
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

function getLyricWindow(track: Track, currentTime: number) {
  const synced = parseLrcLines(track.lyrics?.syncedText);
  if (!synced.length) {
    const plain = track.lyrics?.plainText
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return plain?.length
      ? { previous: plain.slice(0, 2), active: plain[2] ?? plain[0], next: plain.slice(3, 5) }
      : { previous: ["You've been running through my mind", "Looking for a place to hide"], active: "In the luminous clarity of the night", next: ["We finally found our way", "Out of the dark and into the light"] };
  }
  const activeIndex = Math.max(0, synced.findIndex((line, index) => {
    const next = synced[index + 1];
    return currentTime >= line.time && (!next || currentTime < next.time);
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
  const [history, setHistory] = useState<View[]>(["main"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tracks, setTracks] = useState<Track[]>(readLibrary);
  const [activeTrackId, setActiveTrackId] = useState(() => localStorage.getItem(activeTrackKey) ?? readLibrary()[0]?.id);
  const [recentTrackIds, setRecentTrackIds] = useState<string[]>(readRecentTrackIds);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [matchingLyrics, setMatchingLyrics] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlsRef = useRef<Map<string, string>>(new Map());
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);
  const src = useMemo(() => stitchPages[view], [view]);
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
      setIframeReady(false);
      setView(nextView);
      setHistory((current) => {
        const next = [...current.slice(0, historyIndex + 1), nextView];
        setHistoryIndex(next.length - 1);
        return next;
      });
    },
    [historyIndex, view],
  );

  const goBack = useCallback(() => {
    setHistoryIndex((currentIndex) => {
      const nextIndex = Math.max(0, currentIndex - 1);
      if (nextIndex !== currentIndex) setIframeReady(false);
      setView(history[nextIndex] ?? "main");
      return nextIndex;
    });
  }, [history]);

  const goForward = useCallback(() => {
    setHistoryIndex((currentIndex) => {
      const nextIndex = Math.min(history.length - 1, currentIndex + 1);
      if (nextIndex !== currentIndex) setIframeReady(false);
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

  const importImage = useCallback(async () => {
    const imageUrl = await window.transparentLyrics?.openImageFile?.();
    if (imageUrl && activeTrack) {
      const nextTracks = tracks.map((track) =>
        track.id === activeTrack.id
          ? { ...track, lyricStyle: { ...track.lyricStyle, backgroundImage: imageUrl } }
          : track,
      );
      commitTracks(nextTracks);
      patchCurrentIframe(iframeRef.current?.contentDocument, tracks, recentTracks, activeTrack, playing, currentTime, volume);
      return;
    }
    imageInputRef.current?.click();
  }, [activeTrack, commitTracks, currentTime, playing, recentTracks, tracks, volume]);

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

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    patchCurrentIframe(doc, tracks, recentTracks, activeTrack, playing, currentTime, volume, {
      currentView: view,
      navigate,
      goBack,
      goForward,
      playTrack,
      playRelative,
      togglePlayback,
      seekTo,
      importAudio,
      importFolder,
      importLrc,
      importImage,
      matchAllLyrics,
      retryActiveLyrics,
      setVolume,
    });
  }, [
    activeTrack,
    currentTime,
    goBack,
    goForward,
    importAudio,
    importFolder,
    importImage,
    importLrc,
    matchAllLyrics,
    navigate,
    playRelative,
    playTrack,
    seekTo,
    playing,
    retryActiveLyrics,
    recentTracks,
    tracks,
    togglePlayback,
    view,
    volume,
  ]);

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    patchCurrentIframe(iframe.contentDocument, tracks, recentTracks, activeTrack, playing, currentTime, volume, {
      currentView: view,
      navigate,
      goBack,
      goForward,
      playTrack,
      playRelative,
      togglePlayback,
      seekTo,
      importAudio,
      importFolder,
      importLrc,
      importImage,
      matchAllLyrics,
      retryActiveLyrics,
      setVolume,
    });
    requestAnimationFrame(() => setIframeReady(true));
  }, [
    activeTrack,
    currentTime,
    goBack,
    goForward,
    importAudio,
    importFolder,
    importImage,
    importLrc,
    matchAllLyrics,
    navigate,
    playRelative,
    playTrack,
    seekTo,
    playing,
    retryActiveLyrics,
    recentTracks,
    tracks,
    togglePlayback,
    view,
    volume,
  ]);

  return (
    <main className="stitch-host">
      <iframe
        ref={iframeRef}
        className={iframeReady ? "stitch-frame-ready" : "stitch-frame-loading"}
        src={src}
        title="Transparent Lyrics Stitch UI"
        onLoad={handleIframeLoad}
      />
      <div className="player-hitboxes" aria-label="player controls">
        <button className="player-hitbox player-prev-hitbox" type="button" aria-label="上一首" onClick={() => playRelative(-1)} />
        <button className="player-hitbox player-play-hitbox" type="button" aria-label={playing ? "鏆傚仠" : "鎾斁"} onClick={togglePlayback} />
        <button className="player-hitbox player-next-hitbox" type="button" aria-label="下一首" onClick={() => playRelative(1)} />
        <div
          className="player-progress-hitbox"
          role="slider"
          aria-label="鎾斁杩涘害"
          aria-valuemin={0}
          aria-valuemax={Math.round(activeTrack.duration || 0)}
          aria-valuenow={Math.round(currentTime)}
          onPointerDown={(event) => {
            const target = event.currentTarget;
            const update = (clientX: number) => {
              const rect = target.getBoundingClientRect();
              const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
              const audioDuration = audioRef.current && Number.isFinite(audioRef.current.duration)
                ? audioRef.current.duration
                : activeTrack.duration;
              seekTo(percent * (audioDuration || 0));
            };
            target.setPointerCapture(event.pointerId);
            update(event.clientX);
          }}
          onPointerMove={(event) => {
            if (event.buttons !== 1) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            const audioDuration = audioRef.current && Number.isFinite(audioRef.current.duration)
              ? audioRef.current.duration
              : activeTrack.duration;
            seekTo(percent * (audioDuration || 0));
          }}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            const audioDuration = audioRef.current && Number.isFinite(audioRef.current.duration)
              ? audioRef.current.duration
              : activeTrack.duration;
            seekTo(percent * (audioDuration || 0));
          }}
        />
      </div>
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
      <input ref={imageInputRef} className="hidden-input" type="file" accept="image/*" />
    </main>
  );
}

type PatchActions = {
  currentView: View;
  navigate: (view: View) => void;
  goBack: () => void;
  goForward: () => void;
  playTrack: (trackId: string) => void;
  playRelative: (offset: number) => void;
  togglePlayback: () => void;
  seekTo: (seconds: number) => void;
  importAudio: () => void;
  importFolder: () => void;
  importLrc: () => void;
  importImage: () => void;
  matchAllLyrics: () => void;
  retryActiveLyrics: () => void;
  setVolume: (volume: number) => void;
};

function patchCurrentIframe(
  doc: Document | null | undefined,
  tracks: Track[],
  recentTracks: Track[],
  activeTrack: Track,
  playing: boolean,
  currentTime: number,
  volume: number,
  actions?: PatchActions,
) {
  if (!doc) return;
  const currentView = actions?.currentView;
  const displayedTracks = currentView === "recent" ? recentTracks : tracks;
  injectAppCss(doc);
  patchNavigationState(doc, currentView);
  patchLibrarySummary(doc, tracks);
  patchSongs(doc, displayedTracks, activeTrack, playing, actions);
  patchSecondaryTrackRows(doc, displayedTracks, activeTrack, playing, actions);
  patchPlayer(doc, activeTrack, playing, currentTime, volume, actions);
  patchResourceStatus(doc, tracks);
  patchImportedResources(doc, tracks, actions);
  if (doc.querySelector(".font-lyrics-active")) {
    injectLyricsPanelControls(doc);
    patchLyricsPage(doc, activeTrack, currentTime, actions);
  }
  if (actions) {
    wireNavigation(doc, actions);
    wireImportCards(doc, actions);
  }
}

function injectAppCss(doc: Document) {
  if (doc.getElementById("tl-app-patches")) return;
  const style = doc.createElement("style");
  style.id = "tl-app-patches";
  style.textContent = `
    .tl-route-controls { position: fixed; top: 18px; left: 280px; z-index: 9999; display: flex; gap: 8px; }
    body:has(nav) .tl-route-controls { display: none; }
    body:has(aside) .tl-route-controls { display: none; }
    body:not(:has(nav)) .tl-route-controls { left: 24px; }
    .tl-route-controls button, .tl-style-toggle {
      width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 999px; border: 1px solid rgba(255,255,255,.16); color: #e5e2e1;
      background: rgba(19,19,19,.46); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 10px 30px rgba(0,0,0,.25);
    }
    .tl-route-controls button:hover, .tl-style-toggle:hover { color: #a7e0ff; transform: translateY(-1px); }
    .tl-route-controls button:disabled { opacity: .34; cursor: default; transform: none; }
    nav a.tl-nav-active,
    aside a.tl-nav-active {
      color: #e5e2e1 !important;
      background: rgba(255, 255, 255, .10) !important;
    }
    nav a.tl-nav-inactive,
    aside a.tl-nav-inactive {
      color: #bdc8cf !important;
      background: transparent !important;
    }
    nav a.tl-nav-inactive:hover,
    aside a.tl-nav-inactive:hover {
      color: #e5e2e1 !important;
      background: rgba(255, 255, 255, .05) !important;
    }
    .tl-style-panel { top: 5rem !important; bottom: 6.75rem !important; width: 18rem !important; padding: .9rem 1rem !important; gap: .58rem !important; overflow: hidden !important; scrollbar-width: none !important; transition: transform .24s ease, opacity .2s ease; }
    .tl-style-panel::-webkit-scrollbar { display: none !important; }
    .tl-style-panel h2 { padding-bottom: .45rem !important; margin-bottom: .1rem !important; font-size: 11px !important; line-height: 14px !important; }
    .tl-style-panel h3 { padding-bottom: .25rem !important; font-size: 10px !important; line-height: 12px !important; }
    .tl-style-panel .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: .48rem !important; }
    .tl-style-panel .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: .24rem !important; }
    .tl-style-panel .pt-4 { padding-top: .45rem !important; }
    .tl-style-panel .pb-2 { padding-bottom: .22rem !important; }
    .tl-style-panel span, .tl-style-panel button, .tl-style-panel label { font-size: 13px !important; line-height: 18px !important; }
    .tl-style-panel .custom-slider { height: 3px !important; }
    .tl-style-panel .custom-slider::-webkit-slider-thumb { width: 10px !important; height: 10px !important; }
    .tl-style-panel .w-10.h-5 { width: 2rem !important; height: 1rem !important; }
    .tl-style-panel .w-4.h-4 { width: .75rem !important; height: .75rem !important; }
    .tl-style-panel .w-8.h-8 { width: 1.7rem !important; height: 1.7rem !important; }
    .tl-style-panel .w-6.h-6 { width: 1.25rem !important; height: 1.25rem !important; }
    .tl-style-toggle { position: fixed; top: 5.1rem; right: 1rem; z-index: 10000; }
    body.tl-style-hidden .tl-style-panel { transform: translateX(calc(100% + 3rem)); opacity: 0; pointer-events: none; }
    .tl-clickable { cursor: pointer; }
    .glass-row {
      border-left-color: transparent !important;
      transform: none !important;
      transition: background-color .16s ease, border-color .16s ease !important;
    }
    .glass-row:hover {
      transform: none !important;
      background: rgba(255, 255, 255, .055) !important;
    }
    .glass-row.active,
    .glass-row.tl-row-playing {
      background: rgba(167, 224, 255, .10) !important;
    }
    .glass-row .row-actions,
    .glass-row .tl-stitch-hover-play {
      display: none !important;
    }
    .tl-cover-host {
      position: relative !important;
      flex-shrink: 0 !important;
    }
    .glass-row:hover .tl-cover-host::after,
    .tl-row-playing .tl-cover-host::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: rgba(0, 0, 0, .24);
      pointer-events: none;
    }
    .tl-cover-play-badge {
      position: absolute;
      left: 20px;
      top: 50%;
      z-index: 2;
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      color: #e5e2e1;
      background: rgba(19, 19, 19, .54);
      border: 1px solid rgba(255, 255, 255, .22);
      box-shadow: 0 8px 18px rgba(0,0,0,.28);
      transform: translate(-50%, -50%);
      pointer-events: none;
      opacity: 0;
      transition: opacity .14s ease;
    }
    .glass-row:hover .tl-cover-play-badge,
    .tl-row-playing .tl-cover-play-badge {
      opacity: 1;
    }
    .tl-cover-play-badge .material-symbols-outlined {
      font-size: 18px !important;
      font-variation-settings: 'FILL' 1;
    }
    .glass-card, .glass-card [class*='border-dashed'] { cursor: pointer; }
    .glass-card:hover [class*='border-dashed'] {
      border-color: rgba(167, 224, 255, .55) !important;
      background: rgba(167, 224, 255, .04) !important;
    }
    .tl-native-import-card {
      transform: none !important;
      min-width: 0 !important;
      height: auto !important;
      min-height: 17rem !important;
      padding: 1.25rem !important;
    }
    .tl-native-import-card:hover {
      transform: none !important;
      background: rgba(53, 53, 52, .42) !important;
    }
    .tl-native-import-card .dashed-dropzone {
      gap: .7rem !important;
      padding: .85rem !important;
      min-height: 8.6rem !important;
      text-align: center !important;
    }
    .tl-native-import-grid {
      display: grid !important;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) !important;
      gap: 1.25rem !important;
      margin-bottom: 3rem !important;
    }
    .tl-native-import-card h2 {
      overflow-wrap: anywhere !important;
      line-height: 1.16 !important;
    }
    .tl-card-status {
      color: #bdc8cf;
      font: 600 12px/16px Inter, "Microsoft YaHei", sans-serif;
    }
    .tl-card-actions {
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: .5rem;
    }
    .tl-card-action {
      min-width: 7.2rem;
      height: 2rem;
      padding: 0 .85rem;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.15);
      background: rgba(255,255,255,.08);
      color: #e5e2e1;
      font: 700 12px/1 Inter, "Microsoft YaHei", sans-serif;
      cursor: pointer;
    }
    .tl-card-action:hover {
      border-color: rgba(167, 224, 255, .5);
      background: rgba(167, 224, 255, .16);
      color: #a7e0ff;
    }
    .tl-empty-state {
      padding: 3rem 1rem;
      color: #bdc8cf;
      font: 700 15px/1.6 Inter, "Microsoft YaHei", sans-serif;
      text-align: center;
      border-top: 1px solid rgba(255,255,255,.08);
    }
    .tl-progress-track {
      position: relative !important;
      height: 6px !important;
      overflow: visible !important;
      cursor: pointer !important;
      background: rgba(255, 255, 255, .12) !important;
    }
    .tl-progress-fill {
      height: 100% !important;
      background: #a7e0ff !important;
      box-shadow: 0 0 12px rgba(167, 224, 255, .4);
      pointer-events: none;
    }
    .tl-progress-thumb {
      position: absolute !important;
      top: 50% !important;
      width: 13px !important;
      height: 13px !important;
      border-radius: 999px !important;
      background: #a7e0ff !important;
      border: 2px solid rgba(19, 19, 19, .72) !important;
      box-shadow: 0 0 0 4px rgba(167, 224, 255, .16), 0 8px 20px rgba(0,0,0,.35) !important;
      opacity: 1 !important;
      transform: translate(-50%, -50%) !important;
      pointer-events: none !important;
      transition: none !important;
    }
    .tl-volume-track {
      position: relative !important;
      overflow: visible !important;
      cursor: pointer !important;
    }
    .tl-volume-fill {
      background: #a7e0ff !important;
      box-shadow: 0 0 12px rgba(167, 224, 255, .45);
    }
    .tl-volume-thumb {
      position: absolute;
      top: 50%;
      width: 14px;
      height: 14px;
      border-radius: 999px;
      border: 2px solid rgba(167, 224, 255, .9);
      background: rgba(19, 19, 19, .82);
      box-shadow: 0 0 0 4px rgba(167, 224, 255, .12), 0 8px 22px rgba(0,0,0,.35);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .tl-volume-bubble {
      position: absolute;
      left: 0;
      top: -36px;
      min-width: 34px;
      height: 30px;
      padding: 0 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      color: #e5e2e1;
      font: 600 13px/1 Inter, "Microsoft YaHei", sans-serif;
      background: rgba(35, 35, 40, .96);
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 10px 24px rgba(0,0,0,.38);
      transform: translateX(-50%);
      pointer-events: none;
      opacity: 0;
      transition: opacity .16s ease, transform .16s ease;
    }
    .tl-volume-track:hover .tl-volume-bubble,
    .tl-volume-track.tl-volume-active .tl-volume-bubble {
      opacity: .92;
      transform: translateX(-50%) translateY(-2px);
    }
  `;
  doc.head.appendChild(style);
}

function getNavItems(doc: Document) {
  return Array.from(doc.querySelectorAll("nav a, aside a")) as HTMLElement[];
}

function viewForNavItem(element: HTMLElement, index?: number): View | null {
  const text = textOf(element);
  if (/library_music|音乐库|闊充箰/.test(text)) return "main";
  if (/history|最近播放/.test(text)) return "recent";
  if (/upload_file|导入资源|资源导入|瀵煎叆/.test(text)) return "import";
  if (/深夜沉浸|playlist_play/.test(text)) return "playlist";
  if (/雨天漫步|water_drop/.test(text)) return "playlist";
  if (/工作电台/.test(text)) return "playlist";
  if (index === 0) return "main";
  if (index === 1) return "recent";
  if (index === 2) return "import";
  if (typeof index === "number" && index >= 3) return "playlist";
  return null;
}

function patchNavigationState(doc: Document, currentView?: View) {
  if (!currentView) return;
  getNavItems(doc).forEach((element, index) => {
    const targetView = viewForNavItem(element, index);
    if (!targetView) return;
    element.dataset.tlView = targetView;
    const isActive = targetView === currentView || (currentView === "lyrics" && targetView === "main");
    element.classList.toggle("tl-nav-active", isActive);
    element.classList.toggle("tl-nav-inactive", !isActive);
  });
}

function wireSideNavigation(doc: Document, getActions: () => PatchActions) {
  getNavItems(doc).forEach((element, index) => {
    const targetView = viewForNavItem(element, index);
    if (!targetView) return;
    element.dataset.tlView = targetView;
    if (element.dataset.tlNavReady === "true") return;
    element.dataset.tlNavReady = "true";
    element.classList.add("tl-clickable");
    element.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        getActions().navigate((element.dataset.tlView as View | undefined) ?? targetView);
      },
      true,
    );
  });
}

function patchLibrarySummary(doc: Document, tracks: Track[]) {
  const heading = Array.from(doc.querySelectorAll("h2")).find((element) => /音乐库|闊充箰/.test(textOf(element)));
  if (!heading) return;
  const summary = heading.nextElementSibling;
  if (!summary) return;
  const spans = Array.from(summary.querySelectorAll("span")) as HTMLElement[];
  const totalSeconds = tracks.reduce((sum, track) => sum + (Number(track.duration) || 0), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (spans[0]) spans[0].textContent = `${tracks.length} 首歌曲`;
  if (spans[2]) spans[2].textContent = hours ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`;
}

function wireNavigation(doc: Document, actions: PatchActions) {
  (doc.body as HTMLElement & { __tlActions?: PatchActions }).__tlActions = actions;
  const getActions = () => (doc.body as HTMLElement & { __tlActions?: PatchActions }).__tlActions ?? actions;
  wireSideNavigation(doc, getActions);
  if (doc.body.dataset.tlNavigationReady === "true") return;
  doc.body.dataset.tlNavigationReady = "true";
  const controls = doc.createElement("div");
  controls.className = "tl-route-controls";
  controls.innerHTML = `
    <button type="button" aria-label="杩斿洖"><span class="material-symbols-outlined">arrow_back_ios_new</span></button>
    <button type="button" aria-label="鍓嶈繘"><span class="material-symbols-outlined">arrow_forward_ios</span></button>
  `;
  if (doc.querySelector("nav, aside")) {
    controls.style.display = "none";
  }
  const [backButton, forwardButton] = Array.from(controls.querySelectorAll("button"));
  backButton?.addEventListener("click", () => getActions().goBack());
  forwardButton?.addEventListener("click", () => getActions().goForward());
  doc.body.appendChild(controls);

  doc.body.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(".glass-row")) return;
      if (target.closest(".tl-card-action")) return;
      const hit = target.closest("a, button, .glass-card, .glass-panel, .group, [class*='border-dashed']") as
        | HTMLElement
        | null;
      if (!hit) return;
      const text = textOf(hit);
      const navHit = hit.closest("nav a, aside a") as HTMLElement | null;
      const navItems = navHit ? getNavItems(doc) : [];
      const navIndex = navHit ? navItems.indexOf(navHit) : -1;
      const navTarget =
        (navHit?.dataset.tlView as View | undefined) ??
        (navHit ? viewForNavItem(navHit, navIndex) : null);
      const card = target.closest(".glass-card") as HTMLElement | null;
      const cardText = card ? textOf(card) : text;

      const run = (handler: () => void) => {
        event.preventDefault();
        event.stopPropagation();
        handler();
      };
      const currentActions = getActions();

      if (navTarget) return run(() => currentActions.navigate(navTarget));
      if (/lyrics/.test(text)) return run(() => currentActions.navigate("lyrics"));
      if (/queue_music|鏍峰紡棰勮|杩蜂綘/.test(text)) return run(() => currentActions.navigate("mini"));
      if (/arrow_back_ios|chevron_left/.test(text)) return run(currentActions.goBack);
      if (/arrow_forward_ios|chevron_right/.test(text)) return run(currentActions.goForward);
      if (/pause|play_arrow|鍏ㄩ儴鎾斁/.test(text)) return run(currentActions.togglePlayback);
      if (/skip_previous/.test(text)) return run(() => currentActions.playRelative(-1));
      if (/skip_next/.test(text)) return run(() => currentActions.playRelative(1));

      if (/瀵煎叆姝屾洸|cloud_upload|鎷栨嫿鏂囦欢鑷虫|鐐瑰嚮閫夋嫨/.test(cardText)) return run(currentActions.importAudio);
      if (/瀵煎叆姝岃瘝|LRC|subtitles|鎷栨嫿 LRC/.test(cardText)) return run(currentActions.importLrc);
      if (/涓婁紶澹佺焊|閫夋嫨鍥剧墖|wallpaper/.test(cardText)) return run(currentActions.importImage);
      if (/瀵煎叆灏侀潰鍥緗add_photo_alternate|鎷栨嫿灏侀潰/.test(cardText)) return run(currentActions.importImage);
    },
    true,
  );

  Array.from(doc.querySelectorAll("a, button, [role='button']")).forEach((element) => {
    const htmlElement = element as HTMLElement;
    if (htmlElement.closest("nav, aside")) return;
    if (htmlElement.closest(".glass-row")) return;
    if (htmlElement.closest(".tl-card-action")) return;
    if (htmlElement.closest(".glass-card")) return;
    const text = textOf(htmlElement);
    const bind = (handler: () => void) => {
      htmlElement.classList.add("tl-clickable");
      htmlElement.addEventListener("click", (event) => {
        event.preventDefault();
        handler();
      });
    };

    if (/lyrics/.test(text)) bind(() => actions.navigate("lyrics"));
    if (/queue_music|鏍峰紡棰勮|杩蜂綘/.test(text)) bind(() => actions.navigate("mini"));
    if (/arrow_back_ios|chevron_left/.test(text)) bind(actions.goBack);
    if (/arrow_forward_ios|chevron_right/.test(text)) bind(actions.goForward);
    if (/pause|play_arrow|鍏ㄩ儴鎾斁/.test(text)) bind(actions.togglePlayback);
    if (/skip_previous/.test(text)) bind(() => actions.playRelative(-1));
    if (/skip_next/.test(text)) bind(() => actions.playRelative(1));
    if (/鎷栨嫿鏂囦欢鑷虫|瀵煎叆姝屾洸|cloud_upload/.test(text)) bind(actions.importAudio);
    if (/LRC|瀵煎叆姝岃瘝|subtitles/.test(text)) bind(actions.importLrc);
    if (/涓婁紶澹佺焊|閫夋嫨鍥剧墖|灏侀潰|add_photo_alternate|wallpaper|image/.test(text)) bind(actions.importImage);
  });
}

function wireImportCards(doc: Document, actions: PatchActions) {
  const cards = Array.from(doc.querySelectorAll(".glass-card")) as HTMLElement[];
  if (!cards.length) return;
  cards[0]?.parentElement?.classList.add("tl-native-import-grid");
  const configureCard = (
    card: HTMLElement | undefined,
    options: {
      icon: string;
      title: string;
      description: string;
      body: string;
      fallback: () => void;
      buttons: Array<{ selector: string; handler: () => void }>;
    },
  ) => {
    if (!card) return;
    card.classList.add("tl-native-import-card", "tl-clickable");
    const icon = card.querySelector(".material-symbols-outlined") as HTMLElement | null;
    const title = card.querySelector("h2") as HTMLElement | null;
    const description = card.querySelector("p") as HTMLElement | null;
    const dropzone = card.querySelector(".dashed-dropzone") as HTMLElement | null;
    if (icon) icon.textContent = options.icon;
    if (title) title.textContent = options.title;
    if (description) description.textContent = options.description;
    if (dropzone && dropzone.dataset.tlNativeReady !== "true") {
      dropzone.dataset.tlNativeReady = "true";
      dropzone.innerHTML = options.body;
    }
    if (card.dataset.tlImportReady !== "true") {
      card.dataset.tlImportReady = "true";
      card.addEventListener("click", (event) => {
        if ((event.target as HTMLElement | null)?.closest(".tl-card-action")) return;
        event.preventDefault();
        event.stopPropagation();
        options.fallback();
      });
    }
    options.buttons.forEach(({ selector, handler }) => {
      const button = card.querySelector(selector) as HTMLElement | null;
      if (!button || button.dataset.tlButtonReady === "true") return;
      button.dataset.tlButtonReady = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handler();
      });
    });
  };

  configureCard(cards[0], {
    icon: "library_add",
    title: "导入本地歌曲",
    description: "选择单首歌曲，或扫描整个音乐文件夹。",
    body: `
      <span class="material-symbols-outlined text-4xl text-outline mb-3 group-hover:text-primary transition-colors">library_music</span>
      <div class="tl-card-status">导入后自动尝试匹配歌词</div>
      <div class="tl-card-actions">
        <button class="tl-card-action" data-action="audio-file" type="button">选择歌曲文件</button>
        <button class="tl-card-action" data-action="audio-folder" type="button">选择音乐文件夹</button>
      </div>
    `,
    fallback: actions.importAudio,
    buttons: [
      { selector: "[data-action='audio-file']", handler: actions.importAudio },
      { selector: "[data-action='audio-folder']", handler: actions.importFolder },
    ],
  });

  configureCard(cards[1], {
    icon: "lyrics",
    title: "歌词补全",
    description: "支持 LRC 导入，也可批量在线匹配本地歌曲。",
    body: `
      <span class="material-symbols-outlined text-4xl text-outline mb-3 group-hover:text-primary transition-colors">subtitles</span>
      <div class="tl-card-status">优先保存同步歌词</div>
      <div class="tl-card-actions">
        <button class="tl-card-action" data-action="lyrics-batch" type="button">批量补全歌词</button>
        <button class="tl-card-action" data-action="lyrics-file" type="button">导入 LRC 文件</button>
      </div>
    `,
    fallback: actions.matchAllLyrics,
    buttons: [
      { selector: "[data-action='lyrics-batch']", handler: actions.matchAllLyrics },
      { selector: "[data-action='lyrics-file']", handler: actions.importLrc },
    ],
  });

  configureCard(cards[2], {
    icon: "wallpaper",
    title: "上传壁纸",
    description: "为歌词页面设置专属背景图。",
    body: `
      <span class="material-symbols-outlined text-4xl text-outline mb-3 group-hover:text-primary transition-colors">add_photo_alternate</span>
      <div class="tl-card-status">支持 JPG、PNG 等图片</div>
      <div class="tl-card-actions">
        <button class="tl-card-action" data-action="wallpaper-file" type="button">选择图片</button>
      </div>
    `,
    fallback: actions.importImage,
    buttons: [{ selector: "[data-action='wallpaper-file']", handler: actions.importImage }],
  });

  configureCard(cards[3], {
    icon: "image",
    title: "关联封面图",
    description: "为当前歌曲补充封面，后续会支持自动补全。",
    body: `
      <span class="material-symbols-outlined text-4xl text-outline mb-3 group-hover:text-primary transition-colors">add_photo_alternate</span>
      <div class="tl-card-status">当前版本先手动选择图片</div>
      <div class="tl-card-actions">
        <button class="tl-card-action" data-action="cover-file" type="button">选择封面图</button>
      </div>
    `,
    fallback: actions.importImage,
    buttons: [{ selector: "[data-action='cover-file']", handler: actions.importImage }],
  });
}

function patchSongs(doc: Document, tracks: Track[], activeTrack: Track, playing: boolean, actions?: PatchActions) {
  let rows = Array.from(doc.querySelectorAll(".glass-row")) as HTMLElement[];
  if (!rows.length) return;
  const rowContainer = rows[0]?.parentElement;
  let emptyState = doc.querySelector(".tl-library-empty-state") as HTMLElement | null;
  if (tracks.length === 0) {
    rows.forEach((row) => {
      row.style.display = "none";
    });
    if (!emptyState && rowContainer) {
      emptyState = doc.createElement("div");
      emptyState.className = "tl-empty-state tl-library-empty-state";
      emptyState.textContent = "音乐库还是空的，先去导入资源添加本地歌曲。";
      rowContainer.appendChild(emptyState);
    }
    if (emptyState) emptyState.style.display = "";
    return;
  }
  if (emptyState) emptyState.style.display = "none";
  while (rowContainer && rows.length < tracks.length) {
    const clone = rows[rows.length - 1].cloneNode(true) as HTMLElement;
    clone.dataset.tlReady = "";
    rowContainer.appendChild(clone);
    rows = Array.from(doc.querySelectorAll(".glass-row")) as HTMLElement[];
  }
  rows.forEach((row, index) => {
    const track = tracks[index];
    if (!track) {
      row.style.display = "none";
      return;
    }
    row.style.display = "";
    const isActive = track.id === activeTrack.id;
    row.classList.toggle("active", isActive);
    row.classList.remove("border-primary");
    row.classList.toggle("tl-row-playing", isActive);
    row.classList.remove("opacity-60");
    row.dataset.trackId = track.id;
    const cells = Array.from(row.children) as HTMLElement[];
    const indexNode = cells[0];
    if (indexNode) {
      indexNode.textContent = String(index + 1);
      indexNode.classList.add("text-center", "font-body-sm", "text-body-sm", "text-on-surface-variant");
      indexNode.classList.remove("hidden", "group-hover:hidden");
      indexNode.style.display = "";
    }
    const titleCell = cells.find((cell) => cell.querySelector(".font-body-lg, .text-body-lg"));
    const titleIndex = titleCell ? cells.indexOf(titleCell) : 1;
    if (titleIndex > 1) {
      cells.slice(1, titleIndex).forEach((cell) => {
        cell.classList.add("tl-stitch-hover-play");
        cell.style.display = "none";
      });
    }
    const titleNode = titleCell?.querySelector(".font-body-lg, .text-body-lg") as HTMLElement | null;
    const artistNode = cells[titleIndex + 1];
    const albumNode = cells[titleIndex + 2];
    const addedNode = cells[titleIndex + 3];
    const durationNode = cells[titleIndex + 4];
    if (titleNode) {
      titleNode.textContent = track.title;
      titleNode.classList.toggle("text-primary", isActive);
      titleNode.classList.remove("line-through", "decoration-on-surface-variant");
    }
    patchCoverPlayBadge(doc, titleCell ?? null, isActive && playing);
    if (artistNode) artistNode.textContent = track.artist;
    if (albumNode) albumNode.textContent = track.album;
    if (addedNode) addedNode.textContent = track.added;
    if (durationNode) {
      const durationText = durationNode.querySelector(".group-hover\\:hidden") as HTMLElement | null;
      if (durationText) {
        durationText.textContent = track.durationLabel;
      } else {
        durationNode.textContent = track.durationLabel;
      }
    }
    row.dataset.tlTrackId = track.id;
    if (actions && row.dataset.tlReady !== "true") {
      row.dataset.tlReady = "true";
      row.classList.add("tl-clickable");
      const playRow = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        actions.playTrack(row.dataset.tlTrackId ?? track.id);
      };
      row.addEventListener("dblclick", playRow);
      row.addEventListener("click", (event) => {
        playRow(event);
      });
    }
  });
}

function patchCoverPlayBadge(doc: Document, titleCell: HTMLElement | null, isPlayingTrack: boolean) {
  if (!titleCell) return;
  titleCell.style.position = "relative";
  const cover = titleCell.querySelector("img, .w-10.h-10") as HTMLElement | null;
  let badge = titleCell.querySelector(".tl-cover-play-badge") as HTMLElement | null;
  if (!cover) {
    badge?.remove();
    return;
  }

  cover.classList.add("tl-cover-host");
  if (!badge) {
    badge = doc.createElement("span");
    badge.className = "tl-cover-play-badge";
    badge.innerHTML = `<span class="material-symbols-outlined"></span>`;
    titleCell.appendChild(badge);
  }
  const icon = badge.querySelector(".material-symbols-outlined") as HTMLElement | null;
  if (icon) icon.textContent = isPlayingTrack ? "pause" : "play_arrow";
}

function patchSecondaryTrackRows(
  doc: Document,
  tracks: Track[],
  activeTrack: Track,
  playing: boolean,
  actions?: PatchActions,
) {
  const rows = Array.from(doc.querySelectorAll("main .space-y-1 > div.grid")) as HTMLElement[];
  if (!rows.length || doc.querySelector(".glass-row")) return;
  const container = rows[0]?.parentElement;
  let emptyState = doc.querySelector(".tl-empty-state") as HTMLElement | null;
  if (actions?.currentView === "recent" && tracks.length === 0) {
    rows.forEach((row) => {
      row.style.display = "none";
    });
    if (!emptyState && container) {
      emptyState = doc.createElement("div");
      emptyState.className = "tl-empty-state";
      emptyState.textContent = "暂无最近播放，开始听歌后会自动记录最近 200 首。";
      container.appendChild(emptyState);
    }
    if (emptyState) emptyState.style.display = "";
    return;
  }
  if (emptyState) emptyState.style.display = "none";
  while (container && rows.length < tracks.length) {
    const clone = rows[rows.length - 1].cloneNode(true) as HTMLElement;
    clone.dataset.tlReady = "";
    container.appendChild(clone);
    rows.push(clone);
  }

  rows.forEach((row, index) => {
    const track = tracks[index];
    if (!track) {
      row.style.display = "none";
      return;
    }
    row.style.display = "";
    const isActive = track.id === activeTrack.id;
    row.classList.toggle("tl-row-playing", isActive);
    row.dataset.tlTrackId = track.id;

    const cells = Array.from(row.children) as HTMLElement[];
    const indexCell = cells[0];
    if (indexCell) {
      const indexText = (index + 1).toString().padStart(2, "0");
      const directIndex = indexCell.querySelector("span") as HTMLElement | null;
      if (directIndex) directIndex.textContent = indexText;
      else indexCell.textContent = indexText;
    }

    const titleCell = cells.find((cell) => cell.querySelector("img") || cell.querySelector(".font-semibold")) ?? cells[1];
    const titleNode = titleCell?.querySelector(".font-body-lg, .text-body-lg, .font-semibold") as HTMLElement | null;
    const subTitleNode = titleCell?.querySelector(".text-xs") as HTMLElement | null;
    const img = titleCell?.querySelector("img") as HTMLImageElement | null;
    if (titleNode) titleNode.textContent = track.title;
    if (subTitleNode) subTitleNode.textContent = track.artist;
    if (img && track.lyricStyle.backgroundImage) img.src = track.lyricStyle.backgroundImage;

    if (cells.length >= 7) {
      if (cells[3]) cells[3].textContent = track.artist;
      if (cells[4]) cells[4].textContent = track.album;
      if (cells[5]) cells[5].textContent = track.added;
      if (cells[6]) cells[6].textContent = track.durationLabel;
    } else if (cells.length >= 5) {
      if (cells[2]) cells[2].textContent = track.album;
      if (cells[3]) cells[3].textContent = track.durationLabel;
    }

    if (actions && row.dataset.tlReady !== "true") {
      row.dataset.tlReady = "true";
      row.classList.add("tl-clickable");
      row.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        actions.playTrack(row.dataset.tlTrackId ?? track.id);
      });
    }
    patchCoverPlayBadge(doc, titleCell ?? null, isActive && playing);
  });
}

function patchPlayer(
  doc: Document,
  activeTrack: Track,
  playing: boolean,
  currentTime: number,
  volume: number,
  actions?: PatchActions,
) {
  const footer = doc.querySelector("footer") as HTMLElement | null;
  if (!footer) return;
  const icon = Array.from(footer.querySelectorAll(".material-symbols-outlined")).find((element) =>
    /pause|play_arrow/.test(textOf(element)),
  );
  if (icon) icon.textContent = playing ? "pause" : "play_arrow";

  const title = footer.querySelector(".font-body-lg, .text-body-lg") as HTMLElement | null;
  const subtitle = footer.querySelector(".text-on-surface-variant.text-xs, .text-body-sm") as HTMLElement | null;
  if (title) title.textContent = activeTrack.title;
  if (subtitle) subtitle.textContent = activeTrack.artist;

  const timeNodes = Array.from(footer.querySelectorAll(".font-mono, .text-\\[10px\\]")) as HTMLElement[];
  if (timeNodes[0]) timeNodes[0].textContent = formatDuration(currentTime);
  if (timeNodes[1]) timeNodes[1].textContent = activeTrack.durationLabel;

  patchProgressControl(footer, activeTrack, currentTime, actions);

  patchVolumeControl(footer, volume, actions);
}

function patchProgressControl(
  footer: HTMLElement,
  activeTrack: Track,
  currentTime: number,
  actions?: PatchActions,
) {
  const timeNodes = Array.from(footer.querySelectorAll(".font-mono, .text-\\[10px\\]")) as HTMLElement[];
  const track = timeNodes[0]?.nextElementSibling as HTMLElement | null;
  const fill = track?.firstElementChild as HTMLElement | null;
  const thumb = track?.children[1] as HTMLElement | null;
  if (!track || !fill) return;

  const duration = activeTrack.duration || 0;
  const percent = duration ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;
  track.classList.add("tl-progress-track");
  fill.classList.add("tl-progress-fill");
  fill.style.width = `${percent}%`;
  if (thumb) {
    thumb.classList.add("tl-progress-thumb");
    thumb.style.left = `${percent}%`;
  }

  if (actions) {
    (track as HTMLElement & { __tlSeekTo?: (seconds: number) => void }).__tlSeekTo = actions.seekTo;
    track.dataset.tlDuration = String(duration);
  }
  if (actions && track.dataset.tlProgressReady !== "true") {
    track.dataset.tlProgressReady = "true";
    const setFromClientX = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const nextPercent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const seekTo = (track as HTMLElement & { __tlSeekTo?: (seconds: number) => void }).__tlSeekTo;
      seekTo?.(nextPercent * (Number(track.dataset.tlDuration) || 0));
    };
    track.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      track.setPointerCapture(event.pointerId);
      setFromClientX(event.clientX);
    });
    track.addEventListener("pointermove", (event) => {
      if (event.buttons !== 1) return;
      event.preventDefault();
      setFromClientX(event.clientX);
    });
  }
}

function patchVolumeControl(footer: HTMLElement, volume: number, actions?: PatchActions) {
  const volumeIcon = Array.from(footer.querySelectorAll(".material-symbols-outlined")).find((element) =>
    /volume_up|volume_down|volume_mute|volume_off/.test(textOf(element)),
  ) as HTMLElement | undefined;
  if (!volumeIcon) return;

  const wrapper = volumeIcon.closest(".group") as HTMLElement | null;
  const track = wrapper?.querySelector(".h-1") as HTMLElement | null;
  const fill =
    (track?.querySelector(".tl-volume-fill") as HTMLElement | null) ??
    (track?.firstElementChild as HTMLElement | null);
  if (!track || !fill) return;

  const percent = Math.round(Math.max(0, Math.min(1, volume)) * 100);
  track.classList.add("tl-volume-track");
  fill.classList.add("tl-volume-fill");
  fill.style.width = `${percent}%`;
  volumeIcon.textContent = percent === 0 ? "volume_off" : percent < 45 ? "volume_down" : "volume_up";

  let thumb = track.querySelector(".tl-volume-thumb") as HTMLElement | null;
  if (!thumb) {
    thumb = footer.ownerDocument.createElement("div");
    thumb.className = "tl-volume-thumb";
    track.appendChild(thumb);
  }
  thumb.style.left = `${percent}%`;

  let bubble = track.querySelector(".tl-volume-bubble") as HTMLElement | null;
  if (!bubble) {
    bubble = footer.ownerDocument.createElement("div");
    bubble.className = "tl-volume-bubble";
    track.appendChild(bubble);
  }
  bubble.textContent = String(percent);
  bubble.style.left = `${percent}%`;

  if (actions && track.dataset.tlVolumeReady !== "true") {
    track.dataset.tlVolumeReady = "true";
    const setFromClientX = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      actions.setVolume(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
    };
    track.addEventListener("click", (event) => {
      event.preventDefault();
      setFromClientX(event.clientX);
    });
    track.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const direction = event.deltaY > 0 ? -1 : 1;
        const current = Number(track.dataset.tlVolume ?? volume);
        actions.setVolume(Math.max(0, Math.min(1, current + direction * 0.05)));
        flashVolumeBubble(track);
      },
      { passive: false },
    );
    track.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      track.classList.add("tl-volume-active");
      track.setPointerCapture(event.pointerId);
      setFromClientX(event.clientX);
    });
    track.addEventListener("pointermove", (event) => {
      if (event.buttons !== 1) return;
      event.preventDefault();
      setFromClientX(event.clientX);
    });
    track.addEventListener("pointerup", () => {
      window.setTimeout(() => track.classList.remove("tl-volume-active"), 450);
    });
    track.addEventListener("pointercancel", () => {
      track.classList.remove("tl-volume-active");
    });
  }
  track.dataset.tlVolume = String(volume);
}

function flashVolumeBubble(track: HTMLElement) {
  const win = track.ownerDocument.defaultView ?? window;
  track.classList.add("tl-volume-active");
  const previous = Number(track.dataset.tlVolumeTimer ?? 0);
  if (previous) win.clearTimeout(previous);
  const timer = win.setTimeout(() => track.classList.remove("tl-volume-active"), 700);
  track.dataset.tlVolumeTimer = String(timer);
}

function patchResourceStatus(doc: Document, tracks: Track[]) {
  const localTracks = tracks.filter((track) => !track.id.startsWith("demo-"));
  const matchedCount = localTracks.filter((track) => track.lyrics?.status === "matched").length;
  const banner = doc.getElementById("successBanner") as HTMLElement | null;
  const label = banner?.querySelector(".font-body-sm, .text-body-sm") as HTMLElement | null;
  if (banner) banner.style.display = localTracks.length ? "" : "none";
  if (label) label.textContent = `已导入 ${localTracks.length} 首本地歌曲，${matchedCount} 首已匹配歌词`;
}

function patchImportedResources(doc: Document, tracks: Track[], actions?: PatchActions) {
  let rows = Array.from(doc.querySelectorAll("tbody tr")) as HTMLTableRowElement[];
  if (!rows.length) return;
  const localTracks = tracks.filter((track) => !track.id.startsWith("demo-"));
  const tbody = rows[0]?.parentElement;
  while (tbody && rows.length < localTracks.length) {
    const clone = rows[rows.length - 1].cloneNode(true) as HTMLTableRowElement;
    tbody.appendChild(clone);
    rows = Array.from(doc.querySelectorAll("tbody tr")) as HTMLTableRowElement[];
  }
  rows.forEach((row, index) => {
    const track = localTracks[index];
    if (!track) {
      row.style.display = "none";
      return;
    }
    row.style.display = "";
    const cells = Array.from(row.children) as HTMLElement[];
    const titleNode = cells[0]?.querySelector(".text-on-surface.font-medium, .font-medium") as HTMLElement | null;
    const artistNode = cells[0]?.querySelector(".text-on-surface-variant.text-xs") as HTMLElement | null;
    if (titleNode) titleNode.textContent = track.title;
    if (artistNode) artistNode.textContent = track.artist;
    if (cells[1]) cells[1].textContent = track.format;
    if (cells[2]) {
      cells[2].textContent = lyricStatusLabel(track.lyrics?.status);
      cells[2].style.color =
        track.lyrics?.status === "matched" ? "#67f37f" : track.lyrics?.status === "failed" ? "#ffb4ab" : "#bdc8cf";
    }
    if (cells[5] && actions) {
      cells[5].innerHTML = "";
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "text-on-surface-variant hover:text-primary transition-colors";
      button.textContent = track.lyrics?.status === "matched" ? "重新匹配" : "匹配歌词";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        actions.retryActiveLyrics();
      });
      cells[5].appendChild(button);
    }
  });
}

function injectLyricsPanelControls(doc: Document) {
  const panel = doc.querySelector("aside") as HTMLElement | null;
  if (!panel) return;
  panel.classList.add("tl-style-panel");
  if (!doc.querySelector(".tl-style-toggle")) {
    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "tl-style-toggle";
    toggle.setAttribute("aria-label", "显示或隐藏歌词样式设置");
    toggle.innerHTML = `<span class="material-symbols-outlined">tune</span>`;
    toggle.addEventListener("click", () => doc.body.classList.toggle("tl-style-hidden"));
    doc.body.appendChild(toggle);
  }
  Array.from(doc.querySelectorAll("button")).forEach((button) => {
    if (textOf(button) === "tune" && button.dataset.tlToggleReady !== "true") {
      button.dataset.tlToggleReady = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        doc.body.classList.toggle("tl-style-hidden");
      });
    }
  });
}

function patchLyricsPage(doc: Document, activeTrack: Track, currentTime: number, actions?: PatchActions) {
  const activeLyric = doc.querySelector(".font-lyrics-active") as HTMLElement | null;
  if (!activeLyric) return;
  const lyricWindow = getLyricWindow(activeTrack, currentTime);
  const inactiveLyrics = Array.from(doc.querySelectorAll(".font-lyrics-inactive")) as HTMLElement[];
  const previous = lyricWindow.previous.slice(-2);
  const next = lyricWindow.next.slice(0, 2);
  if (inactiveLyrics[0] && previous[0]) inactiveLyrics[0].textContent = previous[0];
  if (inactiveLyrics[1] && previous[1]) inactiveLyrics[1].textContent = previous[1];
  if (inactiveLyrics[2] && next[0]) inactiveLyrics[2].textContent = next[0];
  if (inactiveLyrics[3] && next[1]) inactiveLyrics[3].textContent = next[1];
  activeLyric.textContent = lyricWindow.active || activeTrack.title;
  const style = activeTrack.lyricStyle;
  activeLyric.style.fontSize = `${style.fontSize}px`;
  activeLyric.style.opacity = `${style.opacity}`;
  activeLyric.style.color = style.color;
  activeLyric.style.textShadow = `0 0 ${style.glow}px ${style.color}`;
  activeLyric.style.transform = `perspective(${style.perspective}px) rotateX(${style.rotateX}deg) rotateY(${style.rotateY}deg) rotateZ(${style.rotateZ}deg) skew(${style.skewX}deg, ${style.skewY}deg) scale(${style.scale})`;
  if (style.backgroundImage) {
    const bg = doc.querySelector(".absolute.inset-0.z-0") as HTMLElement | null;
    if (bg) {
      bg.style.backgroundImage = `url(${style.backgroundImage})`;
      bg.style.backgroundSize = "cover";
      bg.style.backgroundPosition = "center";
      bg.style.filter = "blur(8px) brightness(.72)";
      bg.style.transform = "scale(1.04)";
    }
  }
  if (actions) wireLyricsControls(doc);
}

function wireLyricsControls(doc: Document) {
  const activeLyric = doc.querySelector(".font-lyrics-active") as HTMLElement | null;
  if (!activeLyric) return;
  const sliders = Array.from(doc.querySelectorAll("input[type='range']")) as HTMLInputElement[];
  sliders.forEach((slider, index) => {
    if (slider.dataset.tlReady === "true") return;
    slider.dataset.tlReady = "true";
    slider.addEventListener("input", () => {
      const value = Number(slider.value);
      if (index === 0) activeLyric.style.fontSize = `${value}px`;
      if (index === 1) activeLyric.style.opacity = `${Math.max(0.2, value / 100)}`;
      if (index === 2) activeLyric.style.transform = `rotate(${value}deg)`;
      if (index === 3) activeLyric.style.scale = `${value / 100}`;
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
