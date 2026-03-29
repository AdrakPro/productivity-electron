const { ipcMain } = require("electron");

function registerSyncHandlers(syncService) {
  ipcMain.handle("sync:getConfig", async () => syncService.getConfig());
  ipcMain.handle("sync:setConfig", async (_e, config) =>
    syncService.setConfig(config),
  );
  ipcMain.handle("sync:getStatus", async () => ({
    online: syncService.isOnline(),
    syncing: syncService.isSyncing,
    hasToken: !!syncService.getClient(),
    lastSyncAt: syncService.settingsRepo.get("dropboxLastSyncAt", null),
  }));
  ipcMain.handle("sync:now", async (_e, opts) =>
    syncService.syncNow(opts || {}),
  );

  ipcMain.handle("sync:connectDropbox", async () =>
    syncService.connectDropbox(),
  );
  ipcMain.handle("sync:disconnectDropbox", async () =>
    syncService.disconnectDropbox(),
  );

  ipcMain.handle("sync:revertToBackup", async () =>
    syncService.revertToBackup(),
  );
}

module.exports = { registerSyncHandlers };
