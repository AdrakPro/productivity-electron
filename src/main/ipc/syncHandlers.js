const { ipcMain } = require("electron");

function registerSyncHandlers(syncService) {
  ipcMain.handle("sync:getConfig", async () => syncService.getConfig());
  ipcMain.handle("sync:setConfig", async (_e, config) =>
    syncService.setConfig(config),
  );
  ipcMain.handle("sync:getStatus", async () => ({
    online: syncService.isOnline(),
    syncing: syncService.isSyncing,
    lastSyncAt: syncService.settingsRepo.get("localBackupLastSyncAt", null),
  }));
  ipcMain.handle("sync:now", async (_e, opts) =>
    syncService.syncNow(opts || {}),
  );
}

module.exports = { registerSyncHandlers };
