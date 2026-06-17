import { useCallback, useState } from "react";
import { formatDuration } from "../media";
import type { Track } from "../types";

export function useLyricsMatching({
  tracks,
  commitTracks,
}: {
  tracks: Track[];
  commitTracks: (tracks: Track[]) => void;
}) {
  const [matchingLyrics, setMatchingLyrics] = useState(false);

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

  const matchLyricsForTracks = useCallback(async (targetTracks: Track[]) => {
    if (!targetTracks.length) return targetTracks;
    setMatchingLyrics(true);
    const nextTracks: Track[] = [];
    try {
      for (const track of targetTracks) {
        nextTracks.push(await matchLyricsForTrack(track));
      }
      return nextTracks;
    } finally {
      setMatchingLyrics(false);
    }
  }, [matchLyricsForTrack]);

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

  return {
    matchingLyrics,
    matchLyricsForTrack,
    matchLyricsForTracks,
    matchAllLyrics,
    retryLyricsForTrack,
  };
}
