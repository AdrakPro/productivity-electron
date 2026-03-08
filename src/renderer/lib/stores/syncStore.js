import { writable } from "svelte/store";
import { syncApi } from "$lib/services/api.js";
import { success, error as toastError, info } from "$lib/stores/toastStore.js";

export const syncConfig = writable({
  enabled: false,
  accessToken: "",
  intervalMinutes: 15,
  remotePath: "/todo-productivity-sync.json",
  remoteNotesRoot: "/todo-productivity-notes",
});

export const syncOnline = writable(true);
export const syncInProgress = writable(false);
export const syncHasToken = writable(false);
export const syncError = writable(null);

let statusPollTimer = null;

export async function loadSyncConfig() {
  try {
    const cfg = await syncApi.getConfig();
    syncConfig.set({
      enabled: !!cfg.enabled,
      accessToken: cfg.accessToken || "",
      intervalMinutes: Number(cfg.intervalMinutes || 15),
      remotePath: cfg.remotePath || "/todo-productivity-sync.json",
      remoteNotesRoot: cfg.remoteNotesRoot || "/todo-productivity-notes",
    });
  } catch (e) {
    syncError.set(e.message || "Failed to load sync configuration");
  }
}

export async function saveSyncConfig(partial) {
  syncError.set(null);

  const payload = {
    dropboxSyncEnabled: !!partial.enabled,
    dropboxAccessToken: partial.accessToken || "",
    dropboxSyncIntervalMinutes: Number(partial.intervalMinutes || 15),
    dropboxSyncRemotePath:
      partial.remotePath?.trim() || "/todo-productivity-sync.json",
    dropboxNotesRootPath:
      partial.remoteNotesRoot?.trim() || "/todo-productivity-notes",
  };

  const cfg = await syncApi.setConfig(payload);

  syncConfig.set({
    enabled: !!cfg.enabled,
    accessToken: cfg.accessToken || "",
    intervalMinutes: Number(cfg.intervalMinutes || 15),
    remotePath: cfg.remotePath || "/todo-productivity-sync.json",
    remoteNotesRoot: cfg.remoteNotesRoot || "/todo-productivity-notes",
  });

  success("Sync settings saved");
}

export async function refreshSyncStatus(silent = true) {
  try {
    const st = await syncApi.getStatus();
    syncOnline.set(!!st.online);
    syncInProgress.set(!!st.syncing);
    syncHasToken.set(!!st.hasToken);

    if (!silent && !st.hasToken) {
      info("Dropbox token is missing");
    }
  } catch (e) {
    if (!silent) {
      toastError(e.message || "Failed to refresh sync status");
    }
  }
}

export async function synchronizeNow(opts = {}) {
  syncError.set(null);
  syncInProgress.set(true);

  try {
    const res = await syncApi.now(opts);
    if (res?.ok) {
      success("Synchronized with Dropbox");
    } else {
      const msg = res?.message || "Sync did not complete";
      syncError.set(msg);
      toastError(msg);
    }
    return res;
  } catch (e) {
    const msg = e.message || "Synchronization failed";
    syncError.set(msg);
    toastError(msg);
    throw e;
  } finally {
    syncInProgress.set(false);
    await refreshSyncStatus(true);
  }
}

export function startSyncStatusPolling() {
  stopSyncStatusPolling();
  refreshSyncStatus(true);
  statusPollTimer = setInterval(() => {
    refreshSyncStatus(true);
  }, 10000);

  window.addEventListener("online", handleNetworkChange);
  window.addEventListener("offline", handleNetworkChange);
}

export function stopSyncStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
  window.removeEventListener("online", handleNetworkChange);
  window.removeEventListener("offline", handleNetworkChange);
}

function handleNetworkChange() {
  refreshSyncStatus(true);
}
