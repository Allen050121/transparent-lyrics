import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { formatDuration } from "../media";
import { activeTrackKey, recentTrackLimit, reimportLabel, writeRecentTrackIds } from "../storage";
import type { Track } from "../types";

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

type UseAudioPlayerParams = {
  tracks: Track[];
  activeTrack: Track;
  setActiveTrackId: (trackId: string) => void;
  setRecentTrackIds: Dispatch<SetStateAction<string[]>>;
  commitTracks: (tracks: Track[]) => void;
};

export function useAudioPlayer({
  tracks,
  activeTrack,
  setActiveTrackId,
  setRecentTrackIds,
  commitTracks,
}: UseAudioPlayerParams) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  const rememberRecentTrack = useCallback((trackId: string) => {
    setRecentTrackIds((current) => {
      const next = [trackId, ...current.filter((id) => id !== trackId)].slice(0, recentTrackLimit);
      writeRecentTrackIds(next);
      return next;
    });
  }, [setRecentTrackIds]);

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

  const playTrack = useCallback(async (trackId: string) => {
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
        rememberRecentTrack(trackId);
      } catch (error) {
        setPlaying(false);
        console.error("[Transparent Lyrics] Audio play failed", error);
      }
      return;
    }
    setPlaying(true);
    rememberRecentTrack(trackId);
  }, [ensurePlayableUrl, rememberRecentTrack, setActiveTrackId, tracks]);

  const playRelative = useCallback((offset: number) => {
    if (!tracks.length) return;
    const index = Math.max(0, tracks.findIndex((track) => track.id === activeTrack.id));
    const next = tracks[(index + offset + tracks.length) % tracks.length];
    if (next) void playTrack(next.id);
  }, [activeTrack.id, playTrack, tracks]);

  const togglePlayback = useCallback(() => {
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
  }, [activeTrack.id, playTrack, playing]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : activeTrack.duration;
    const nextTime = Math.max(0, Math.min(duration || 0, seconds));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, [activeTrack.duration]);

  const handleLoadedMetadata = useCallback((event: React.SyntheticEvent<HTMLAudioElement>) => {
    const duration = event.currentTarget.duration;
    if (!Number.isFinite(duration)) return;
    const nextTracks = tracks.map((track) =>
      track.id === activeTrack.id
        ? { ...track, duration, durationLabel: formatDuration(duration) }
        : track,
    );
    commitTracks(nextTracks);
  }, [activeTrack.id, commitTracks, tracks]);

  const handleError = useCallback(() => {
    setPlaying(false);
    if (!activeTrack?.id) return;
    const nextTracks = tracks.map((track) =>
      track.id === activeTrack.id && !track.path ? { ...track, added: reimportLabel } : track,
    );
    commitTracks(nextTracks);
  }, [activeTrack?.id, commitTracks, tracks]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    playRelative(1);
  }, [playRelative]);

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

  return {
    audioRef,
    playing,
    currentTime,
    volume,
    setVolume,
    playTrack,
    playRelative,
    togglePlayback,
    seekTo,
    setCurrentTime,
    audioHandlers: {
      onLoadedMetadata: handleLoadedMetadata,
      onTimeUpdate: (event: React.SyntheticEvent<HTMLAudioElement>) => setCurrentTime(event.currentTarget.currentTime),
      onError: handleError,
      onEnded: handleEnded,
    },
  };
}
