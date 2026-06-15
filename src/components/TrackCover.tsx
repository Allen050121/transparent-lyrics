import { getCover } from "../media";
import type { Track } from "../types";
import { Icon } from "./Icon";

export function TrackCover({ track, active, playing }: { track: Track; active: boolean; playing: boolean }) {
  const hasImage = Boolean(track.lyricStyle.backgroundImage || track.id !== "placeholder");
  return <div className="cover-box">{hasImage ? <img alt="Album" src={getCover(track)} /> : <Icon>music_note</Icon>}<span className="cover-badge"><Icon>{active && playing ? "pause" : "play_arrow"}</Icon></span></div>;
}
