import { TrackCover } from "../components/TrackCover";
import type { Track } from "../types";

export function RecentPage({ tracks, activeTrack, playing, playTrack }: { tracks: Track[]; activeTrack: Track; playing: boolean; playTrack: (trackId: string) => void }) {
  return <div className="page-inner recent-page"><div className="recent-table-head"><span>{"\u6b4c\u66f2\u6807\u9898"}</span><span>{"\u827a\u4eba"}</span><span>{"\u4e13\u8f91"}</span><span>{"\u64ad\u653e\u4e8e"}</span><span>{"\u65f6\u957f"}</span></div><div className="recent-list">{!tracks.length && <div className="empty-state">{"\u6682\u65e0\u6700\u8fd1\u64ad\u653e\uff0c\u5f00\u59cb\u542c\u6b4c\u540e\u4f1a\u81ea\u52a8\u8bb0\u5f55\u6700\u8fd1 200 \u9996\u3002"}</div>}{tracks.map((track) => { const active = track.id === activeTrack.id; return <button className={`recent-row ${active ? "active" : ""}`} type="button" key={track.id} onClick={() => playTrack(track.id)}><span className="recent-title"><TrackCover track={track} active={active} playing={playing} />{track.title}</span><span>{track.artist}</span><span>{track.album}</span><span>{"\u521a\u521a"}</span><span>{track.durationLabel}</span></button>; })}</div></div>;
}
