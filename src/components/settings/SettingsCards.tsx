import { Icon } from "../Icon";
import { UpdateBanner, UpdateCheckCard } from "../UpdateCards";
import type { LyricStyle } from "../../types";

export function UpdateSettingsCard({
  updaterStatus,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
}: {
  updaterStatus: UpdaterStatus;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  installUpdate: () => void;
}) {
  const checking = updaterStatus.status === "checking";
  return (
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
  );
}

export function StorageSettingsCard({
  cacheMessage,
  storageInfo,
  storageMessage,
  storageLoading,
  storageApiReady,
  openStorageRoot,
  chooseStorageRoot,
  migrateLegacyMedia,
  openUserDataFolder,
  clearCache,
}: {
  cacheMessage: string;
  storageInfo: StorageInfo | null;
  storageMessage: string;
  storageLoading: boolean;
  storageApiReady: boolean;
  openStorageRoot: () => void;
  chooseStorageRoot: () => void;
  migrateLegacyMedia: () => void;
  openUserDataFolder: () => void;
  clearCache: () => void;
}) {
  return (
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
  );
}

export function LyricOperationSettingsCard({
  lyricStyle,
  updateLyricStyle,
  resetLyricStyle,
}: {
  lyricStyle: LyricStyle;
  updateLyricStyle: (patch: Partial<LyricStyle>) => void;
  resetLyricStyle: () => void;
}) {
  return (
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
  );
}

export function FutureStylePackageCard() {
  return (
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
  );
}
