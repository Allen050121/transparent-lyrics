import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { UpdateBanner, UpdateCheckCard } from "../components/UpdateCards";
import type { LyricStyle } from "../types";

type SettingsPageProps = {
  updaterStatus: UpdaterStatus;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  installUpdate: () => void;
  lyricStyle: LyricStyle;
  updateLyricStyle: (patch: Partial<LyricStyle>) => void;
  resetLyricStyle: () => void;
  onLegacyMediaMigrated: (info: StorageInfo) => void;
};

export function SettingsPage({
  updaterStatus,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  lyricStyle,
  updateLyricStyle,
  resetLyricStyle,
  onLegacyMediaMigrated,
}: SettingsPageProps) {
  const [cacheMessage, setCacheMessage] = useState("");
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [storageMessage, setStorageMessage] = useState("");
  const [storageLoading, setStorageLoading] = useState(true);
  const checking = updaterStatus.status === "checking";
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

  return (
    <div className="page-inner settings-page">
      <section className="page-heading">
        <h2>设置</h2>
        <p><span>版本、更新、数据目录和歌词页操作偏好</span></p>
      </section>

      <div className="settings-grid">
        <section className="glass-panel settings-card">
          <div className="settings-card-head">
            <Icon>system_update_alt</Icon>
            <div>
              <h3>软件更新</h3>
              <p>{`当前版本 v${updaterStatus.currentVersion}`}</p>
            </div>
          </div>
          <UpdateCheckCard status={updaterStatus} checkForUpdates={checkForUpdates} />
          <UpdateBanner status={updaterStatus} downloadUpdate={downloadUpdate} installUpdate={installUpdate} />
          <div className="settings-actions">
            <button type="button" onClick={checkForUpdates} disabled={checking}>
              <Icon>sync</Icon>
              {checking ? "检查中" : "检查更新"}
            </button>
            <button type="button" onClick={() => window.transparentLyrics?.openReleasesPage?.()}>
              <Icon>open_in_new</Icon>
              打开 Release
            </button>
          </div>
        </section>

        <section className="glass-panel settings-card">
          <div className="settings-card-head">
            <Icon>folder_managed</Icon>
            <div>
              <h3>数据与缓存</h3>
              <p>配置保存在系统用户目录；歌曲和后续媒体缓存默认放到 D 盘。</p>
            </div>
          </div>
          <div className="settings-path-box">
            <span>媒体存储目录</span>
            <strong>{storageInfo?.storageRoot ?? (storageLoading ? "正在读取..." : "未读取到存储目录")}</strong>
          </div>
          <div className="settings-actions">
            <button type="button" onClick={openStorageRoot} disabled={!storageApiReady || storageLoading}>
              <Icon>folder_open</Icon>
              打开媒体目录
            </button>
            <button type="button" onClick={chooseStorageRoot} disabled={!storageApiReady || storageLoading}>
              <Icon>drive_file_move</Icon>
              更改存储位置
            </button>
            <button type="button" onClick={migrateLegacyMedia} disabled={!storageApiReady || storageLoading}>
              <Icon>move_down</Icon>
              迁移旧媒体
            </button>
            <button type="button" onClick={openUserDataFolder}>
              <Icon>settings_applications</Icon>
              打开配置目录
            </button>
            <button type="button" onClick={clearCache}>
              <Icon>cleaning_services</Icon>
              清理缓存
            </button>
          </div>
          {storageMessage && <p className="settings-note">{storageMessage}</p>}
          {cacheMessage && <p className="settings-note">{cacheMessage}</p>}
        </section>

        <section className="glass-panel settings-card">
          <div className="settings-card-head">
            <Icon>lyrics</Icon>
            <div>
              <h3>歌词页操作</h3>
              <p>默认锁定画布，避免误触拖动；位置请在样式面板里调 X / Y。</p>
            </div>
          </div>
          <button
            className="settings-switch-row"
            type="button"
            onClick={() => updateLyricStyle({ layoutLocked: !lyricStyle.layoutLocked })}
            aria-pressed={!lyricStyle.layoutLocked}
          >
            <span>画布拖动</span>
            <strong>{lyricStyle.layoutLocked ? "已锁定" : "已开启"}</strong>
            <i aria-hidden="true" />
          </button>
          <div className="settings-actions">
            <button type="button" onClick={resetLyricStyle}>
              <Icon>restart_alt</Icon>
              重置歌词样式
            </button>
          </div>
        </section>

        <section className="glass-panel settings-card">
          <div className="settings-card-head">
            <Icon>inventory_2</Icon>
            <div>
              <h3>后续风格包</h3>
              <p>DIY 风格导入导出会放在这里，包括歌词、CD、播放器和背景图片。</p>
            </div>
          </div>
          <p className="settings-note">下一阶段会增加 .tlstyle 风格包，让别人分享的样式可以直接导入。</p>
        </section>
      </div>
    </div>
  );
}
