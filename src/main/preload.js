const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  todos: {
    getAll: () => ipcRenderer.invoke("todos:getAll"),
    getByDate: (date) => ipcRenderer.invoke("todos:getByDate", date),
    getGlobal: () => ipcRenderer.invoke("todos:getGlobal"),
    getArchived: () => ipcRenderer.invoke("todos:getArchived"),
    create: (todo) => ipcRenderer.invoke("todos:create", todo),
    update: (id, updates) => ipcRenderer.invoke("todos:update", id, updates),
    delete: (id) => ipcRenderer.invoke("todos:delete", id),
    archive: (id) => ipcRenderer.invoke("todos:archive", id),
    archiveByDate: (date) => ipcRenderer.invoke("todos:archiveByDate", date),
  },

  subtasks: {
    create: (todoId, title, deadline, tags) =>
      ipcRenderer.invoke("subtasks:create", todoId, title, deadline, tags),
    update: (id, updates) => ipcRenderer.invoke("subtasks:update", id, updates),
    delete: (id) => ipcRenderer.invoke("subtasks:delete", id),
    reorder: (todoId, subtaskIds) =>
      ipcRenderer.invoke("subtasks:reorder", todoId, subtaskIds),
  },

  statistics: {
    get: () => ipcRenderer.invoke("statistics:get"),
    update: (data) => ipcRenderer.invoke("statistics:update", data),
  },

  streaks: {
    get: () => ipcRenderer.invoke("streaks:get"),
    getByDate: (date) => ipcRenderer.invoke("streaks:getByDate", date),
    recordCompletion: (date) =>
      ipcRenderer.invoke("streaks:recordCompletion", date),
  },

  files: {
    getTree: (rootPath) => ipcRenderer.invoke("files:getTree", rootPath),
    openFile: (filePath) => ipcRenderer.invoke("files:openFile", filePath),
    openInFileManager: (folderPath) =>
      ipcRenderer.invoke("files:openInFileManager", folderPath),
    showInFileManager: (itemPath) =>
      ipcRenderer.invoke("files:showInFileManager", itemPath),
    selectDirectory: () => ipcRenderer.invoke("files:selectDirectory"),
    getWorkingDirectory: () => ipcRenderer.invoke("files:getWorkingDirectory"),
    setWorkingDirectory: (dirPath) =>
      ipcRenderer.invoke("files:setWorkingDirectory", dirPath),
    createFile: (parentPath, fileName) =>
      ipcRenderer.invoke("files:createFile", parentPath, fileName),
    createFolder: (parentPath, folderName) =>
      ipcRenderer.invoke("files:createFolder", parentPath, folderName),
    rename: (oldPath, newName) =>
      ipcRenderer.invoke("files:rename", oldPath, newName),
    deleteItem: (itemPath) => ipcRenderer.invoke("files:deleteItem", itemPath),
    moveItem: (sourcePath, targetFolder) =>
      ipcRenderer.invoke("files:moveItem", sourcePath, targetFolder),
    copyItem: (sourcePath, targetFolder) =>
      ipcRenderer.invoke("files:copyItem", sourcePath, targetFolder),
  },

  app: {
    getAutoLaunch: () => ipcRenderer.invoke("app:getAutoLaunch"),
    setAutoLaunch: (enabled) =>
      ipcRenderer.invoke("app:setAutoLaunch", enabled),
    getVersion: () => ipcRenderer.invoke("app:getVersion"),
    minimize: () => ipcRenderer.invoke("app:minimize"),
    quit: () => ipcRenderer.invoke("app:quit"),
    clearAllData: () => ipcRenderer.invoke("app:clearAllData"),
    getPaths: () => ipcRenderer.invoke("app:getPaths"),
  },

  reviews: {
    getByTodoId: (todoId) =>
      ipcRenderer.invoke("reviews:getByTodoId", todoId),
    getByDate: (date) => ipcRenderer.invoke("reviews:getByDate", date),
    getDueToday: () => ipcRenderer.invoke("reviews:getDueToday"),
    getAllPending: () => ipcRenderer.invoke("reviews:getAllPending"),
    complete: (id) => ipcRenderer.invoke("reviews:complete", id),
    getAll: () => ipcRenderer.invoke("reviews:getAll"),
    create: (todoId, reviewNumber, reviewDate, priority) =>
      ipcRenderer.invoke("reviews:create", todoId, reviewNumber, reviewDate, priority),
    updatePriority: (id, priority) =>
      ipcRenderer.invoke("reviews:updatePriority", id, priority),
  },

  onNavigate: (callback) => {
    ipcRenderer.on("navigate", (event, page, viewMode) => {
      callback(page, viewMode);
    });
  },

  removeNavigateListener: () => {
    ipcRenderer.removeAllListeners("navigate");
  },
});
