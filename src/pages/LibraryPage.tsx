import { TrackTable } from "../components/TrackTable";
import { UpdateBanner, UpdateCheckCard } from "../components/UpdateCards";
import { getLibraryStats } from "../media";
import type { Track } from "../types";
import { Icon } from "../components/Icon";

export function LibraryPage({
  tracks,
  activeTrack,
  playing,
  playTrack,
  playAll,
  updaterStatus,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
}: {
  tracks: Track[];
  activeTrack: Track;
  playing: boolean;
  playTrack: (trackId: string) => void;
  playAll: () => void;
  updaterStatus: UpdaterStatus;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  installUpdate: () => void;
}) {
  const stats = getLibraryStats(tracks);
  return (
    <div className="page-inner library-page">
      <section className="page-heading"><h2>{"\u97f3\u4e50\u5e93"}</h2><p><span>{stats.count}</span><span>•</span><span>{stats.duration}</span></p></section>
      <UpdateCheckCard status={updaterStatus} checkForUpdates={checkForUpdates} />
      <UpdateBanner status={updaterStatus} downloadUpdate={downloadUpdate} installUpdate={installUpdate} />
      <div className="toolbar-row"><div className="button-row"><button className="primary-pill" type="button" onClick={playAll}>{"\u5168\u90e8\u64ad\u653e"}</button><button className="ghost-pill" type="button"><Icon>shuffle</Icon>{"\u968f\u673a"}</button></div><button className="icon-button" type="button" aria-label={"\u7b5b\u9009"}><Icon>filter_list</Icon></button></div>
      <TrackTable tracks={tracks} activeTrack={activeTrack} playing={playing} playTrack={playTrack} emptyText={"\u97f3\u4e50\u5e93\u8fd8\u662f\u7a7a\u7684\uff0c\u5148\u53bb\u5bfc\u5165\u8d44\u6e90\u6dfb\u52a0\u672c\u5730\u6b4c\u66f2\u3002"} />
      <div className="load-more-wrap"><button className="load-more" type="button">{"\u52a0\u8f7d\u66f4\u591a"}</button></div>
    </div>
  );
}
