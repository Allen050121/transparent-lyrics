import { useEffect, useState } from "react";

export function useStorageSettings(onLegacyMediaMigrated: (info: StorageInfo) => void) {
  const [cacheMessage, setCacheMessage] = useState("");
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [storageMessage, setStorageMessage] = useState("");
  const [storageLoading, setStorageLoading] = useState(true);
  const storageApiReady = Boolean(
    window.transparentLyrics?.getStorageInfo
      && window.transparentLyrics?.chooseStorageRoot
      && window.transparentLyrics?.openStorageRoot
      && window.transparentLyrics?.migrateLegacyMedia,
  );

  useEffect(() => {
    let active = true;
    if (!window.transparentLyrics?.getStorageInfo) {
      setStorageLoading(false);
      setStorageMessage("当前安装包缺少存储管理接口，请更新到最新版后再使用。");
      return () => {
        active = false;
      };
    }
    window.transparentLyrics.getStorageInfo()
      .then((info) => {
        if (active) setStorageInfo(info);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (active) setStorageMessage(`读取存储目录失败：${message}`);
        console.warn("[Transparent Lyrics] Failed to read storage info", error);
      })
      .finally(() => {
        if (active) setStorageLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const openUserDataFolder = async () => {
    try {
      await window.transparentLyrics?.openUserDataFolder?.();
    } catch (error) {
      console.warn("[Transparent Lyrics] Failed to open user data folder", error);
    }
  };

  const clearCache = async () => {
    try {
      await window.transparentLyrics?.clearAppCache?.();
      setCacheMessage("缓存已清理，曲库、歌词样式和上传图片会保留。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCacheMessage(`清理失败：${message}`);
    }
  };

  const chooseStorageRoot = async () => {
    try {
      if (!window.transparentLyrics?.chooseStorageRoot) {
        setStorageMessage("当前安装包缺少更改存储位置接口，请更新到最新版后再使用。");
        return;
      }
      const info = await window.transparentLyrics.chooseStorageRoot();
      if (info) setStorageInfo(info);
      setStorageMessage("新的导入歌曲会保存到这个目录。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStorageMessage(`选择目录失败：${message}`);
    }
  };

  const openStorageRoot = async () => {
    try {
      if (!window.transparentLyrics?.openStorageRoot) {
        setStorageMessage("当前安装包缺少打开媒体目录接口，请更新到最新版后再使用。");
        return;
      }
      const info = await window.transparentLyrics.openStorageRoot();
      if (info) setStorageInfo(info);
    } catch (error) {
      console.warn("[Transparent Lyrics] Failed to open storage root", error);
    }
  };

  const migrateLegacyMedia = async () => {
    try {
      if (!window.transparentLyrics?.migrateLegacyMedia) {
        setStorageMessage("当前安装包缺少迁移旧媒体接口，请更新到最新版后再使用。");
        return;
      }
      const info = await window.transparentLyrics.migrateLegacyMedia();
      if (info) {
        setStorageInfo(info);
        onLegacyMediaMigrated(info);
      }
      setStorageMessage("旧媒体库已复制到当前存储目录，曲库路径已切换，原文件会保留。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStorageMessage(`迁移失败：${message}`);
    }
  };

  return {
    cacheMessage,
    storageInfo,
    storageMessage,
    storageLoading,
    storageApiReady,
    openUserDataFolder,
    clearCache,
    chooseStorageRoot,
    openStorageRoot,
    migrateLegacyMedia,
  };
}
