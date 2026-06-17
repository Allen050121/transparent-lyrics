import React from "react";
import { Icon } from "../Icon";
import type { LyricStyle, Track } from "../../types";

export type LyricWindow = {
  previous: string[];
  active: string;
  next: string[];
};

export function LyricVisualStage({
  activeTrack,
  background,
  cover,
  playing,
  style,
  lyricWindow,
  lyricTextStyle,
  activeTextStyle,
  inactiveTextStyle,
  lyricStackRef,
  onExit,
  onStartDrag,
  onMoveDrag,
  onEndDrag,
}: {
  activeTrack: Track;
  background: string;
  cover: string;
  playing: boolean;
  style: LyricStyle;
  lyricWindow: LyricWindow;
  lyricTextStyle: React.CSSProperties;
  activeTextStyle: React.CSSProperties;
  inactiveTextStyle: React.CSSProperties;
  lyricStackRef: React.RefObject<HTMLDivElement | null>;
  onExit: () => void;
  onStartDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  onMoveDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  onEndDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <>
      <div className="lyrics-bg" style={{ backgroundImage: `url(${background})`, filter: `blur(${style.backgroundBlur}px) saturate(${style.backgroundSaturation}%)` }} />
      <div className="lyrics-dim" style={{ background: `rgba(0, 0, 0, ${style.backgroundDim / 100})` }} />
      <div className="lyric-decor">
        <div className="decor-title">{activeTrack.title}</div>
        <div className="decor-card"><img alt="" src={cover} /></div>
        <div className="decor-disc"><img alt="" src={cover} /></div>
        <div className="decor-line" />
      </div>
      <button className="lyric-exit" type="button" onClick={onExit} aria-label="退出歌词页">
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
        onPointerDown={onStartDrag}
        onPointerMove={onMoveDrag}
        onPointerUp={onEndDrag}
        onPointerCancel={onEndDrag}
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
    </>
  );
}
