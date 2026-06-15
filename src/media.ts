import type { Track } from "./types";

export const defaultCover =
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200&auto=format&fit=crop";

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
}

export function getCover(track: Track) {
  return track.coverImage || defaultCover;
}

export function getLibraryStats(tracks: Track[]) {
  const totalSeconds = tracks.reduce((sum, track) => sum + (Number(track.duration) || 0), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  return {
    count: `${tracks.length} \u9996\u6b4c\u66f2`,
    duration: hours ? `${hours} \u5c0f\u65f6 ${minutes} \u5206\u949f` : `${minutes} \u5206\u949f`,
  };
}
