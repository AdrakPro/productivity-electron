const { app } = require("electron");
const fs = require("fs");
const path = require("path");

class SyncService {
  constructor({ db, settingsRepo }) {
    this.db = db;
    this.settingsRepo = settingsRepo;
    this.intervalRef = null;
    this.isSyncing = false;
  }

  isOnline() {
    return true;
  }

  getDefaultBackupFolderPath() {
    return path.join(app.getPath("userData"), "backups");
  }

  getConfig() {
    const keepBackups = Number(this.settingsRepo.get("localBackupKeepCount", 5));

    return {
      enabled: true,
      intervalMinutes: 5,
      backupFolderPath:
        this.settingsRepo.get("localBackupFolderPath", "") ||
        this.getDefaultBackupFolderPath(),
      keepBackups:
        Number.isFinite(keepBackups) && keepBackups > 0 ? keepBackups : 5,
    };
  }

  setConfig(config = {}) {
    if (typeof config.localBackupFolderPath === "string") {
      this.settingsRepo.set(
        "localBackupFolderPath",
        config.localBackupFolderPath.trim() || this.getDefaultBackupFolderPath(),
      );
    }

    if (config.localBackupKeepCount !== undefined) {
      const keepBackups = Number(config.localBackupKeepCount);
      this.settingsRepo.set(
        "localBackupKeepCount",
        Number.isFinite(keepBackups) && keepBackups > 0 ? keepBackups : 5,
      );
    }

    return this.getConfig();
  }

  getWorkingDirectoryPath() {
    try {
      return this.settingsRepo.get("workingDirectory", null);
    } catch {
      return null;
    }
  }

  buildPayload() {
    return {
      meta: { version: 5, exportedAt: new Date().toISOString() },
      data: {
        todos: this.db.prepare("SELECT * FROM todos ORDER BY id ASC").all(),
        subtasks: this.db.prepare("SELECT * FROM subtasks ORDER BY id ASC").all(),
        reviews: this.db.prepare("SELECT * FROM reviews ORDER BY id ASC").all(),
        statistics: this.db.prepare("SELECT * FROM statistics WHERE id = 1").get(),
        streaks: this.db.prepare("SELECT * FROM streaks ORDER BY date DESC").all(),
        settings: this.db.prepare("SELECT * FROM settings").all(),
        notes: {
          workingDirectory: this.getWorkingDirectoryPath(),
        },
      },
    };
  }

  ensureBackupFolder() {
    const { backupFolderPath } = this.getConfig();
    fs.mkdirSync(backupFolderPath, { recursive: true });
    return backupFolderPath;
  }

  listBackupFiles() {
    const { backupFolderPath } = this.getConfig();
    if (!fs.existsSync(backupFolderPath)) return [];

    return fs
      .readdirSync(backupFolderPath)
      .filter((fileName) => fileName.toLowerCase().endsWith(".json"))
      .map((fileName) => {
        const filePath = path.join(backupFolderPath, fileName);
        const stat = fs.statSync(filePath);
        return {
          fileName,
          filePath,
          mtimeMs: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  }

  rotateBackups() {
    const { keepBackups } = this.getConfig();
    const backups = this.listBackupFiles();
    for (const oldBackup of backups.slice(keepBackups)) {
      fs.unlinkSync(oldBackup.filePath);
    }
  }

  exportBackup() {
    if (this.isSyncing) {
      return { ok: false, message: "Backup already in progress" };
    }

    this.isSyncing = true;
    try {
      const backupFolderPath = this.ensureBackupFolder();
      const fileStamp = new Date().toISOString().replace(/[.:]/g, "-");
      const backupFilePath = path.join(
        backupFolderPath,
        `todo-backup-${fileStamp}.json`,
      );

      const payload = this.buildPayload();
      fs.writeFileSync(backupFilePath, JSON.stringify(payload, null, 2), "utf-8");

      this.rotateBackups();
      this.settingsRepo.set("localBackupLastSyncAt", new Date().toISOString());

      return { ok: true, filePath: backupFilePath };
    } catch (error) {
      return { ok: false, message: error?.message || "Backup export failed" };
    } finally {
      this.isSyncing = false;
    }
  }

  importBackup(backupFilePath) {
    const raw = fs.readFileSync(backupFilePath, "utf-8");
    const snapshot = JSON.parse(raw);

    this.replaceLocalDbData(snapshot);

    const workingDirectory = snapshot?.data?.notes?.workingDirectory;
    if (workingDirectory) {
      this.settingsRepo.set("workingDirectory", workingDirectory);
    }

    this.settingsRepo.set("localBackupLastImportAt", new Date().toISOString());

    return { ok: true, filePath: backupFilePath };
  }

  importLatestBackup() {
    const backups = this.listBackupFiles();
    if (backups.length === 0) {
      return { ok: true, imported: false };
    }

    try {
      this.importBackup(backups[0].filePath);
      return { ok: true, imported: true, filePath: backups[0].filePath };
    } catch (error) {
      return { ok: false, message: error?.message || "Backup import failed" };
    }
  }

  replaceLocalDbData(snapshot) {
    if (!snapshot?.data) return;
    const d = snapshot.data;

    const tx = this.db.transaction(() => {
      this.db.exec(
        "DELETE FROM reviews; DELETE FROM subtasks; DELETE FROM todos; DELETE FROM streaks;",
      );

      for (const t of d.todos || []) {
        this.db
          .prepare(
            `INSERT INTO todos (id,title,description,due_date,is_global,is_completed,is_archived,completed_at,created_at,updated_at,priority,labels)
             VALUES (@id,@title,@description,@due_date,@is_global,@is_completed,@is_archived,@completed_at,@created_at,@updated_at,@priority,@labels)`,
          )
          .run(t);
      }

      for (const s of d.subtasks || []) {
        this.db
          .prepare(
            `INSERT INTO subtasks (id,todo_id,title,is_review,is_completed,sort_order,completed_at,created_at,deadline,tags)
             VALUES (@id,@todo_id,@title,@is_review,@is_completed,@sort_order,@completed_at,@created_at,@deadline,@tags)`,
          )
          .run(s);
      }

      for (const r of d.reviews || []) {
        this.db
          .prepare(
            `INSERT INTO reviews (id,todo_id,subtask_id,subtask_title,round,review_date,priority,is_completed,completed_at,created_at,updated_at,review_number)
             VALUES (@id,@todo_id,@subtask_id,@subtask_title,@round,@review_date,@priority,@is_completed,@completed_at,@created_at,@updated_at,@review_number)`,
          )
          .run(r);
      }

      if (d.statistics) {
        this.db
          .prepare(
            `UPDATE statistics
             SET total_completed=@total_completed,current_streak=@current_streak,longest_streak=@longest_streak,last_activity_date=@last_activity_date,total_reviews_completed=@total_reviews_completed
             WHERE id=1`,
          )
          .run({
            total_completed: d.statistics.total_completed || 0,
            current_streak: d.statistics.current_streak || 0,
            longest_streak: d.statistics.longest_streak || 0,
            last_activity_date: d.statistics.last_activity_date || null,
            total_reviews_completed: d.statistics.total_reviews_completed || 0,
          });
      }

      for (const s of d.streaks || []) {
        this.db
          .prepare(
            `INSERT INTO streaks (id,date,completed_count,created_at)
             VALUES (@id,@date,@completed_count,@created_at)`,
          )
          .run(s);
      }
    });

    tx();
  }

  async syncNow() {
    return this.exportBackup();
  }

  startInterval() {
    this.stopInterval();

    const ms = 5 * 60 * 1000;
    this.intervalRef = setInterval(() => {
      this.exportBackup();
    }, ms);
  }

  stopInterval() {
    if (this.intervalRef) clearInterval(this.intervalRef);
    this.intervalRef = null;
  }

  restartInterval() {
    this.startInterval();
  }
}

module.exports = { SyncService };
