import { defaultLyricStyle } from "../../lyricStyles";
import type { LyricPreset, LyricStyle, Track } from "../../types";
import { Icon } from "../Icon";
import { LyricParameterControls } from "./LyricParameterControls";

export function LyricStylePanel({
  open,
  advancedOpen,
  activeTrack,
  style,
  presets,
  onToggleAdvanced,
  updateLyricStyle,
  applyPreset,
  fitReadableStyle,
  saveCustomLyricPreset,
  applyLyricStyleToAllTracks,
  renameCustomLyricPreset,
  deleteCustomLyricPreset,
  uploadBackground,
  uploadCover,
  toggleCanvasDrag,
  previewNumber,
  commitNumber,
  previewColor,
  commitColor,
}: {
  open: boolean;
  advancedOpen: boolean;
  activeTrack: Track;
  style: LyricStyle;
  presets: LyricPreset[];
  onToggleAdvanced: () => void;
  updateLyricStyle: (patch: Partial<LyricStyle>) => void;
  applyPreset: (style: LyricStyle) => void;
  fitReadableStyle: () => void;
  saveCustomLyricPreset: (style: LyricStyle) => void;
  applyLyricStyleToAllTracks: (style: LyricStyle) => void;
  renameCustomLyricPreset: (presetId: string) => void;
  deleteCustomLyricPreset: (presetId: string) => void;
  uploadBackground: () => void;
  uploadCover: () => void;
  toggleCanvasDrag: () => void;
  previewNumber: (field: keyof LyricStyle, value: number) => void;
  commitNumber: (field: keyof LyricStyle, value: number) => void;
  previewColor: (field: keyof LyricStyle, value: string) => void;
  commitColor: (field: keyof LyricStyle, value: string) => void;
}) {
  return (
    <aside className={`lyric-style-panel ${open ? "open" : ""}`} style={{ background: `rgba(18, 20, 22, ${0.3 + style.panelOpacity / 100})` }}>
      <div className="lyric-panel-head">
        <span>{activeTrack.title}</span>
        <b>{activeTrack.artist}</b>
      </div>

      <div className="lyric-panel-actions">
        <button type="button" onClick={uploadBackground}><Icon>wallpaper</Icon>上传背景</button>
        <button type="button" onClick={uploadCover}><Icon>album</Icon>上传封面</button>
        <button type="button" onClick={() => updateLyricStyle(defaultLyricStyle)}><Icon>restart_alt</Icon>重置样式</button>
      </div>

      <div className="lyric-quick-actions">
        <button type="button" onClick={fitReadableStyle}><Icon>auto_fix_high</Icon>智能适配</button>
        <button type="button" onClick={() => saveCustomLyricPreset(style)}><Icon>bookmark_add</Icon>保存样式</button>
        <button type="button" onClick={() => applyLyricStyleToAllTracks(style)}><Icon>library_music</Icon>应用全部</button>
        <button type="button" className={style.layoutLocked ? "" : "active"} onClick={toggleCanvasDrag}>
          <Icon>{style.layoutLocked ? "lock" : "lock_open"}</Icon>{style.layoutLocked ? "开启拖动" : "关闭拖动"}
        </button>
      </div>

      <div className="preset-row">
        {presets.map((preset) => (
          <div key={preset.id} className={`preset-card-wrap ${preset.custom ? "is-custom" : ""}`}>
            <button
              type="button"
              className={`preset-card preset-thumb-${preset.style.presetId} ${style.presetId === preset.style.presetId ? "active" : ""}`}
              onClick={() => applyPreset(preset.style)}
            >
              <span className="preset-thumb"><i /><b /></span>
              <span>{preset.name}</span>
              {preset.custom && <small>我的</small>}
            </button>
            {preset.custom && (
              <span className="preset-manage">
                <button type="button" aria-label={`重命名 ${preset.name}`} onClick={() => renameCustomLyricPreset(preset.id)}><Icon>edit</Icon></button>
                <button type="button" aria-label={`删除 ${preset.name}`} onClick={() => deleteCustomLyricPreset(preset.id)}><Icon>delete</Icon></button>
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mode-row">
        <button type="button" className={style.lyricDisplayMode === "scroll" ? "active" : ""} onClick={() => updateLyricStyle({ lyricDisplayMode: "scroll" })}>默认滚动</button>
        <button type="button" className={style.lyricDisplayMode === "stack" ? "active" : ""} onClick={() => updateLyricStyle({ lyricDisplayMode: "stack" })}>3D 多行</button>
        <button type="button" className={style.lyricDisplayMode === "single" ? "active" : ""} onClick={() => updateLyricStyle({ lyricDisplayMode: "single" })}>单句淡入</button>
      </div>

      <LyricParameterControls
        style={style}
        advancedOpen={advancedOpen}
        onToggleAdvanced={onToggleAdvanced}
        updateLyricStyle={updateLyricStyle}
        previewNumber={previewNumber}
        commitNumber={commitNumber}
        previewColor={previewColor}
        commitColor={commitColor}
      />
    </aside>
  );
}
