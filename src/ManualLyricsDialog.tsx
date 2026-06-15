import React from "react";
import type { LyricsCandidate, ManualLyricsState } from "./lyrics";

type ManualLyricsDialogProps = {
  state: ManualLyricsState;
  setState: React.Dispatch<React.SetStateAction<ManualLyricsState>>;
  onClose: () => void;
  onSearch: () => void;
  onSaveCandidate: (candidate: LyricsCandidate) => void;
  onSavePasted: () => void;
  formatDuration: (seconds: number) => string;
  Icon: ({ children, className }: { children: string; className?: string }) => React.ReactElement;
};

function candidatePreview(candidate: LyricsCandidate) {
  const text = candidate.syncedLyrics || candidate.plainLyrics || "";
  return text.split(/\r?\n/).map((line) => line.replace(/\[[^\]]+\]/g, "").trim()).filter(Boolean).slice(0, 2).join(" / ");
}

export function ManualLyricsDialog({
  state,
  setState,
  onClose,
  onSearch,
  onSaveCandidate,
  onSavePasted,
  formatDuration,
  Icon,
}: ManualLyricsDialogProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="manual-lyrics-dialog">
        <header>
          <div><strong>{"\u624b\u52a8\u4fee\u6b63\u6b4c\u8bcd"}</strong><span>{"\u6539\u5173\u952e\u8bcd\u641c\u7d22\uff0c\u6216\u76f4\u63a5\u7c98\u8d34 LRC / \u666e\u901a\u6b4c\u8bcd"}</span></div>
          <button type="button" onClick={onClose} aria-label={"\u5173\u95ed"}><Icon>close</Icon></button>
        </header>
        <div className="manual-search-grid">
          <label><span>{"\u6b4c\u540d"}</span><input value={state.title} onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))} /></label>
          <label><span>{"\u6b4c\u624b"}</span><input value={state.artist} onChange={(event) => setState((current) => ({ ...current, artist: event.target.value }))} /></label>
          <label><span>{"\u4e13\u8f91"}</span><input value={state.album} onChange={(event) => setState((current) => ({ ...current, album: event.target.value }))} /></label>
          <button type="button" onClick={onSearch} disabled={state.searching}>{state.searching ? "\u641c\u7d22\u4e2d" : "\u641c\u7d22\u5019\u9009"}</button>
        </div>
        {state.error && <div className="manual-error">{state.error}</div>}
        <div className="manual-candidates">
          {state.candidates.map((candidate, index) => (
            <button type="button" key={`${candidate.id ?? index}-${candidate.trackName ?? ""}`} onClick={() => onSaveCandidate(candidate)}>
              <strong>{candidate.trackName || state.title}</strong>
              <span>{[candidate.artistName, candidate.albumName, candidate.duration ? formatDuration(candidate.duration) : ""].filter(Boolean).join(" · ")}</span>
              <small>{candidatePreview(candidate) || "\u70b9\u51fb\u4f7f\u7528\u8fd9\u4efd\u6b4c\u8bcd"}</small>
            </button>
          ))}
        </div>
        <label className="manual-paste">
          <span>{"\u7c98\u8d34\u6b4c\u8bcd"}</span>
          <textarea value={state.pasteText} onChange={(event) => setState((current) => ({ ...current, pasteText: event.target.value }))} placeholder={"[00:12.00] \u7b2c\u4e00\u53e5\u6b4c\u8bcd"} />
        </label>
        <footer>
          <button type="button" onClick={onClose}>{"\u53d6\u6d88"}</button>
          <button type="button" className="primary-pill" onClick={onSavePasted}>{"\u4fdd\u5b58\u7c98\u8d34\u6b4c\u8bcd"}</button>
        </footer>
      </section>
    </div>
  );
}
