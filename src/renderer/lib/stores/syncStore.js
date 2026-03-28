import { writable } from "svelte/store";
import { syncApi } from "$lib/services/api.js";
import { success, error as toastError } from "$lib/stores/toastStore.js";

export const syncConfig = writable({
  enabled: true,
  intervalMinutes: 5,
  backupFolderPath: "",
  keepBackups: 5,
});

export const syncOnline = writable(true);
export const syncInProgress = writable(false);
export const syncError = writable(null);
export const syncLastSyncAt = writable(null);

let statusPollTimer = null;

export async function loadSyncConfig() {
  try {
    const cfg = await syncApi.getConfig();
    syncConfig.set({
      enabled: !!cfg.enabled,
      intervalMinutes: Number(cfg.intervalMinutes || 5),
      backupFolderPath: cfg.backupFolderPath || "",
      keepBackups: Number(cfg.keepBackups || 5),
    });
  } catch (e) {
    syncError.set(e.message || "Failed to load sync configuration");
  }
}

export async function saveSyncConfig(partial) {
  syncError.set(null);

  const payload = {
    localBackupFolderPath: partial.backupFolderPath?.trim() || "",
    localBackupKeepCount: Number(partial.keepBackups || 5),
  };

  const cfg = await syncApi.setConfig(payload);

  syncConfig.set({
    enabled: !!cfg.enabled,
    intervalMinutes: Number(cfg.intervalMinutes || 5),
    backupFolderPath: cfg.backupFolderPath || "",
    keepBackups: Number(cfg.keepBackups || 5),
  });

  success("Backup settings saved");
}

export async function refreshSyncStatus(silent = true) {
  try {
    const st = await syncApi.getStatus();
    syncOnline.set(!!st.online);
    syncInProgress.set(!!st.syncing);
    syncLastSyncAt.set(st.lastSyncAt || null);
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
      success("Backup saved");
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
