import { normalizeLyricStyle } from "./lyricStyles";
import { formatDuration } from "./media";
import type { LyricPreset, LyricStyle, Track } from "./types";

export const libraryKey = "transparent-lyrics:library:v1";
export const activeTrackKey = "transparent-lyrics:active-track:v1";
export const recentTrackIdsKey = "transparent-lyrics:recent-track-ids:v1";
export const lyricStyleKey = "transparent-lyrics:lyric-style:v1";
export const customLyricPresetsKey = "transparent-lyrics:custom-lyric-presets:v1";
export const recentTrackLimit = 200;
export const reimportLabel = "\u9700\u91cd\u65b0\u5bfc\u5165";
export const localMusicLabel = "\u672c\u5730\u97f3\u4e50";
export const justNowLabel = "\u521a\u521a";

export const placeholderTrack: Track = {
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

export function readGlobalLyricStyle() {
  try {
    const parsed = JSON.parse(localStorage.getItem(lyricStyleKey) ?? "null") as Partial<LyricStyle> | null;
    return normalizeLyricStyle(parsed ?? undefined);
  } catch {
    return normalizeLyricStyle();
  }
}

export function writeGlobalLyricStyle(style: LyricStyle) {
  localStorage.setItem(lyricStyleKey, JSON.stringify(normalizeLyricStyle(style)));
}

export function readCustomLyricPresets() {
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

export function writeCustomLyricPresets(presets: LyricPreset[]) {
  localStorage.setItem(customLyricPresetsKey, JSON.stringify(presets.map((preset) => ({
    ...preset,
    custom: true,
    style: normalizeLyricStyle(preset.style),
  }))));
}

export function getEffectiveLyricStyle(track: Track, tracks: Track[], globalStyle: LyricStyle) {
  const isLibraryTrack = tracks.some((item) => item.id === track.id);
  return isLibraryTrack
    ? normalizeLyricStyle({ ...globalStyle, ...track.lyricStyle })
    : normalizeLyricStyle(globalStyle);
}

export function createTrackFromImportedFile(file: ImportedAudioFile, index: number): Track {
  const title = file.title || file.name || localMusicLabel;
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

export function mergeImportedTracks(imported: Track[], currentTracks: Track[]) {
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

export function readLibrary() {
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

export function writeLibrary(tracks: Track[]) {
  const cleaned = tracks.filter((track) => !track.url?.startsWith("blob:") && track.added !== reimportLabel);
  localStorage.setItem(libraryKey, JSON.stringify(cleaned));
}

export function readRecentTrackIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentTrackIdsKey) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string").slice(0, recentTrackLimit)
      : [];
  } catch {
    return [];
  }
}

export function writeRecentTrackIds(trackIds: string[]) {
  localStorage.setItem(recentTrackIdsKey, JSON.stringify(trackIds.slice(0, recentTrackLimit)));
}
