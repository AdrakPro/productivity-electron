const isElectron = () => {
  return typeof window !== "undefined" && window.api !== undefined;
};

const mockApi = {
  todos: {
    getAll: async () => [],
    getByDate: async () => [],
    getGlobal: async () => [],
    getArchived: async () => [],
    create: async (todo) => ({ id: Date.now(), ...todo, subtasks: [] }),
    update: async (id, updates) => ({ id, ...updates }),
    delete: async () => true,
    archive: async (id) => ({ id, is_archived: true }),
    archiveByDate: async () => 0,
  },
  subtasks: {
    create: async (todoId, title, deadline, tags) => ({
      id: Date.now(),
      todo_id: todoId,
      title,
      deadline: deadline || null,
      tags: tags || [],
      is_completed: false,
    }),
    update: async (id, updates) => ({ id, ...updates }),
    delete: async () => true,
    reorder: async () => [],
  },
  statistics: {
    get: async () => ({
      total_completed: 0,
      current_streak: 0,
      longest_streak: 0,
      total_reviews_completed: 0,
    }),
    update: async (data) => data,
  },
  streaks: {
    get: async () => [],
    getByDate: async () => null,
    recordCompletion: async () => ({}),
  },
  files: {
    getTree: async () => null,
    openFile: async () => true,
    selectDirectory: async () => null,
    getWorkingDirectory: async () => null,
    setWorkingDirectory: async () => true,
  },
  app: {
    getAutoLaunch: async () => false,
    setAutoLaunch: async () => true,
    getVersion: async () => "1.0.0",
  },
  reviews: {
    getByTodoId: async () => [],
    getByDate: async () => [],
    getDueToday: async () => [],
    getAllPending: async () => [],
    complete: async (id) => ({ completed: { id }, nextReview: null }),
    getAll: async () => [],
    create: async (todoId, reviewNumber, reviewDate, priority) => ({
      id: Date.now(),
      todo_id: todoId,
      review_number: reviewNumber,
      review_date: reviewDate,
      priority: priority || "none",
      is_completed: false,
    }),
    updatePriority: async (id, priority) => ({ id, priority }),
  },
  templates: {
    getAll: async () => [],
    getById: async (id) => ({ id }),
    create: async (template) => ({ id: Date.now(), ...template }),
    update: async (id, template) => ({ id, ...template }),
    delete: async () => true,
  },
  sync: {
    getConfig: async () => ({
      enabled: true,
      intervalMinutes: 5,
      backupFolderPath: "/tmp/todo-productivity-backups",
      keepBackups: 5,
    }),
    setConfig: async (config) => ({
      enabled: true,
      intervalMinutes: 5,
      backupFolderPath:
        config.localBackupFolderPath || "/tmp/todo-productivity-backups",
      keepBackups: Number(config.localBackupKeepCount || 5),
    }),
    getStatus: async () => ({
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
      syncing: false,
      lastSyncAt: null,
    }),
    now: async () => ({ ok: true }),
  },
};

export const api = isElectron() ? window.api : mockApi;

// Todo API
export const todosApi = {
  async getAll() {
    return api.todos.getAll();
  },
  async getByDate(date) {
    return api.todos.getByDate(date);
  },
  async getGlobal() {
    return api.todos.getGlobal();
  },
  async getArchived() {
    return api.todos.getArchived();
  },
  async create(todo) {
    return api.todos.create(todo);
  },
  async update(id, updates) {
    return api.todos.update(id, updates);
  },
  async delete(id) {
    return api.todos.delete(id);
  },
  async archive(id) {
    return api.todos.archive(id);
  },
  async archiveByDate(date) {
    return api.todos.archiveByDate(date);
  },
};

// Subtask API
export const subtasksApi = {
  async create(todoId, title, deadline, tags, is_review = false) {
    return api.subtasks.create(todoId, title, deadline, tags, is_review);
  },
  async update(id, updates) {
    return api.subtasks.update(id, updates);
  },
  async delete(id) {
    return api.subtasks.delete(id);
  },
  async reorder(todoId, subtaskIds) {
    return api.subtasks.reorder(todoId, subtaskIds);
  },
};

// Statistics API
export const statisticsApi = {
  async get() {
    return api.statistics.get();
  },
  async update(data) {
    return api.statistics.update(data);
  },
};

// Streaks API
export const streaksApi = {
  async get() {
    return api.streaks.get();
  },
  async getByDate(date) {
    return api.streaks.getByDate(date);
  },
  async recordCompletion(date) {
    return api.streaks.recordCompletion(date);
  },
};

// Files API
export const filesApi = {
  async getTree(rootPath) {
    return api.files.getTree(rootPath);
  },
  async openFile(filePath) {
    return api.files.openFile(filePath);
  },
  async openInFileManager(folderPath) {
    return api.files.openInFileManager(folderPath);
  },
  async showInFileManager(itemPath) {
    return api.files.showInFileManager(itemPath);
  },
  async selectDirectory() {
    return api.files.selectDirectory();
  },
  async getWorkingDirectory() {
    return api.files.getWorkingDirectory();
  },
  async setWorkingDirectory(dirPath) {
    return api.files.setWorkingDirectory(dirPath);
  },
  async createFile(parentPath, fileName) {
    return api.files.createFile(parentPath, fileName);
  },
  async createFolder(parentPath, folderName) {
    return api.files.createFolder(parentPath, folderName);
  },
  async rename(oldPath, newName) {
    return api.files.rename(oldPath, newName);
  },
  async deleteItem(itemPath) {
    return api.files.deleteItem(itemPath);
  },
  async moveItem(sourcePath, targetFolder) {
    return api.files.moveItem(sourcePath, targetFolder);
  },
  async copyItem(sourcePath, targetFolder) {
    return api.files.copyItem(sourcePath, targetFolder);
  },
};

// App API
export const appApi = {
  async getAutoLaunch() {
    return api.app.getAutoLaunch();
  },
  async setAutoLaunch(enabled) {
    return api.app.setAutoLaunch(enabled);
  },
  async getVersion() {
    return api.app.getVersion();
  },
  async minimize() {
    return api.app.minimize();
  },
  async quit() {
    return api.app.quit();
  },
  async clearAllData() {
    return api.app.clearAllData();
  },
  async getPaths() {
    return api.app.getPaths();
  },
};

// Reviews API
export const reviewsApi = {
  async getByTodoId(todoId) {
    return api.reviews.getByTodoId(todoId);
  },
  async getByDate(date) {
    return api.reviews.getByDate(date);
  },
  async getDueToday() {
    return api.reviews.getDueToday();
  },
  async getAllPending() {
    return api.reviews.getAllPending();
  },
  async complete(id) {
    return api.reviews.complete(id);
  },
  async getAll() {
    return api.reviews.getAll();
  },
  async create(
    todoId,
    subtaskId,
    subtaskTitle,
    reviewNumber,
    reviewDate,
    priority,
  ) {
    return api.reviews.create(
      todoId,
      subtaskId,
      subtaskTitle,
      reviewNumber,
      reviewDate,
      priority,
    );
  },
  async deleteBySubtaskId(subtaskId) {
    return api.reviews.deleteBySubtaskId(subtaskId);
  },
  async updatePriority(id, priority) {
    return api.reviews.updatePriority(id, priority);
  },
};

export const templatesApi = {
  async getAll() {
    return api.templates.getAll();
  },
  async getById(id) {
    return api.templates.getById(id);
  },
  async create(template) {
    return api.templates.create(template);
  },
  async update(id, template) {
    return api.templates.update(id, template);
  },
  async delete(id) {
    return api.templates.delete(id);
  },
};

export const syncApi = {
  async getConfig() {
    return api.sync.getConfig();
  },
  async setConfig(config) {
    return api.sync.setConfig(config);
  },
  async getStatus() {
    return api.sync.getStatus();
  },
  async now(opts = {}) {
    return api.sync.now(opts);
  },
};
