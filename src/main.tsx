import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { ManualLyricsDialog } from "./ManualLyricsDialog";
import { SideNav, TopBar, WindowChrome } from "./components/AppChrome";
import { Icon } from "./components/Icon";
import { PlayerBar } from "./components/PlayerBar";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useManualLyrics } from "./hooks/useManualLyrics";
import { useUpdater } from "./hooks/useUpdater";
import { defaultLyricStyle, normalizeLyricStyle } from "./lyricStyles";
import { formatDuration, getCover } from "./media";
import { ImportPage } from "./pages/ImportPage";
import { LibraryPage } from "./pages/LibraryPage";
import { LyricsPage } from "./pages/LyricsPage";
import { MiniPage } from "./pages/MiniPage";
import { PlaylistPage } from "./pages/PlaylistPage";
import { RecentPage } from "./pages/RecentPage";
import { SettingsPage } from "./pages/SettingsPage";
import { parseLrcLines } from "./lyrics";
import {
  activeTrackKey,
  createTrackFromImportedFile,
  getEffectiveLyricStyle,
  localMusicLabel,
  mergeImportedTracks,
  placeholderTrack,
  readCustomLyricPresets,
  readGlobalLyricStyle,
  readLibrary,
  readRecentTrackIds,
  writeCustomLyricPresets,
  writeGlobalLyricStyle,
  writeLibrary,
} from "./storage";
import type { LyricPreset, LyricStyle, Track, TrackLyrics, View } from "./types";

function App() {
  const [view, setView] = useState<View>("main");
  const [selectedPlaylist, setSelectedPlaylist] = useState("\u6df1\u591c\u6c89\u6d78");
  const [history, setHistory] = useState<View[]>(["main"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tracks, setTracks] = useState<Track[]>(readLibrary);
  const [activeTrackId, setActiveTrackId] = useState(() => localStorage.getItem(activeTrackKey) ?? readLibrary()[0]?.id);
  const [recentTrackIds, setRecentTrackIds] = useState<string[]>(readRecentTrackIds);
  const [matchingLyrics, setMatchingLyrics] = useState(false);
  const [globalLyricStyle, setGlobalLyricStyle] = useState<LyricStyle>(readGlobalLyricStyle);
  const [customLyricPresets, setCustomLyricPresets] = useState<LyricPreset[]>(readCustomLyricPresets);
  const [imageImportTarget, setImageImportTarget] = useState<"background" | "cover">("background");
  const { updaterStatus, checkForUpdates, downloadUpdate, installUpdate } = useUpdater();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);
  const activeTrack = tracks.find((track) => track.id === activeTrackId) ?? tracks[0] ?? placeholderTrack;
  const commitTracks = useCallback((nextTracks: Track[]) => {
    setTracks(nextTracks);
    writeLibrary(nextTracks);
  }, []);
  const {
    audioRef,
    playing,
    currentTime,
    volume,
    setVolume,
    playTrack,
    playRelative,
    togglePlayback,
    seekTo,
    audioHandlers,
  } = useAudioPlayer({ tracks, activeTrack, setActiveTrackId, setRecentTrackIds, commitTracks });
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

  const {
    manualLyrics,
    setManualLyrics,
    openManualLyrics,
    closeManualLyrics,
    searchManualLyrics,
    saveLyricsCandidate,
    savePastedLyrics,
  } = useManualLyrics({ tracks, applyLyricsToTrack });

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
        {...audioHandlers}
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
