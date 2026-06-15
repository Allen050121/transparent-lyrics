import React from "react";
import { Icon } from "./Icon";
import { formatDuration, getCover } from "../media";
import type { Track, View } from "../types";

export function PlayerBar({
  activeTrack,
  playing,
  currentTime,
  volume,
  setVolume,
  playRelative,
  togglePlayback,
  seekTo,
  navigate,
}: {
  activeTrack: Track;
  playing: boolean;
  currentTime: number;
  volume: number;
  setVolume: (volume: number) => void;
  playRelative: (offset: number) => void;
  togglePlayback: () => void;
  seekTo: (seconds: number) => void;
  navigate: (view: View) => void;
}) {
  const progress = activeTrack.duration ? Math.min(100, (currentTime / activeTrack.duration) * 100) : 0;
  const updateFromPointer = (event: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    seekTo(percent * activeTrack.duration);
  };
  return (
    <footer className="player-bar">
      <div className="now-playing">
        <div className="now-cover"><img alt="Now Playing" src={getCover(activeTrack)} /></div>
        <div><b>{activeTrack.title}</b><span>{activeTrack.artist}</span></div>
        <button type="button" className="favorite"><Icon>favorite</Icon></button>
      </div>
      <div className="player-center">
        <div className="player-buttons">
          <button type="button"><Icon>shuffle</Icon></button>
          <button type="button" onClick={() => playRelative(-1)}><Icon>skip_previous</Icon></button>
          <button className="play-main" type="button" onClick={togglePlayback} aria-label={playing ? "\u6682\u505c" : "\u64ad\u653e"}><Icon>{playing ? "pause" : "play_arrow"}</Icon></button>
          <button type="button" onClick={() => playRelative(1)}><Icon>skip_next</Icon></button>
          <button type="button"><Icon>repeat</Icon></button>
        </div>
        <div className="progress-line">
          <span>{formatDuration(currentTime)}</span>
          <div className="progress-track" onPointerDown={updateFromPointer} onClick={updateFromPointer}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <div className="progress-thumb" style={{ left: `${progress}%` }} />
          </div>
          <span>{activeTrack.durationLabel}</span>
        </div>
      </div>
      <div className="player-actions">
        <button type="button" onClick={() => navigate("lyrics")} aria-label={"\u6b4c\u8bcd"}><Icon>lyrics</Icon></button>
        <button type="button" onClick={() => navigate("mini")} aria-label={"\u64ad\u653e\u5217\u8868"}><Icon>queue_music</Icon></button>
        <div className="volume-control" onWheel={(event) => {
          event.preventDefault();
          setVolume(Math.max(0, Math.min(1, volume + (event.deltaY < 0 ? 0.04 : -0.04))));
        }}>
          <Icon>volume_up</Icon>
          <input type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={(event) => setVolume(Number(event.currentTarget.value) / 100)} />
          <span>{Math.round(volume * 100)}</span>
        </div>
        <button type="button" aria-label={"\u5168\u5c4f"}><Icon>fullscreen</Icon></button>
      </div>
    </footer>
  );
}
