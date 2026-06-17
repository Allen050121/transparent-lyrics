import fs from "node:fs/promises";
import path from "node:path";
import { parseFile } from "music-metadata";

export type ImportedAudioFile = {
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

export type AudioTagInfo = {
  title: string;
  artist: string;
  album: string;
  duration: number;
  format: string;
};

export interface MusicSourceProvider {
  id: string;
  importFiles(filePaths: string[]): Promise<ImportedAudioFile[]>;
  importFolder(directory: string): Promise<ImportedAudioFile[]>;
  readAudioTags(filePath: string): Promise<AudioTagInfo>;
}

export type LocalFileMusicSourceOptions = {
  getStorageRoot: () => Promise<string>;
};

const audioExtensions = new Set([".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac"]);

function parseTitleArtistFromFilename(filePath: string) {
  const name = path.parse(filePath).name.replace(/[_]+/g, " ").trim();
  const [artist, ...titleParts] = name.split(/\s+-\s+/);
  if (titleParts.length) {
    return {
      title: titleParts.join(" - ").trim(),
      artist: artist.trim(),
    };
  }
  return { title: name, artist: "" };
}

export class LocalFileMusicSourceProvider implements MusicSourceProvider {
  id = "local-file";
  private getStorageRoot: () => Promise<string>;

  constructor(options: LocalFileMusicSourceOptions) {
    this.getStorageRoot = options.getStorageRoot;
  }

  async importFiles(filePaths: string[]) {
    return Promise.all(filePaths.map((filePath, index) => this.buildImportedAudio(filePath, index)));
  }

  async importFolder(directory: string) {
    const files = await this.collectAudioFiles(directory);
    return this.importFiles(files);
  }

  async readAudioTags(filePath: string): Promise<AudioTagInfo> {
    const fallback = parseTitleArtistFromFilename(filePath);
    try {
      const metadata = await parseFile(filePath, { duration: true });
      const common = metadata.common;
      const ext = path.extname(filePath).replace(".", "").toUpperCase();
      return {
        title: common.title || fallback.title,
        artist: common.artist || fallback.artist || "本地音乐",
        album: common.album || "Local Library",
        duration: metadata.format.duration || 0,
        format: ext || metadata.format.container || "AUDIO",
      };
    } catch {
      return {
        title: fallback.title,
        artist: fallback.artist || "本地音乐",
        album: "Local Library",
        duration: 0,
        format: path.extname(filePath).replace(".", "").toUpperCase() || "AUDIO",
      };
    }
  }

  private async copyToLibrary(filePath: string, index: number) {
    const parsed = path.parse(filePath);
    const mediaDir = path.join(await this.getStorageRoot(), "media-library");
    await fs.mkdir(mediaDir, { recursive: true });
    const safeName = `${Date.now()}-${index}${parsed.ext.toLowerCase()}`;
    const storedPath = path.join(mediaDir, safeName);
    await fs.copyFile(filePath, storedPath);
    return storedPath;
  }

  private async collectAudioFiles(directory: string) {
    const results: string[] = [];
    const walk = async (current: string) => {
      let entries;
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch (error) {
        console.warn("[Transparent Lyrics] Skip unreadable music folder", current, error);
        return;
      }
      for (const entry of entries) {
        const nextPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(nextPath);
          continue;
        }
        if (entry.isFile() && audioExtensions.has(path.extname(entry.name).toLowerCase())) {
          results.push(nextPath);
        }
      }
    };
    await walk(directory);
    return results;
  }

  private async buildImportedAudio(filePath: string, index: number): Promise<ImportedAudioFile> {
    const storedPath = await this.copyToLibrary(filePath, index);
    const info = await this.readAudioTags(filePath);
    return {
      ...info,
      path: storedPath,
      originalPath: filePath,
      ext: info.format,
    };
  }
}

export function createLocalFileMusicSource(options: LocalFileMusicSourceOptions) {
  return new LocalFileMusicSourceProvider(options);
}
