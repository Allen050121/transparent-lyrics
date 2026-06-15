import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { defaultLyricStyle, lyricPresets, normalizeLyricStyle } from "../lyricStyles";
import { getLyricWindow } from "../lyrics";
import { getCover } from "../media";
import type { LyricPreset, LyricStyle, Track } from "../types";

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onPreview,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const previewFrameRef = useRef<number | null>(null);
  const pendingPreviewRef = useRef(value);
  const committedValueRef = useRef(value);
  const hasPendingPreviewRef = useRef(false);

  useEffect(() => {
    setLocalValue(value);
    pendingPreviewRef.current = value;
    committedValueRef.current = value;
    hasPendingPreviewRef.current = false;
  }, [value]);

  useEffect(() => {
    return () => {
      if (previewFrameRef.current !== null) {
        window.cancelAnimationFrame(previewFrameRef.current);
      }
    };
  }, []);

  const nextValue = (raw: string) => Number(raw);
  const previewCurrent = (next: number) => {
    pendingPreviewRef.current = next;
    hasPendingPreviewRef.current = true;
    if (previewFrameRef.current !== null) return;
    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = null;
      onPreview(pendingPreviewRef.current);
    });
  };
  const commitValue = (next: number) => {
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
    pendingPreviewRef.current = next;
    setLocalValue(next);
    if (Object.is(committedValueRef.current, next) && !hasPendingPreviewRef.current) return;
    hasPendingPreviewRef.current = false;
    committedValueRef.current = next;
    onCommit(next);
  };
  const commitCurrent = (target: HTMLInputElement) => commitValue(nextValue(target.value));
  return (
    <label className="lyric-range">
      <span>{label}<b>{localValue}{unit}</b></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={(event) => {
          const value = nextValue(event.currentTarget.value);
          setLocalValue(value);
          previewCurrent(value);
        }}
        onPointerUp={(event) => commitCurrent(event.currentTarget)}
        onPointerCancel={(event) => commitCurrent(event.currentTarget)}
        onKeyUp={(event) => commitCurrent(event.currentTarget)}
        onBlur={(event) => commitCurrent(event.currentTarget)}
      />
    </label>
  );
}

function ColorControl({
  label,
  value,
  onPreview,
  onCommit,
}: {
  label: string;
  value: string;
  onPreview: (value: string) => void;
  onCommit: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const previewFrameRef = useRef<number | null>(null);
  const commitTimerRef = useRef<number | null>(null);
  const pendingPreviewRef = useRef(value);
  const committedValueRef = useRef(value);
  const hasPendingPreviewRef = useRef(false);

  useEffect(() => {
    setLocalValue(value);
    pendingPreviewRef.current = value;
    committedValueRef.current = value;
    hasPendingPreviewRef.current = false;
  }, [value]);

  useEffect(() => {
    return () => {
      if (previewFrameRef.current !== null) window.cancelAnimationFrame(previewFrameRef.current);
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    };
  }, []);

  const commitValue = (next: string) => {
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    pendingPreviewRef.current = next;
    setLocalValue(next);
    if (Object.is(committedValueRef.current, next) && !hasPendingPreviewRef.current) return;
    hasPendingPreviewRef.current = false;
    committedValueRef.current = next;
    onCommit(next);
  };

  const previewValue = (next: string) => {
    pendingPreviewRef.current = next;
    hasPendingPreviewRef.current = true;
    if (previewFrameRef.current === null) {
      previewFrameRef.current = window.requestAnimationFrame(() => {
        previewFrameRef.current = null;
        onPreview(pendingPreviewRef.current);
      });
    }
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = window.setTimeout(() => commitValue(pendingPreviewRef.current), 320);
  };

  return (
    <label>
      {label}
      <input
        type="color"
        value={localValue}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setLocalValue(next);
          previewValue(next);
        }}
        onBlur={(event) => commitValue(event.currentTarget.value)}
        onKeyUp={(event) => commitValue(event.currentTarget.value)}
      />
    </label>
  );
}

export function LyricsPage({
  activeTrack,
  currentTime,
  playing,
  lyricStyle,
  updateLyricStyle,
  applyLyricStyleToAllTracks,
  customLyricPresets,
  saveCustomLyricPreset,
  renameCustomLyricPreset,
  deleteCustomLyricPreset,
  uploadBackground,
  uploadCover,
  exitLyrics,
}: {
  activeTrack: Track;
  currentTime: number;
  playing: boolean;
  lyricStyle: LyricStyle;
  updateLyricStyle: (patch: Partial<LyricStyle>) => void;
  applyLyricStyleToAllTracks: (style: LyricStyle) => void;
  customLyricPresets: LyricPreset[];
  saveCustomLyricPreset: (style: LyricStyle) => void;
  renameCustomLyricPreset: (presetId: string) => void;
  deleteCustomLyricPreset: (presetId: string) => void;
  uploadBackground: () => void;
  uploadCover: () => void;
  exitLyrics: () => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [previewPatch, setPreviewPatch] = useState<Partial<LyricStyle>>({});
  const dragStateRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number } | null>(null);
  const lyricStackRef = useRef<HTMLDivElement>(null);
  const isTuning = Object.keys(previewPatch).length > 0;
  const style = normalizeLyricStyle({ ...lyricStyle, ...previewPatch });
  const lyricWindow = getLyricWindow(activeTrack, currentTime, style.lyricOffset);
  const cover = getCover(activeTrack);
  const background = style.backgroundImage || cover;
  const allPresets = [...lyricPresets, ...customLyricPresets];
  const previewNumber = (field: keyof LyricStyle, value: number) => setPreviewPatch((current) => ({ ...current, [field]: value }));
  const commitNumber = (field: keyof LyricStyle, value: number) => {
    setPreviewPatch((current) => {
      const next = { ...current };
      delete (next as Record<string, unknown>)[field];
      return next;
    });
    updateLyricStyle({ [field]: value } as Partial<LyricStyle>);
  };
  const previewColor = (field: keyof LyricStyle, value: string) => setPreviewPatch((current) => ({ ...current, [field]: value }));
  const commitColor = (field: keyof LyricStyle, value: string) => {
    setPreviewPatch((current) => {
      const next = { ...current };
      delete (next as Record<string, unknown>)[field];
      return next;
    });
    updateLyricStyle({ [field]: value } as Partial<LyricStyle>);
  };
  const applyPreset = (preset: LyricStyle) => {
    setPreviewPatch({});
    updateLyricStyle({ ...preset, backgroundImage: style.backgroundImage });
  };
  const fitReadableStyle = () => {
    setPreviewPatch({});
    const brightPreset = style.presetId === "heart-share";
    updateLyricStyle({
      backgroundDim: brightPreset ? 34 : 62,
      backgroundBlur: brightPreset ? 2 : 8,
      backgroundSaturation: brightPreset ? 86 : 112,
      color: brightPreset ? "#ffffff" : "#b9eeff",
      inactiveColor: brightPreset ? "#6f8298" : "#e7eef4",
      inactiveOpacity: brightPreset ? 0.5 : 0.42,
      glow: brightPreset ? 10 : 20,
      shadow: brightPreset ? 20 : 26,
      panelOpacity: 34,
    });
  };
  const buildLyricTransform = (x: number, y: number) => `translate(-50%, -50%) translate(${x}vw, ${y}vh) scale(${style.scale}) rotateX(${style.rotateX}deg) rotateY(${style.rotateY}deg) rotateZ(${style.rotateZ}deg) skew(${style.skewX}deg, ${style.skewY}deg)`;
  const transform = buildLyricTransform(style.x, style.y);
  const startLyricDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (style.layoutLocked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: style.x, startY: style.y };
    event.currentTarget.classList.add("dragging");
  };
  const moveLyricDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const nextX = Math.max(-40, Math.min(40, dragState.startX + ((event.clientX - dragState.startClientX) / window.innerWidth) * 100));
    const nextY = Math.max(-40, Math.min(40, dragState.startY + ((event.clientY - dragState.startClientY) / window.innerHeight) * 100));
    setPreviewPatch((current) => ({ ...current, x: Number(nextX.toFixed(1)), y: Number(nextY.toFixed(1)) }));
  };
  const endLyricDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    event.currentTarget.classList.remove("dragging");
    const nextX = Number(style.x.toFixed(1));
    const nextY = Number(style.y.toFixed(1));
    setPreviewPatch((current) => {
      const next = { ...current };
      delete next.x;
      delete next.y;
      return next;
    });
    updateLyricStyle({ x: nextX, y: nextY });
  };
  const lyricTextStyle: React.CSSProperties = {
    transform,
    opacity: style.opacity,
    perspective: `${style.perspective}px`,
    gap: `${style.lineGap}px`,
    WebkitTextStroke: `1px ${style.stroke}`,
  };
  const activeTextStyle: React.CSSProperties = {
    color: style.color,
    fontSize: style.fontSize,
    textShadow: `0 0 ${style.glow}px ${style.color}, 0 ${Math.round(style.shadow / 3)}px ${style.shadow}px rgba(0,0,0,.5)`,
  };
  const inactiveTextStyle: React.CSSProperties = {
    color: style.inactiveColor,
    opacity: style.inactiveOpacity,
  };
  const toggleCanvasDrag = () => {
    setPreviewPatch((current) => {
      const next = { ...current };
      delete next.layoutLocked;
      return next;
    });
    updateLyricStyle({ layoutLocked: !style.layoutLocked });
  };
  return (
    <div
      className={`lyrics-page-native preset-${style.presetId} mode-${style.lyricDisplayMode} ${style.scanline ? "has-scanline" : ""} ${style.layoutLocked ? "" : "is-drag-unlocked"} ${isTuning ? "is-tuning" : ""}`}
    >
      <div className="lyrics-bg" style={{ backgroundImage: `url(${background})`, filter: `blur(${style.backgroundBlur}px) saturate(${style.backgroundSaturation}%)` }} />
      <div className="lyrics-dim" style={{ background: `rgba(0, 0, 0, ${style.backgroundDim / 100})` }} />
      <div className="lyric-decor">
        <div className="decor-title">{activeTrack.title}</div>
        <div className="decor-card"><img alt="" src={cover} /></div>
        <div className="decor-disc"><img alt="" src={cover} /></div>
        <div className="decor-line" />
      </div>
      <button className="lyric-exit" type="button" onClick={exitLyrics} aria-label={"\u9000\u51fa\u6b4c\u8bcd\u9875"}>
        <Icon>keyboard_arrow_down</Icon>
      </button>
      {style.coverEnabled && (
        <div className="lyric-cover-orbit" style={{ left: `calc(50% + ${style.coverX}vw)`, top: `calc(50% + ${style.coverY}vh)`, width: style.coverSize, height: style.coverSize }}>
          <div className={`lyric-cover-disc ${playing && style.coverRotationSeconds > 0 ? "is-spinning" : ""}`} style={{ animationDuration: `${Math.max(1, style.coverRotationSeconds)}s` }}>
            <img alt="Album cover" src={cover} />
            <span />
          </div>
        </div>
      )}
      <div
        ref={lyricStackRef}
        className={`lyric-stack ${style.layoutLocked ? "locked" : ""}`}
        style={lyricTextStyle}
        onPointerDown={startLyricDrag}
        onPointerMove={moveLyricDrag}
        onPointerUp={endLyricDrag}
        onPointerCancel={endLyricDrag}
      >
        {style.lyricDisplayMode === "single" ? (
          <h2 key={lyricWindow.active} className="single-line" style={activeTextStyle}>{lyricWindow.active}</h2>
        ) : (
          <>
            {lyricWindow.previous.map((line) => <p key={line} style={inactiveTextStyle}>{line}</p>)}
            <h2 key={lyricWindow.active} style={activeTextStyle}>{lyricWindow.active}</h2>
            {lyricWindow.next.map((line) => <p key={line} style={inactiveTextStyle}>{line}</p>)}
          </>
        )}
      </div>
      <button className="lyric-panel-toggle" type="button" onClick={() => setPanelOpen((current) => !current)} aria-label={"\u6b4c\u8bcd\u6837\u5f0f"}>
        <Icon>{panelOpen ? "close" : "tune"}</Icon>
      </button>
      <button
        className={`lyric-drag-toggle ${style.layoutLocked ? "" : "active"}`}
        type="button"
        onClick={toggleCanvasDrag}
        aria-label={style.layoutLocked ? "\u5f00\u542f\u753b\u5e03\u62d6\u52a8" : "\u5173\u95ed\u753b\u5e03\u62d6\u52a8"}
      >
        <Icon>{style.layoutLocked ? "lock" : "lock_open"}</Icon>
      </button>
      <aside className={`lyric-style-panel ${panelOpen ? "open" : ""}`} style={{ background: `rgba(18, 20, 22, ${0.3 + style.panelOpacity / 100})` }}>
        <div className="lyric-panel-head">
          <span>{activeTrack.title}</span>
          <b>{activeTrack.artist}</b>
        </div>
        <div className="lyric-panel-actions">
          <button type="button" onClick={uploadBackground}><Icon>wallpaper</Icon>{"\u4e0a\u4f20\u80cc\u666f"}</button>
          <button type="button" onClick={uploadCover}><Icon>album</Icon>{"\u4e0a\u4f20\u5c01\u9762"}</button>
          <button type="button" onClick={() => updateLyricStyle(defaultLyricStyle)}><Icon>restart_alt</Icon>{"\u91cd\u7f6e\u6837\u5f0f"}</button>
        </div>
        <div className="lyric-quick-actions">
          <button type="button" onClick={fitReadableStyle}><Icon>auto_fix_high</Icon>{"\u667a\u80fd\u9002\u914d"}</button>
          <button type="button" onClick={() => saveCustomLyricPreset(style)}><Icon>bookmark_add</Icon>{"\u4fdd\u5b58\u6837\u5f0f"}</button>
          <button type="button" onClick={() => applyLyricStyleToAllTracks(style)}><Icon>library_music</Icon>{"\u5e94\u7528\u5168\u90e8"}</button>
          <button type="button" className={style.layoutLocked ? "" : "active"} onClick={toggleCanvasDrag}>
            <Icon>{style.layoutLocked ? "lock" : "lock_open"}</Icon>{style.layoutLocked ? "\u5f00\u542f\u62d6\u52a8" : "\u5173\u95ed\u62d6\u52a8"}
          </button>
        </div>
        <div className="preset-row">
          {allPresets.map((preset) => (
            <div key={preset.id} className={`preset-card-wrap ${preset.custom ? "is-custom" : ""}`}>
              <button type="button" className={`preset-card preset-thumb-${preset.style.presetId} ${style.presetId === preset.style.presetId ? "active" : ""}`} onClick={() => applyPreset(preset.style)}>
                <span className="preset-thumb"><i /><b /></span>
                <span>{preset.name}</span>
                {preset.custom && <small>{"\u6211\u7684"}</small>}
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
          <button type="button" className={style.lyricDisplayMode === "scroll" ? "active" : ""} onClick={() => updateLyricStyle({ lyricDisplayMode: "scroll" })}>{"\u9ed8\u8ba4\u6eda\u52a8"}</button>
          <button type="button" className={style.lyricDisplayMode === "stack" ? "active" : ""} onClick={() => updateLyricStyle({ lyricDisplayMode: "stack" })}>{"3D \u591a\u884c"}</button>
          <button type="button" className={style.lyricDisplayMode === "single" ? "active" : ""} onClick={() => updateLyricStyle({ lyricDisplayMode: "single" })}>{"\u5355\u53e5\u6de1\u5165"}</button>
        </div>
        <div className="lyric-panel-grid compact">
          <RangeControl label="X" value={style.x} min={-40} max={40} step={0.5} unit="vw" onPreview={(value) => previewNumber("x", value)} onCommit={(value) => commitNumber("x", value)} />
          <RangeControl label="Y" value={style.y} min={-40} max={40} step={0.5} unit="vh" onPreview={(value) => previewNumber("y", value)} onCommit={(value) => commitNumber("y", value)} />
          <RangeControl label={"\u5b57\u53f7"} value={style.fontSize} min={28} max={96} unit="px" onPreview={(value) => previewNumber("fontSize", value)} onCommit={(value) => commitNumber("fontSize", value)} />
          <RangeControl label={"\u80cc\u666f\u538b\u6697"} value={style.backgroundDim} min={0} max={85} unit="%" onPreview={(value) => previewNumber("backgroundDim", value)} onCommit={(value) => commitNumber("backgroundDim", value)} />
          <RangeControl label={"\u80cc\u666f\u6a21\u7cca"} value={style.backgroundBlur} min={0} max={32} unit="px" onPreview={(value) => previewNumber("backgroundBlur", value)} onCommit={(value) => commitNumber("backgroundBlur", value)} />
          <RangeControl label={"\u5c01\u9762\u5927\u5c0f"} value={style.coverSize} min={120} max={340} unit="px" onPreview={(value) => previewNumber("coverSize", value)} onCommit={(value) => commitNumber("coverSize", value)} />
        </div>
        <button className="advanced-toggle" type="button" onClick={() => setAdvancedOpen((current) => !current)}>
          <Icon>{advancedOpen ? "expand_less" : "expand_more"}</Icon>{advancedOpen ? "\u6536\u8d77\u9ad8\u7ea7\u53c2\u6570" : "\u9ad8\u7ea7\u53c2\u6570"}
        </button>
        {advancedOpen && <div className="lyric-panel-grid advanced">
          <RangeControl label={"\u7f29\u653e"} value={style.scale} min={0.6} max={1.8} step={0.05} onPreview={(value) => previewNumber("scale", value)} onCommit={(value) => commitNumber("scale", value)} />
          <RangeControl label="X 3D" value={style.rotateX} min={-45} max={45} unit="deg" onPreview={(value) => previewNumber("rotateX", value)} onCommit={(value) => commitNumber("rotateX", value)} />
          <RangeControl label="Y 3D" value={style.rotateY} min={-45} max={45} unit="deg" onPreview={(value) => previewNumber("rotateY", value)} onCommit={(value) => commitNumber("rotateY", value)} />
          <RangeControl label="Z" value={style.rotateZ} min={-20} max={20} unit="deg" onPreview={(value) => previewNumber("rotateZ", value)} onCommit={(value) => commitNumber("rotateZ", value)} />
          <RangeControl label="Skew X" value={style.skewX} min={-20} max={20} unit="deg" onPreview={(value) => previewNumber("skewX", value)} onCommit={(value) => commitNumber("skewX", value)} />
          <RangeControl label="Skew Y" value={style.skewY} min={-20} max={20} unit="deg" onPreview={(value) => previewNumber("skewY", value)} onCommit={(value) => commitNumber("skewY", value)} />
          <RangeControl label={"\u900f\u89c6"} value={style.perspective} min={500} max={1800} unit="px" onPreview={(value) => previewNumber("perspective", value)} onCommit={(value) => commitNumber("perspective", value)} />
          <RangeControl label={"\u900f\u660e"} value={style.opacity} min={0.35} max={1} step={0.05} onPreview={(value) => previewNumber("opacity", value)} onCommit={(value) => commitNumber("opacity", value)} />
          <RangeControl label={"\u6b4c\u8bcd\u504f\u79fb"} value={style.lyricOffset} min={-5} max={5} step={0.1} unit="s" onPreview={(value) => previewNumber("lyricOffset", value)} onCommit={(value) => commitNumber("lyricOffset", value)} />
          <RangeControl label={"\u526f\u8bcd\u900f\u660e"} value={style.inactiveOpacity} min={0.15} max={0.9} step={0.05} onPreview={(value) => previewNumber("inactiveOpacity", value)} onCommit={(value) => commitNumber("inactiveOpacity", value)} />
          <RangeControl label={"\u884c\u8ddd"} value={style.lineGap} min={8} max={48} unit="px" onPreview={(value) => previewNumber("lineGap", value)} onCommit={(value) => commitNumber("lineGap", value)} />
          <RangeControl label={"\u80cc\u666f\u6a21\u7cca"} value={style.backgroundBlur} min={0} max={32} unit="px" onPreview={(value) => previewNumber("backgroundBlur", value)} onCommit={(value) => commitNumber("backgroundBlur", value)} />
          <RangeControl label={"\u80cc\u666f\u538b\u6697"} value={style.backgroundDim} min={0} max={85} unit="%" onPreview={(value) => previewNumber("backgroundDim", value)} onCommit={(value) => commitNumber("backgroundDim", value)} />
          <RangeControl label={"\u9971\u548c\u5ea6"} value={style.backgroundSaturation} min={60} max={160} unit="%" onPreview={(value) => previewNumber("backgroundSaturation", value)} onCommit={(value) => commitNumber("backgroundSaturation", value)} />
          <RangeControl label={"\u53d1\u5149"} value={style.glow} min={0} max={48} unit="px" onPreview={(value) => previewNumber("glow", value)} onCommit={(value) => commitNumber("glow", value)} />
          <RangeControl label={"\u9634\u5f71"} value={style.shadow} min={0} max={48} unit="px" onPreview={(value) => previewNumber("shadow", value)} onCommit={(value) => commitNumber("shadow", value)} />
          <RangeControl label={"\u9762\u677f"} value={style.panelOpacity} min={0} max={70} unit="%" onPreview={(value) => previewNumber("panelOpacity", value)} onCommit={(value) => commitNumber("panelOpacity", value)} />
          <RangeControl label={"\u5c01\u9762 X"} value={style.coverX} min={-40} max={40} step={0.5} unit="vw" onPreview={(value) => previewNumber("coverX", value)} onCommit={(value) => commitNumber("coverX", value)} />
          <RangeControl label={"\u5c01\u9762 Y"} value={style.coverY} min={-40} max={40} step={0.5} unit="vh" onPreview={(value) => previewNumber("coverY", value)} onCommit={(value) => commitNumber("coverY", value)} />
          <RangeControl label={"\u65cb\u8f6c\u901f\u5ea6"} value={style.coverRotationSeconds} min={0} max={18} unit="s" onPreview={(value) => previewNumber("coverRotationSeconds", value)} onCommit={(value) => commitNumber("coverRotationSeconds", value)} />
        </div>}
        <div className="lyric-color-row">
          <ColorControl label={"\u4e3b\u6b4c\u8bcd"} value={style.color} onPreview={(value) => previewColor("color", value)} onCommit={(value) => commitColor("color", value)} />
          <ColorControl label={"\u526f\u6b4c\u8bcd"} value={style.inactiveColor} onPreview={(value) => previewColor("inactiveColor", value)} onCommit={(value) => commitColor("inactiveColor", value)} />
        </div>
        <div className="lyric-toggle-row">
          <label><input type="checkbox" checked={style.scanline} onChange={(event) => updateLyricStyle({ scanline: event.currentTarget.checked })} />{'\u5149\u6805'}</label>
          <label><input type="checkbox" checked={style.coverEnabled} onChange={(event) => updateLyricStyle({ coverEnabled: event.currentTarget.checked })} />{'\u65cb\u8f6c\u5c01\u9762'}</label>
        </div>
      </aside>
    </div>
  );
}
