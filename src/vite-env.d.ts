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
    getAppVersion?: () => Promise<string>;
    openUserDataFolder?: () => Promise<void>;
    openReleasesPage?: () => Promise<void>;
    clearAppCache?: () => Promise<{ cleared: boolean }>;
    checkForUpdates?: () => Promise<UpdaterStatus>;
    downloadUpdate?: () => Promise<UpdaterStatus>;
    installUpdate?: () => Promise<void>;
    onUpdaterStatus?: (callback: (status: UpdaterStatus) => void) => () => void;
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

type UpdaterStatus =
  | { status: "idle"; currentVersion: string }
  | { status: "checking"; currentVersion: string }
  | { status: "available"; currentVersion: string; version: string; releaseName?: string; releaseNotes?: string }
  | { status: "not-available"; currentVersion: string }
  | { status: "downloading"; currentVersion: string; version?: string; progress: number }
  | { status: "downloaded"; currentVersion: string; version: string; releaseName?: string }
  | { status: "error"; currentVersion: string; error: string };
