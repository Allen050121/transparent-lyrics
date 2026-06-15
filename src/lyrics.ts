import type { Track } from "./types";

export type LyricsStatus = "unmatched" | "matched" | "not-found" | "failed";

export type LyricsCandidate = {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  syncedLyrics?: string;
  plainLyrics?: string;
};

export type ManualLyricsState = {
  open: boolean;
  trackId: string;
  title: string;
  artist: string;
  album: string;
  pasteText: string;
  searching: boolean;
  error: string;
  candidates: LyricsCandidate[];
};

export function lyricStatusLabel(status?: LyricsStatus) {
  if (status === "matched") return "\u5df2\u5339\u914d";
  if (status === "not-found") return "\u65e0\u7ed3\u679c";
  if (status === "failed") return "\u5339\u914d\u5931\u8d25";
  return "\u672a\u5339\u914d";
}

export function parseLrcLines(text?: string) {
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

export function getLyricWindow(track: Track, currentTime: number, offset = 0) {
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
