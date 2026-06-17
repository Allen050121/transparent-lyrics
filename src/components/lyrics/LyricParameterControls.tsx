import type { LyricStyle } from "../../types";
import { Icon } from "../Icon";
import { ColorControl, RangeControl } from "./LyricTuningControls";

export function LyricParameterControls({
  style,
  advancedOpen,
  onToggleAdvanced,
  updateLyricStyle,
  previewNumber,
  commitNumber,
  previewColor,
  commitColor,
}: {
  style: LyricStyle;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  updateLyricStyle: (patch: Partial<LyricStyle>) => void;
  previewNumber: (field: keyof LyricStyle, value: number) => void;
  commitNumber: (field: keyof LyricStyle, value: number) => void;
  previewColor: (field: keyof LyricStyle, value: string) => void;
  commitColor: (field: keyof LyricStyle, value: string) => void;
}) {
  return (
    <>
      <div className="lyric-panel-grid compact">
        <RangeControl label="X" value={style.x} min={-40} max={40} step={0.5} unit="vw" onPreview={(value) => previewNumber("x", value)} onCommit={(value) => commitNumber("x", value)} />
        <RangeControl label="Y" value={style.y} min={-40} max={40} step={0.5} unit="vh" onPreview={(value) => previewNumber("y", value)} onCommit={(value) => commitNumber("y", value)} />
        <RangeControl label="字号" value={style.fontSize} min={28} max={96} unit="px" onPreview={(value) => previewNumber("fontSize", value)} onCommit={(value) => commitNumber("fontSize", value)} />
        <RangeControl label="背景压暗" value={style.backgroundDim} min={0} max={85} unit="%" onPreview={(value) => previewNumber("backgroundDim", value)} onCommit={(value) => commitNumber("backgroundDim", value)} />
        <RangeControl label="背景模糊" value={style.backgroundBlur} min={0} max={32} unit="px" onPreview={(value) => previewNumber("backgroundBlur", value)} onCommit={(value) => commitNumber("backgroundBlur", value)} />
        <RangeControl label="封面大小" value={style.coverSize} min={120} max={340} unit="px" onPreview={(value) => previewNumber("coverSize", value)} onCommit={(value) => commitNumber("coverSize", value)} />
      </div>

      <button className="advanced-toggle" type="button" onClick={onToggleAdvanced}>
        <Icon>{advancedOpen ? "expand_less" : "expand_more"}</Icon>{advancedOpen ? "收起高级参数" : "高级参数"}
      </button>

      {advancedOpen && (
        <div className="lyric-panel-grid advanced">
          <RangeControl label="缩放" value={style.scale} min={0.6} max={1.8} step={0.05} onPreview={(value) => previewNumber("scale", value)} onCommit={(value) => commitNumber("scale", value)} />
          <RangeControl label="X 3D" value={style.rotateX} min={-45} max={45} unit="deg" onPreview={(value) => previewNumber("rotateX", value)} onCommit={(value) => commitNumber("rotateX", value)} />
          <RangeControl label="Y 3D" value={style.rotateY} min={-45} max={45} unit="deg" onPreview={(value) => previewNumber("rotateY", value)} onCommit={(value) => commitNumber("rotateY", value)} />
          <RangeControl label="Z" value={style.rotateZ} min={-20} max={20} unit="deg" onPreview={(value) => previewNumber("rotateZ", value)} onCommit={(value) => commitNumber("rotateZ", value)} />
          <RangeControl label="Skew X" value={style.skewX} min={-20} max={20} unit="deg" onPreview={(value) => previewNumber("skewX", value)} onCommit={(value) => commitNumber("skewX", value)} />
          <RangeControl label="Skew Y" value={style.skewY} min={-20} max={20} unit="deg" onPreview={(value) => previewNumber("skewY", value)} onCommit={(value) => commitNumber("skewY", value)} />
          <RangeControl label="透视" value={style.perspective} min={500} max={1800} unit="px" onPreview={(value) => previewNumber("perspective", value)} onCommit={(value) => commitNumber("perspective", value)} />
          <RangeControl label="透明" value={style.opacity} min={0.35} max={1} step={0.05} onPreview={(value) => previewNumber("opacity", value)} onCommit={(value) => commitNumber("opacity", value)} />
          <RangeControl label="歌词偏移" value={style.lyricOffset} min={-5} max={5} step={0.1} unit="s" onPreview={(value) => previewNumber("lyricOffset", value)} onCommit={(value) => commitNumber("lyricOffset", value)} />
          <RangeControl label="副词透明" value={style.inactiveOpacity} min={0.15} max={0.9} step={0.05} onPreview={(value) => previewNumber("inactiveOpacity", value)} onCommit={(value) => commitNumber("inactiveOpacity", value)} />
          <RangeControl label="行距" value={style.lineGap} min={8} max={48} unit="px" onPreview={(value) => previewNumber("lineGap", value)} onCommit={(value) => commitNumber("lineGap", value)} />
          <RangeControl label="背景模糊" value={style.backgroundBlur} min={0} max={32} unit="px" onPreview={(value) => previewNumber("backgroundBlur", value)} onCommit={(value) => commitNumber("backgroundBlur", value)} />
          <RangeControl label="背景压暗" value={style.backgroundDim} min={0} max={85} unit="%" onPreview={(value) => previewNumber("backgroundDim", value)} onCommit={(value) => commitNumber("backgroundDim", value)} />
          <RangeControl label="饱和度" value={style.backgroundSaturation} min={60} max={160} unit="%" onPreview={(value) => previewNumber("backgroundSaturation", value)} onCommit={(value) => commitNumber("backgroundSaturation", value)} />
          <RangeControl label="发光" value={style.glow} min={0} max={48} unit="px" onPreview={(value) => previewNumber("glow", value)} onCommit={(value) => commitNumber("glow", value)} />
          <RangeControl label="阴影" value={style.shadow} min={0} max={48} unit="px" onPreview={(value) => previewNumber("shadow", value)} onCommit={(value) => commitNumber("shadow", value)} />
          <RangeControl label="面板" value={style.panelOpacity} min={0} max={70} unit="%" onPreview={(value) => previewNumber("panelOpacity", value)} onCommit={(value) => commitNumber("panelOpacity", value)} />
          <RangeControl label="封面 X" value={style.coverX} min={-40} max={40} step={0.5} unit="vw" onPreview={(value) => previewNumber("coverX", value)} onCommit={(value) => commitNumber("coverX", value)} />
          <RangeControl label="封面 Y" value={style.coverY} min={-40} max={40} step={0.5} unit="vh" onPreview={(value) => previewNumber("coverY", value)} onCommit={(value) => commitNumber("coverY", value)} />
          <RangeControl label="旋转速度" value={style.coverRotationSeconds} min={0} max={18} unit="s" onPreview={(value) => previewNumber("coverRotationSeconds", value)} onCommit={(value) => commitNumber("coverRotationSeconds", value)} />
        </div>
      )}

      <div className="lyric-color-row">
        <ColorControl label="主歌词" value={style.color} onPreview={(value) => previewColor("color", value)} onCommit={(value) => commitColor("color", value)} />
        <ColorControl label="副歌词" value={style.inactiveColor} onPreview={(value) => previewColor("inactiveColor", value)} onCommit={(value) => commitColor("inactiveColor", value)} />
      </div>

      <div className="lyric-toggle-row">
        <label><input type="checkbox" checked={style.scanline} onChange={(event) => updateLyricStyle({ scanline: event.currentTarget.checked })} />光栅</label>
        <label><input type="checkbox" checked={style.coverEnabled} onChange={(event) => updateLyricStyle({ coverEnabled: event.currentTarget.checked })} />旋转封面</label>
      </div>
    </>
  );
}
