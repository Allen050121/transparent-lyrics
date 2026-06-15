import { useState } from "react";
import { Icon } from "./Icon";

type UpdateBannerStatus = Extract<UpdaterStatus, { status: "available" | "downloading" | "downloaded" }>;

export function UpdateBanner({ status, downloadUpdate, installUpdate }: { status: UpdaterStatus; downloadUpdate: () => void; installUpdate: () => void }) {
  const [showNotes, setShowNotes] = useState(false);
  if (status.status !== "available" && status.status !== "downloading" && status.status !== "downloaded") return null;
  const visibleStatus: UpdateBannerStatus = status;
  const version = "version" in visibleStatus && visibleStatus.version ? visibleStatus.version : "";
  const releaseNotes = visibleStatus.status === "available" ? visibleStatus.releaseNotes : undefined;
  const title =
    visibleStatus.status === "downloaded"
      ? "\u65b0\u7248\u672c\u5df2\u51c6\u5907\u597d"
      : visibleStatus.status === "downloading"
        ? "\u6b63\u5728\u4e0b\u8f7d\u66f4\u65b0"
        : `\u53d1\u73b0\u65b0\u7248\u672c v${version}`;
  const detail =
    visibleStatus.status === "downloading"
      ? `${Math.round(visibleStatus.progress)}%`
      : visibleStatus.status === "downloaded"
        ? `v${version} \u53ef\u4ee5\u91cd\u542f\u5b89\u88c5`
        : `\u5f53\u524d\u7248\u672c v${visibleStatus.currentVersion}`;

  return (
    <div className="update-banner">
      <div className="update-banner-main">
        <Icon>{visibleStatus.status === "downloaded" ? "download_done" : "system_update_alt"}</Icon>
        <div><strong>{title}</strong><span>{detail}</span></div>
      </div>
      <div className="update-actions">
        {releaseNotes && <button type="button" onClick={() => setShowNotes((current) => !current)}>{showNotes ? "\u6536\u8d77\u5185\u5bb9" : "\u67e5\u770b\u66f4\u65b0\u5185\u5bb9"}</button>}
        {visibleStatus.status === "available" && <button type="button" onClick={downloadUpdate}>{"\u4e0b\u8f7d\u66f4\u65b0"}</button>}
        {visibleStatus.status === "downloaded" && <button type="button" onClick={installUpdate}>{"\u91cd\u542f\u5e76\u5b89\u88c5"}</button>}
      </div>
      {visibleStatus.status === "downloading" && <div className="update-progress" aria-label={"\u66f4\u65b0\u4e0b\u8f7d\u8fdb\u5ea6"}><span style={{ width: `${Math.round(visibleStatus.progress)}%` }} /></div>}
      {showNotes && releaseNotes && <pre className="update-notes">{releaseNotes}</pre>}
    </div>
  );
}

function formatUpdateError(error: string) {
  if (/ERR_CONNECTION_CLOSED/i.test(error)) return "\u8fde\u63a5 GitHub \u5931\u8d25\uff0c\u53ef\u80fd\u662f\u7f51\u7edc\u6216\u4ee3\u7406\u4e0d\u7a33\u5b9a\u3002";
  if (/No published versions/i.test(error)) return "GitHub Release \u6682\u65f6\u6ca1\u6709\u53ef\u8bfb\u53d6\u7684\u7248\u672c\u4fe1\u606f\u3002";
  return error;
}

export function UpdateCheckCard({ status, checkForUpdates }: { status: UpdaterStatus; checkForUpdates: () => void }) {
  if (status.status === "available" || status.status === "downloading" || status.status === "downloaded") return null;
  const checking = status.status === "checking";
  const isError = status.status === "error";
  const title = isError ? "\u66f4\u65b0\u68c0\u67e5\u5931\u8d25" : status.status === "not-available" ? "\u5df2\u662f\u6700\u65b0\u6d4b\u8bd5\u7248" : "\u6d4b\u8bd5\u7248\u66f4\u65b0";
  const detail = isError
    ? formatUpdateError(status.error)
    : status.status === "checking"
      ? "\u6b63\u5728\u8fde\u63a5 GitHub Release..."
      : `\u5f53\u524d\u7248\u672c v${status.currentVersion}`;

  return (
    <div className={`update-check-card ${isError ? "error" : ""}`}>
      <div className="update-check-copy">
        <Icon>{isError ? "wifi_off" : checking ? "sync" : "new_releases"}</Icon>
        <div><strong>{title}</strong><span>{detail}</span></div>
      </div>
      <button type="button" onClick={checkForUpdates} disabled={checking}>{checking ? "\u68c0\u67e5\u4e2d" : isError ? "\u91cd\u65b0\u68c0\u67e5" : "\u68c0\u67e5\u66f4\u65b0"}</button>
    </div>
  );
}
