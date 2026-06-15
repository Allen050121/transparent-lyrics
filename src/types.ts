import type { LyricsStatus } from "./lyrics";

export type View = "main" | "playlist" | "recent" | "import" | "lyrics" | "settings" | "mini";

export type LyricStyle = {
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
  layoutLocked: boolean;
  backgroundImage?: string;
};

export type TrackLyrics = {
  source: "lrclib" | "manual";
  status: LyricsStatus;
  syncedText?: string;
  plainText?: string;
  matchedAt?: string;
  providerId?: number;
  error?: string;
};

export type Track = {
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

export type LyricPreset = {
  id: string;
  name: string;
  style: LyricStyle;
  custom?: boolean;
};
