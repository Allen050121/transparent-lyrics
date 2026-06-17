import {
  FutureStylePackageCard,
  LyricOperationSettingsCard,
  StorageSettingsCard,
  UpdateSettingsCard,
} from "../components/settings/SettingsCards";
import { useStorageSettings } from "../hooks/useStorageSettings";
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
  const storageSettings = useStorageSettings(onLegacyMediaMigrated);

  return (
    <div className="page-inner settings-page">
      <section className="page-heading">
        <h2>设置</h2>
        <p><span>版本、更新、数据目录和歌词页操作偏好</span></p>
      </section>

      <div className="settings-grid">
        <UpdateSettingsCard
          updaterStatus={updaterStatus}
          checkForUpdates={checkForUpdates}
          downloadUpdate={downloadUpdate}
          installUpdate={installUpdate}
        />
        <StorageSettingsCard {...storageSettings} />
        <LyricOperationSettingsCard
          lyricStyle={lyricStyle}
          updateLyricStyle={updateLyricStyle}
          resetLyricStyle={resetLyricStyle}
        />
        <FutureStylePackageCard />
      </div>
    </div>
  );
}
