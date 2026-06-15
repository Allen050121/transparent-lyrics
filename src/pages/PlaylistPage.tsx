import { Icon } from "../components/Icon";
import { TrackTable } from "../components/TrackTable";
import type { Track } from "../types";

export function PlaylistPage({ playlistName, tracks, activeTrack, playing, playTrack }: { playlistName: string; tracks: Track[]; activeTrack: Track; playing: boolean; playTrack: (trackId: string) => void }) {
  const descriptions: Record<string, string> = {
    "\u6df1\u591c\u6c89\u6d78": "\u5728\u9759\u8c27\u7684\u591c\u665a\uff0c\u8ba9\u8f7b\u76c8\u7684\u65cb\u5f8b\u5e26\u4f60\u8fdb\u5165\u6df1\u5c42\u51a5\u60f3\u3002",
    "\u96e8\u5929\u6f2b\u6b65": "\u9002\u5408\u96e8\u58f0\u548c\u57ce\u5e02\u706f\u5f71\u7684\u6162\u901f\u6b4c\u5355\u3002",
    "\u5de5\u4f5c\u7535\u53f0": "\u8282\u594f\u7a33\u5b9a\uff0c\u9002\u5408\u6574\u7406\u601d\u8def\u548c\u4e13\u6ce8\u5de5\u4f5c\u3002",
  };
  return <div className="page-inner playlist-page"><section className="playlist-hero"><Icon>play_circle</Icon><span>EXCLUSIVE PLAYLIST</span><h2>{playlistName}</h2><p>{descriptions[playlistName] ?? descriptions["\u6df1\u591c\u6c89\u6d78"]}</p></section><TrackTable tracks={tracks} activeTrack={activeTrack} playing={playing} playTrack={playTrack} emptyText={"\u6b4c\u5355\u8fd8\u6ca1\u6709\u6b4c\u66f2\uff0c\u5148\u4ece\u97f3\u4e50\u5e93\u6dfb\u52a0\u3002"} /></div>;
}
