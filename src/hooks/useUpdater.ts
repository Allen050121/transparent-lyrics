import { useCallback, useEffect, useState } from "react";

export function useUpdater() {
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus>({ status: "idle", currentVersion: "0.1.0" });

  useEffect(() => {
    let mounted = true;
    window.transparentLyrics?.getAppVersion?.()
      .then((version) => {
        if (mounted && version) setUpdaterStatus({ status: "idle", currentVersion: version });
      })
      .catch((error) => console.warn("[Transparent Lyrics] Failed to read app version", error));

    const unsubscribe = window.transparentLyrics?.onUpdaterStatus?.((status) => {
      if (!mounted) return;
      if (status.status === "error") {
        console.warn("[Transparent Lyrics] Update check failed", status.error);
      }
      setUpdaterStatus(status);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    const currentVersion = updaterStatus.currentVersion;
    setUpdaterStatus({ status: "checking", currentVersion });
    try {
      const status = await window.transparentLyrics?.checkForUpdates?.();
      if (status) setUpdaterStatus(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[Transparent Lyrics] Update check failed", error);
      setUpdaterStatus({ status: "error", currentVersion, error: message });
    }
  }, [updaterStatus.currentVersion]);

  const downloadUpdate = useCallback(async () => {
    try {
      await window.transparentLyrics?.downloadUpdate?.();
    } catch (error) {
      console.warn("[Transparent Lyrics] Update download failed", error);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    try {
      await window.transparentLyrics?.installUpdate?.();
    } catch (error) {
      console.warn("[Transparent Lyrics] Update install failed", error);
    }
  }, []);

  return { updaterStatus, checkForUpdates, downloadUpdate, installUpdate };
}
