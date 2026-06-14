/// <reference types="vite/client" />

interface Window {
  transparentLyrics?: {
    platform: string;
    openAudioFiles?: () => Promise<Array<ImportedAudioFile>>;
    scanMusicFolder?: () => Promise<Array<ImportedAudioFile>>;
    loadAudioFile?: (filePath: string) => Promise<{ bytes: ArrayBuffer; mimeType: string }>;
    readAudioTags?: (filePath: string) => Promise<AudioTagInfo>;
    searchLyrics?: (query: LyricsSearchQuery) => Promise<LyricsSearchResult>;
    openLrcFiles?: () => Promise<string[]>;
    openImageFile?: () => Promise<string | null>;
    minimizeWindow?: () => Promise<void>;
    toggleMaximizeWindow?: () => Promise<void>;
    closeWindow?: () => Promise<void>;
  };
}

type ImportedAudioFile = {
  title?: string;
  name?: string;
  artist?: string;
  album?: string;
  duration?: number;
  format?: string;
  ext?: string;
  path: string;
  originalPath?: string;
  url?: string;
};

type AudioTagInfo = {
  title: string;
  artist: string;
  album: string;
  duration: number;
  format: string;
};

type LyricsSearchQuery = {
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
};

type LyricsSearchResult =
  | {
      status: "matched";
      source: "lrclib";
      id?: number;
      trackName?: string;
      artistName?: string;
      albumName?: string;
      duration?: number;
      syncedLyrics?: string;
      plainLyrics?: string;
      candidates?: unknown[];
    }
  | { status: "not-found"; candidates?: unknown[] }
  | { status: "failed"; error?: string };
