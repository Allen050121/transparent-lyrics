import { Icon } from "../components/Icon";
import { TrackCover } from "../components/TrackCover";
import { lyricStatusLabel } from "../lyrics";
import type { Track } from "../types";

export function ImportPage({
  tracks,
  matchingLyrics,
  importAudio,
  importFolder,
  importLrc,
  importBackgroundImage,
  importCoverImage,
  matchAllLyrics,
  retryLyricsForTrack,
  openManualLyrics,
}: {
  tracks: Track[];
  matchingLyrics: boolean;
  importAudio: () => void;
  importFolder: () => void;
  importLrc: () => void;
  importBackgroundImage: () => void;
  importCoverImage: () => void;
  matchAllLyrics: () => void;
  retryLyricsForTrack: (trackId: string) => void;
  openManualLyrics: (track: Track) => void;
}) {
  const localTracks = tracks.filter((track) => !track.id.startsWith("demo-"));
  const matchedCount = localTracks.filter((track) => track.lyrics?.status === "matched").length;
  return (
    <div className="page-inner import-page">
      {localTracks.length > 0 && (
        <div className="success-banner"><Icon>check_circle</Icon><span>{"\u5df2\u5bfc\u5165 "}{localTracks.length}{" \u9996\u672c\u5730\u6b4c\u66f2\uff0c"}{matchedCount}{" \u9996\u5df2\u5339\u914d\u6b4c\u8bcd"}</span></div>
      )}
      <div className="import-grid">
        <ImportCard icon="library_add" title={"\u5bfc\u5165\u672c\u5730\u6b4c\u66f2"} description={"\u9009\u62e9\u5355\u9996\u6b4c\u66f2\uff0c\u6216\u626b\u63cf\u6574\u4e2a\u97f3\u4e50\u6587\u4ef6\u5939\u3002"} body={"\u5bfc\u5165\u540e\u81ea\u52a8\u5c1d\u8bd5\u5339\u914d\u6b4c\u8bcd"} actions={[{ label: "\u9009\u62e9\u6b4c\u66f2\u6587\u4ef6", onClick: importAudio }, { label: "\u9009\u62e9\u97f3\u4e50\u6587\u4ef6\u5939", onClick: importFolder }]} />
        <ImportCard icon="lyrics" title={"\u6b4c\u8bcd\u8865\u5168"} description={"\u652f\u6301 LRC \u5bfc\u5165\uff0c\u4e5f\u53ef\u6279\u91cf\u5728\u7ebf\u5339\u914d\u672c\u5730\u6b4c\u66f2\u3002"} body={matchingLyrics ? "\u6b63\u5728\u5339\u914d\u6b4c\u8bcd..." : "\u4f18\u5148\u4fdd\u5b58\u540c\u6b65\u6b4c\u8bcd"} actions={[{ label: "\u6279\u91cf\u8865\u5168\u6b4c\u8bcd", onClick: matchAllLyrics }, { label: "\u5bfc\u5165 LRC \u6587\u4ef6", onClick: importLrc }]} />
        <ImportCard icon="wallpaper" title={"\u4e0a\u4f20\u58c1\u7eb8"} description={"\u4e3a\u6b4c\u8bcd\u9875\u9762\u8bbe\u7f6e\u4e13\u5c5e\u80cc\u666f\u56fe\u3002"} body={"\u652f\u6301 JPG\u3001PNG \u7b49\u56fe\u7247"} actions={[{ label: "\u9009\u62e9\u80cc\u666f\u56fe", onClick: importBackgroundImage }]} />
        <ImportCard icon="image" title={"\u5173\u8054\u5c01\u9762\u56fe"} description={"\u4e3a\u5f53\u524d\u6b4c\u66f2\u8865\u5145\u5c01\u9762\uff0c\u4e0d\u4f1a\u8986\u76d6\u6b4c\u8bcd\u80cc\u666f\u3002"} body={"\u5c01\u9762\u7528\u4e8e\u5e95\u90e8\u64ad\u653e\u5668\u548c\u5531\u7247\u52a8\u6548"} actions={[{ label: "\u9009\u62e9\u5c01\u9762\u56fe", onClick: importCoverImage }]} />
      </div>
      <section className="resource-section">
        <div className="section-title-row"><h3>{"\u5df2\u5bfc\u5165\u8d44\u6e90"}</h3><label>{"\u663e\u793a:"}<select><option>{"\u5168\u90e8"}</option></select></label></div>
        <div className="glass-panel resource-table">
          <div className="resource-head"><span>{"\u6b4c\u66f2\u540d\u79f0"}</span><span>{"\u683c\u5f0f"}</span><span>{"\u6b4c\u8bcd\u72b6\u6001"}</span><span>{"\u80cc\u666f\u72b6\u6001"}</span><span>{"\u5c01\u9762"}</span><span>{"\u64cd\u4f5c"}</span></div>
          {!localTracks.length && <div className="empty-state">{"\u8fd8\u6ca1\u6709\u5bfc\u5165\u8d44\u6e90\u3002"}</div>}
          {localTracks.map((track) => (
            <div className="resource-row" key={track.id}>
              <span className="resource-title"><span className="note-square"><Icon>music_note</Icon></span><span><b>{track.title}</b><small>{track.artist}</small></span></span>
              <span>{track.format}</span>
              <span className={`lyric-status ${track.lyrics?.status === "matched" ? "ok-text" : ""}`}>{lyricStatusLabel(track.lyrics?.status)}{track.lyrics?.error && <small>{track.lyrics.error}</small>}</span>
              <span className={track.lyricStyle.backgroundImage ? "ok-text" : ""}>{track.lyricStyle.backgroundImage ? <Icon>check_circle</Icon> : "\u672a\u8bbe\u7f6e"}</span>
              <span><TrackCover track={track} active={false} playing={false} /></span>
              <span className="resource-actions">
                <button type="button" onClick={() => retryLyricsForTrack(track.id)}>{track.lyrics?.status === "matched" ? "\u91cd\u65b0\u5339\u914d" : "\u5339\u914d\u6b4c\u8bcd"}</button>
                <button type="button" onClick={() => openManualLyrics(track)}>{"\u624b\u52a8\u4fee\u6b63"}</button>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ImportCard({ icon, title, description, body, actions }: { icon: string; title: string; description: string; body: string; actions: Array<{ label: string; onClick: () => void }> }) {
  return <div className="glass-card import-card"><div className="card-title"><Icon>{icon}</Icon><h2>{title}</h2></div><p>{description}</p><div className="drop-zone"><Icon>{icon === "library_add" ? "library_music" : icon === "lyrics" ? "subtitles" : "add_photo_alternate"}</Icon><span>{body}</span><div className="card-actions">{actions.map((action) => <button key={action.label} type="button" onClick={action.onClick}>{action.label}</button>)}</div></div></div>;
}
