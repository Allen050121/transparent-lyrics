import type { Track } from "../types";

export function MiniPage({ activeTrack }: { activeTrack: Track }) {
  return <div className="page-inner mini-queue"><div className="empty-state">{"\u64ad\u653e\u5217\u8868\u9884\u89c8\uff1a"}{activeTrack.title}</div></div>;
}
