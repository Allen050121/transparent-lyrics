import type { Track } from "../types";
import { Icon } from "./Icon";
import { TrackCover } from "./TrackCover";

export function TrackTable({
  tracks,
  activeTrack,
  playing,
  playTrack,
  emptyText,
}: {
  tracks: Track[];
  activeTrack: Track;
  playing: boolean;
  playTrack: (trackId: string) => void;
  emptyText: string;
}) {
  return (
    <div className="glass-panel track-table">
      <div className="track-header"><div>{"\u6807\u9898"}</div><div>{"\u6b4c\u624b"}</div><div>{"\u4e13\u8f91"}</div><div>{"\u6dfb\u52a0\u65f6\u95f4"}</div><div><Icon>schedule</Icon></div></div>
      <div className="track-body">
        {!tracks.length && <div className="empty-state">{emptyText}</div>}
        {tracks.map((track) => {
          const active = track.id === activeTrack.id;
          return <button className={`track-row ${active ? "active" : ""}`} key={track.id} type="button" onClick={() => playTrack(track.id)}><div className="track-title-cell"><TrackCover track={track} active={active} playing={playing} /><span className={active ? "accent-text" : ""}>{track.title}</span></div><div>{track.artist}</div><div>{track.album}</div><div className="center-cell">{track.added || "\u521a\u521a"}</div><div className="right-cell">{track.durationLabel}</div></button>;
        })}
      </div>
    </div>
  );
}
