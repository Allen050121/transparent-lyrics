import React, { useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { LyricStylePanel } from "../components/lyrics/LyricStylePanel";
import { LyricVisualStage } from "../components/lyrics/LyricVisualStage";
import { lyricPresets, normalizeLyricStyle } from "../lyricStyles";
import { getLyricWindow } from "../lyrics";
import { getCover } from "../media";
import type { LyricPreset, LyricStyle, Track } from "../types";

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

  const previewNumber = (field: keyof LyricStyle, value: number) => {
    setPreviewPatch((current) => ({ ...current, [field]: value }));
  };

  const commitNumber = (field: keyof LyricStyle, value: number) => {
    setPreviewPatch((current) => {
      const next = { ...current };
      delete (next as Record<string, unknown>)[field];
      return next;
    });
    updateLyricStyle({ [field]: value } as Partial<LyricStyle>);
  };

  const previewColor = (field: keyof LyricStyle, value: string) => {
    setPreviewPatch((current) => ({ ...current, [field]: value }));
  };

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

  const toggleCanvasDrag = () => {
    setPreviewPatch((current) => {
      const next = { ...current };
      delete next.layoutLocked;
      return next;
    });
    updateLyricStyle({ layoutLocked: !style.layoutLocked });
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

  return (
    <div
      className={`lyrics-page-native preset-${style.presetId} mode-${style.lyricDisplayMode} ${style.scanline ? "has-scanline" : ""} ${style.layoutLocked ? "" : "is-drag-unlocked"} ${isTuning ? "is-tuning" : ""}`}
    >
      <LyricVisualStage
        activeTrack={activeTrack}
        background={background}
        cover={cover}
        playing={playing}
        style={style}
        lyricWindow={lyricWindow}
        lyricTextStyle={lyricTextStyle}
        activeTextStyle={activeTextStyle}
        inactiveTextStyle={inactiveTextStyle}
        lyricStackRef={lyricStackRef}
        onExit={exitLyrics}
        onStartDrag={startLyricDrag}
        onMoveDrag={moveLyricDrag}
        onEndDrag={endLyricDrag}
      />

      <button className="lyric-panel-toggle" type="button" onClick={() => setPanelOpen((current) => !current)} aria-label="歌词样式">
        <Icon>{panelOpen ? "close" : "tune"}</Icon>
      </button>
      <button
        className={`lyric-drag-toggle ${style.layoutLocked ? "" : "active"}`}
        type="button"
        onClick={toggleCanvasDrag}
        aria-label={style.layoutLocked ? "开启画布拖动" : "关闭画布拖动"}
      >
        <Icon>{style.layoutLocked ? "lock" : "lock_open"}</Icon>
      </button>

      <LyricStylePanel
        open={panelOpen}
        advancedOpen={advancedOpen}
        activeTrack={activeTrack}
        style={style}
        presets={allPresets}
        onToggleAdvanced={() => setAdvancedOpen((current) => !current)}
        updateLyricStyle={updateLyricStyle}
        applyPreset={applyPreset}
        fitReadableStyle={fitReadableStyle}
        saveCustomLyricPreset={saveCustomLyricPreset}
        applyLyricStyleToAllTracks={applyLyricStyleToAllTracks}
        renameCustomLyricPreset={renameCustomLyricPreset}
        deleteCustomLyricPreset={deleteCustomLyricPreset}
        uploadBackground={uploadBackground}
        uploadCover={uploadCover}
        toggleCanvasDrag={toggleCanvasDrag}
        previewNumber={previewNumber}
        commitNumber={commitNumber}
        previewColor={previewColor}
        commitColor={commitColor}
      />
    </div>
  );
}
