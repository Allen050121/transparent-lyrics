import { Icon } from "./Icon";
import type { View } from "../types";

export function WindowChrome() {
  return (
    <>
      <div className="window-drag-region" />
      <div className="window-controls">
        <button type="button" aria-label={"\u6700\u5c0f\u5316"} onClick={() => window.transparentLyrics?.minimizeWindow?.()}>
          <Icon>remove</Icon>
        </button>
        <button type="button" aria-label={"\u6700\u5927\u5316"} onClick={() => window.transparentLyrics?.toggleMaximizeWindow?.()}>
          <Icon>crop_square</Icon>
        </button>
        <button type="button" aria-label={"\u5173\u95ed"} onClick={() => window.transparentLyrics?.closeWindow?.()}>
          <Icon>close</Icon>
        </button>
      </div>
    </>
  );
}

export function SideNav({
  currentView,
  selectedPlaylist,
  navigate,
  navigatePlaylist,
}: {
  currentView: View;
  selectedPlaylist: string;
  navigate: (view: View) => void;
  navigatePlaylist: (playlistName: string) => void;
}) {
  const menu = [
    { icon: "library_music", label: "\u97f3\u4e50\u5e93", view: "main" as const },
    { icon: "history", label: "\u6700\u8fd1\u64ad\u653e", view: "recent" as const },
    { icon: "upload_file", label: "\u5bfc\u5165\u8d44\u6e90", view: "import" as const },
  ];
  const playlists = [
    { icon: "playlist_play", label: "\u6df1\u591c\u6c89\u6d78" },
    { icon: "water_drop", label: "\u96e8\u5929\u6f2b\u6b65" },
    { icon: "playlist_play", label: "\u5de5\u4f5c\u7535\u53f0" },
  ];
  return (
    <aside className="side-nav">
      <div className="brand-mark"><span>TL</span><b>Transparent Lyrics</b></div>
      <nav>
        {menu.map((item) => <button className={currentView === item.view ? "active" : ""} key={item.label} type="button" onClick={() => navigate(item.view)}><Icon>{item.icon}</Icon>{item.label}</button>)}
      </nav>
      <div className="playlist-block"><p>{"\u6b4c\u5355"}</p>{playlists.map((item) => <button className={currentView === "playlist" && selectedPlaylist === item.label ? "active" : ""} key={item.label} type="button" onClick={() => navigatePlaylist(item.label)}><Icon>{item.icon}</Icon>{item.label}</button>)}</div>
      <button className="new-playlist" type="button"><Icon>add</Icon>{"\u65b0\u5efa\u6b4c\u5355"}</button>
      <div className="side-footer">
        <button type="button" className={currentView === "settings" ? "active" : ""} onClick={() => navigate("settings")}><Icon>settings</Icon>{"\u8bbe\u7f6e"}</button>
        <button type="button"><Icon>help</Icon>{"\u5e2e\u52a9"}</button>
      </div>
    </aside>
  );
}

export function TopBar({ view, selectedPlaylist, goBack, goForward }: { view: View; selectedPlaylist: string; goBack: () => void; goForward: () => void }) {
  const titles: Record<View, string> = {
    main: "\u97f3\u4e50",
    recent: "\u6700\u8fd1\u64ad\u653e",
    import: "\u5bfc\u5165\u8d44\u6e90",
    playlist: selectedPlaylist,
    lyrics: "\u6b4c\u8bcd\u9875",
    settings: "\u8bbe\u7f6e",
    mini: "\u64ad\u653e\u5217\u8868",
  };
  return (
    <header className="top-bar">
      <div className="history-buttons"><button type="button" onClick={goBack}><Icon>chevron_left</Icon></button><button type="button" onClick={goForward}><Icon>chevron_right</Icon></button></div>
      <h1>{titles[view]}</h1>
      <div className="top-actions">
        <button type="button" aria-label={"\u641c\u7d22"}><Icon>search</Icon></button>
        <button type="button" aria-label={"\u8d26\u6237"}><Icon>account_circle</Icon></button>
        <button type="button" aria-label={"\u901a\u77e5"}><Icon>notifications</Icon></button>
      </div>
    </header>
  );
}
