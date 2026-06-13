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

const placeholderTrack: Track = {
  id: "placeholder",
  title: "\u6682\u65e0\u64ad\u653e",
  artist: "\u5bfc\u5165\u6b4c\u66f2\u540e\u5f00\u59cb\u64ad\u653e",
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
const defaultCover =
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200&auto=format&fit=crop";

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

  const importImage = useCallback(async () => {
    const imageUrl = await window.transparentLyrics?.openImageFile?.();
    if (imageUrl && activeTrack) {
      const nextTracks = tracks.map((track) =>
        track.id === activeTrack.id
          ? { ...track, lyricStyle: { ...track.lyricStyle, backgroundImage: imageUrl } }
          : track,
      );
      commitTracks(nextTracks);
      return;
    }
    imageInputRef.current?.click();
  }, [activeTrack, commitTracks, tracks]);

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

  return (
    <main className="app-shell">
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
            importImage={importImage}
            matchAllLyrics={matchAllLyrics}
            retryActiveLyrics={retryActiveLyrics}
          />
        )}
        {view === "playlist" && (
          <PlaylistPage playlistName={selectedPlaylist} tracks={tracks} activeTrack={activeTrack} playing={playing} playTrack={playTrack} />
        )}
        {view === "lyrics" && (
          <LyricsPage activeTrack={activeTrack} currentTime={currentTime} />
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
      <input ref={imageInputRef} className="hidden-input" type="file" accept="image/*" />
    </main>
  );
}

function Icon({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function getCover(track: Track) {
  return track.lyricStyle.backgroundImage || defaultCover;
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

function ImportPage({ tracks, matchingLyrics, importAudio, importFolder, importLrc, importImage, matchAllLyrics, retryActiveLyrics }: { tracks: Track[]; matchingLyrics: boolean; importAudio: () => void; importFolder: () => void; importLrc: () => void; importImage: () => void; matchAllLyrics: () => void; retryActiveLyrics: () => void }) {
  const localTracks = tracks.filter((track) => !track.id.startsWith("demo-"));
  const matchedCount = localTracks.filter((track) => track.lyrics?.status === "matched").length;
  return <div className="page-inner import-page">{localTracks.length > 0 && <div className="success-banner"><Icon>check_circle</Icon><span>{"\u5df2\u5bfc\u5165 "}{localTracks.length}{" \u9996\u672c\u5730\u6b4c\u66f2\uff0c"}{matchedCount}{" \u9996\u5df2\u5339\u914d\u6b4c\u8bcd"}</span></div>}<div className="import-grid"><ImportCard icon="library_add" title={"\u5bfc\u5165\u672c\u5730\u6b4c\u66f2"} description={"\u9009\u62e9\u5355\u9996\u6b4c\u66f2\uff0c\u6216\u626b\u63cf\u6574\u4e2a\u97f3\u4e50\u6587\u4ef6\u5939\u3002"} body={"\u5bfc\u5165\u540e\u81ea\u52a8\u5c1d\u8bd5\u5339\u914d\u6b4c\u8bcd"} actions={[{ label: "\u9009\u62e9\u6b4c\u66f2\u6587\u4ef6", onClick: importAudio }, { label: "\u9009\u62e9\u97f3\u4e50\u6587\u4ef6\u5939", onClick: importFolder }]} /><ImportCard icon="lyrics" title={"\u6b4c\u8bcd\u8865\u5168"} description={"\u652f\u6301 LRC \u5bfc\u5165\uff0c\u4e5f\u53ef\u6279\u91cf\u5728\u7ebf\u5339\u914d\u672c\u5730\u6b4c\u66f2\u3002"} body={matchingLyrics ? "\u6b63\u5728\u5339\u914d\u6b4c\u8bcd..." : "\u4f18\u5148\u4fdd\u5b58\u540c\u6b65\u6b4c\u8bcd"} actions={[{ label: "\u6279\u91cf\u8865\u5168\u6b4c\u8bcd", onClick: matchAllLyrics }, { label: "\u5bfc\u5165 LRC \u6587\u4ef6", onClick: importLrc }]} /><ImportCard icon="wallpaper" title={"\u4e0a\u4f20\u58c1\u7eb8"} description={"\u4e3a\u6b4c\u8bcd\u9875\u9762\u8bbe\u7f6e\u4e13\u5c5e\u80cc\u666f\u56fe\u3002"} body={"\u652f\u6301 JPG\u3001PNG \u7b49\u56fe\u7247"} actions={[{ label: "\u9009\u62e9\u56fe\u7247", onClick: importImage }]} /><ImportCard icon="image" title={"\u5173\u8054\u5c01\u9762\u56fe"} description={"\u4e3a\u5f53\u524d\u6b4c\u66f2\u8865\u5145\u5c01\u9762\uff0c\u540e\u7eed\u4f1a\u652f\u6301\u81ea\u52a8\u8865\u5168\u3002"} body={"\u5f53\u524d\u7248\u672c\u5148\u624b\u52a8\u9009\u62e9\u56fe\u7247"} actions={[{ label: "\u9009\u62e9\u5c01\u9762\u56fe", onClick: importImage }]} /></div><section className="resource-section"><div className="section-title-row"><h3>{"\u5df2\u5bfc\u5165\u8d44\u6e90"}</h3><label>{"\u663e\u793a:"}<select><option>{"\u5168\u90e8"}</option></select></label></div><div className="glass-panel resource-table"><div className="resource-head"><span>{"\u6b4c\u66f2\u540d\u79f0"}</span><span>{"\u683c\u5f0f"}</span><span>{"\u6b4c\u8bcd\u72b6\u6001"}</span><span>{"\u80cc\u666f\u72b6\u6001"}</span><span>{"\u5c01\u9762"}</span><span>{"\u64cd\u4f5c"}</span></div>{!localTracks.length && <div className="empty-state">{"\u8fd8\u6ca1\u6709\u5bfc\u5165\u8d44\u6e90\u3002"}</div>}{localTracks.map((track) => <div className="resource-row" key={track.id}><span className="resource-title"><span className="note-square"><Icon>music_note</Icon></span><span><b>{track.title}</b><small>{track.artist}</small></span></span><span>{track.format}</span><span className={track.lyrics?.status === "matched" ? "ok-text" : ""}>{lyricStatusLabel(track.lyrics?.status)}</span><span className="ok-text"><Icon>check_circle</Icon></span><span><TrackCover track={track} active={false} playing={false} /></span><button type="button" onClick={retryActiveLyrics}>{track.lyrics?.status === "matched" ? "\u91cd\u65b0\u5339\u914d" : "\u5339\u914d\u6b4c\u8bcd"}</button></div>)}</div></section></div>;
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

function LyricsPage({ activeTrack, currentTime }: { activeTrack: Track; currentTime: number }) {
  const lyricWindow = getLyricWindow(activeTrack, currentTime);
  return <div className="lyrics-page-native" style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.78)), url(${getCover(activeTrack)})` }}><div className="lyric-stack">{lyricWindow.previous.map((line) => <p key={line}>{line}</p>)}<h2 style={{ color: activeTrack.lyricStyle.color, fontSize: activeTrack.lyricStyle.fontSize }}>{lyricWindow.active}</h2>{lyricWindow.next.map((line) => <p key={line}>{line}</p>)}</div></div>;
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
