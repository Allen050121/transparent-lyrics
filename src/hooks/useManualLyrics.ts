import { useCallback, useState } from "react";
import { parseLrcLines, type LyricsCandidate, type ManualLyricsState } from "../lyrics";
import { formatDuration } from "../media";
import type { Track, TrackLyrics } from "../types";

export function useManualLyrics({
  tracks,
  applyLyricsToTrack,
}: {
  tracks: Track[];
  applyLyricsToTrack: (trackId: string, lyrics: TrackLyrics, metadata?: Partial<Track>) => void;
}) {
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
        durationLabel: candidate.duration ? formatDuration(candidate.duration) : undefined,
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

  return {
    manualLyrics,
    setManualLyrics,
    openManualLyrics,
    closeManualLyrics,
    searchManualLyrics,
    saveLyricsCandidate,
    savePastedLyrics,
  };
}
