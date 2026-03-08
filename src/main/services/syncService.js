const { net } = require("electron");
const { Dropbox } = require("dropbox");
const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");

class SyncService {
  constructor({ db, settingsRepo }) {
    this.db = db;
    this.settingsRepo = settingsRepo;
    this.intervalRef = null;
    this.isSyncing = false;

    const token = process.env.DROPBOX_ACCESS_TOKEN;
    if (!token) {
      console.warn("DROPBOX_ACCESS_TOKEN is missing in .env");
      this.dbx = null;
    } else {
      this.dbx = new Dropbox({ accessToken: token, fetch });
    }
  }

  isOnline() {
    return net.isOnline();
  }

  getConfig() {
    return {
      enabled: !!this.settingsRepo.get("dropboxSyncEnabled", false),
      intervalMinutes: Number(
        this.settingsRepo.get("dropboxSyncIntervalMinutes", 15),
      ),
      remotePath: this.settingsRepo.get(
        "dropboxSyncRemotePath",
        "/todo-productivity-sync.json",
      ),
      remoteNotesRoot: this.settingsRepo.get(
        "dropboxNotesRootPath",
        "/todo-productivity-notes",
      ),
    };
  }

  setConfig(config = {}) {
    if (config.dropboxSyncEnabled !== undefined) {
      this.settingsRepo.set("dropboxSyncEnabled", !!config.dropboxSyncEnabled);
    }
    if (config.dropboxSyncIntervalMinutes !== undefined) {
      const n = Number(config.dropboxSyncIntervalMinutes);
      this.settingsRepo.set(
        "dropboxSyncIntervalMinutes",
        Number.isFinite(n) && n > 0 ? n : 15,
      );
    }
    if (config.dropboxSyncRemotePath !== undefined) {
      this.settingsRepo.set(
        "dropboxSyncRemotePath",
        config.dropboxSyncRemotePath || "/todo-productivity-sync.json",
      );
    }
    if (config.dropboxNotesRootPath !== undefined) {
      this.settingsRepo.set(
        "dropboxNotesRootPath",
        config.dropboxNotesRootPath || "/todo-productivity-notes",
      );
    }

    this.restartInterval();
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
      meta: { version: 3, exportedAt: new Date().toISOString() },
      data: {
        todos: this.db.prepare("SELECT * FROM todos ORDER BY id ASC").all(),
        subtasks: this.db
          .prepare("SELECT * FROM subtasks ORDER BY id ASC")
          .all(),
        reviews: this.db.prepare("SELECT * FROM reviews ORDER BY id ASC").all(),
        statistics: this.db
          .prepare("SELECT * FROM statistics WHERE id = 1")
          .get(),
        streaks: this.db
          .prepare("SELECT * FROM streaks ORDER BY date DESC")
          .all(),
        settings: this.db.prepare("SELECT * FROM settings").all(),
        notes: {
          workingDirectory: this.getWorkingDirectoryPath(),
        },
      },
    };
  }

  async downloadDbSnapshotFromDropbox() {
    const { remotePath } = this.getConfig();
    if (!this.dbx) throw new Error("Dropbox token is not configured");

    try {
      const res = await this.dbx.filesDownload({ path: remotePath });
      const fileBinary = res?.result?.fileBinary;
      if (!fileBinary) return null;
      const text = Buffer.from(fileBinary).toString("utf-8");
      return JSON.parse(text);
    } catch (e) {
      const summary = e?.error?.error_summary || "";
      if (e?.status === 409 && summary.includes("path/not_found")) return null;
      throw e;
    }
  }

  async uploadDbSnapshotToDropbox(payload) {
    const { remotePath } = this.getConfig();
    if (!this.dbx) throw new Error("Dropbox token is not configured");

    await this.dbx.filesUpload({
      path: remotePath,
      mode: { ".tag": "overwrite" },
      mute: true,
      contents: Buffer.from(JSON.stringify(payload, null, 2), "utf-8"),
    });
  }

  async ensureDropboxFolder(folderPath) {
    try {
      await this.dbx.filesCreateFolderV2({
        path: folderPath,
        autorename: false,
      });
    } catch (e) {
      const summary = e?.error?.error_summary || "";
      if (!summary.includes("path/conflict/folder")) throw e;
    }
  }

  walkLocalFiles(rootDir) {
    if (!rootDir || !fs.existsSync(rootDir)) return [];

    const out = [];
    const walk = (current) => {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const abs = path.join(current, entry.name);
        const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
        if (entry.isDirectory()) {
          walk(abs);
        } else if (entry.isFile()) {
          const stat = fs.statSync(abs);
          out.push({
            absPath: abs,
            relPath: rel,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
          });
        }
      }
    };
    walk(rootDir);
    return out;
  }

  async uploadNotesDirectoryToDropbox() {
    const workingDir = this.getWorkingDirectoryPath();
    if (!workingDir || !fs.existsSync(workingDir)) {
      return {
        uploaded: 0,
        skipped: 0,
        deleted: 0,
        deleteSkippedByGuard: true,
      };
    }

    const { remoteNotesRoot } = this.getConfig();
    await this.ensureDropboxFolder(remoteNotesRoot);

    const localFiles = this.walkLocalFiles(workingDir);
    let uploaded = 0;
    let skipped = 0;
    let deleted = 0;
    let deleteSkippedByGuard = false;

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

    // Build local relative path set (normalized lowercase for compare)
    const localRelSet = new Set(
      localFiles.map((f) => f.relPath.replace(/\\/g, "/").toLowerCase()),
    );

    // 1) Upload/overwrite all local files
    for (const f of localFiles) {
      if (f.size > MAX_FILE_SIZE) {
        skipped++;
        continue;
      }

      const remoteFilePath = `${remoteNotesRoot}/${f.relPath}`.replace(
        /\/+/g,
        "/",
      );
      const remoteDir = path.posix.dirname(remoteFilePath);

      if (remoteDir && remoteDir !== ".") {
        await this.ensureDropboxFolder(remoteDir);
      }

      const content = fs.readFileSync(f.absPath);
      await this.dbx.filesUpload({
        path: remoteFilePath,
        mode: { ".tag": "overwrite" },
        mute: true,
        contents: content,
      });

      uploaded++;
    }

    // 2) Delete remote files that no longer exist locally (guarded)
    if (this.isDangerousEmptyLocalState(localFiles)) {
      deleteSkippedByGuard = true;
      return { uploaded, skipped, deleted, deleteSkippedByGuard };
    }

    const remoteFiles = await this.listDropboxFilesRecursive(remoteNotesRoot);

    for (const rf of remoteFiles) {
      const remotePathLower = rf.path_lower || "";
      const rootLower = remoteNotesRoot.toLowerCase();
      const rel = remotePathLower.startsWith(rootLower)
        ? remotePathLower.slice(rootLower.length).replace(/^\/+/, "")
        : path.posix.basename(remotePathLower);

      if (!localRelSet.has(rel.toLowerCase())) {
        await this.dbx.filesDeleteV2({
          path: rf.path_lower || rf.path_display,
        });
        deleted++;
      }
    }

    return { uploaded, skipped, deleted, deleteSkippedByGuard };
  }

  async listDropboxFilesRecursive(rootPath) {
    const files = [];
    try {
      let res = await this.dbx.filesListFolder({
        path: rootPath,
        recursive: true,
      });

      files.push(
        ...(res?.result?.entries || []).filter((e) => e[".tag"] === "file"),
      );

      while (res?.result?.has_more) {
        res = await this.dbx.filesListFolderContinue({
          cursor: res.result.cursor,
        });
        files.push(
          ...(res?.result?.entries || []).filter((e) => e[".tag"] === "file"),
        );
      }
    } catch (e) {
      const summary = e?.error?.error_summary || "";
      if (e?.status === 409 && summary.includes("path/not_found")) return [];
      throw e;
    }

    return files;
  }

  async downloadNotesDirectoryFromDropbox(targetLocalDir) {
    if (!targetLocalDir) return { downloaded: 0 };
    fs.mkdirSync(targetLocalDir, { recursive: true });

    const { remoteNotesRoot } = this.getConfig();
    const remoteFiles = await this.listDropboxFilesRecursive(remoteNotesRoot);
    let downloaded = 0;

    for (const rf of remoteFiles) {
      const remotePathLower = rf.path_lower || "";
      const rootLower = remoteNotesRoot.toLowerCase();
      const rel = remotePathLower.startsWith(rootLower)
        ? remotePathLower.slice(rootLower.length).replace(/^\/+/, "")
        : path.posix.basename(remotePathLower);

      const localFilePath = path.join(targetLocalDir, rel);
      fs.mkdirSync(path.dirname(localFilePath), { recursive: true });

      const dl = await this.dbx.filesDownload({
        path: rf.path_lower || rf.path_display,
      });
      const fileBinary = dl?.result?.fileBinary;
      if (fileBinary) {
        fs.writeFileSync(localFilePath, Buffer.from(fileBinary));
        downloaded++;
      }
    }

    return { downloaded };
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
            `
          INSERT INTO todos (id,title,description,due_date,is_global,is_completed,is_archived,completed_at,created_at,updated_at,priority,labels)
          VALUES (@id,@title,@description,@due_date,@is_global,@is_completed,@is_archived,@completed_at,@created_at,@updated_at,@priority,@labels)
        `,
          )
          .run(t);
      }

      for (const s of d.subtasks || []) {
        this.db
          .prepare(
            `
          INSERT INTO subtasks (id,todo_id,title,is_review,is_completed,sort_order,completed_at,created_at,deadline,tags)
          VALUES (@id,@todo_id,@title,@is_review,@is_completed,@sort_order,@completed_at,@created_at,@deadline,@tags)
        `,
          )
          .run(s);
      }

      for (const r of d.reviews || []) {
        this.db
          .prepare(
            `
          INSERT INTO reviews (id,todo_id,subtask_id,subtask_title,round,review_date,priority,is_completed,completed_at,created_at,updated_at,review_number)
          VALUES (@id,@todo_id,@subtask_id,@subtask_title,@round,@review_date,@priority,@is_completed,@completed_at,@created_at,@updated_at,@review_number)
        `,
          )
          .run(r);
      }

      if (d.statistics) {
        this.db
          .prepare(
            `
          UPDATE statistics
          SET total_completed=@total_completed,current_streak=@current_streak,longest_streak=@longest_streak,last_activity_date=@last_activity_date,total_reviews_completed=@total_reviews_completed
          WHERE id=1
        `,
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
            `
          INSERT INTO streaks (id,date,completed_count,created_at)
          VALUES (@id,@date,@completed_count,@created_at)
        `,
          )
          .run(s);
      }
    });

    tx();
  }

  isDangerousEmptyLocalState(localFiles) {
    const allowEmptyMirror = !!this.settingsRepo.get(
      "dropboxAllowEmptyMirrorDelete",
      false,
    );

    // If explicitly allowed, no guard
    if (allowEmptyMirror) return false;

    // Guard: local folder has zero files -> could be accidental (unmounted disk, wrong path, etc.)
    return !localFiles || localFiles.length === 0;
  }

  async syncNow({ pullFirst = false } = {}) {
    if (this.isSyncing) return { ok: false, message: "Already syncing" };
    if (!this.isOnline()) return { ok: false, message: "Offline" };
    if (!this.dbx)
      return { ok: false, message: "Dropbox token not configured" };

    this.isSyncing = true;
    try {
      if (pullFirst) {
        const remote = await this.downloadDbSnapshotFromDropbox();
        if (remote) {
          this.replaceLocalDbData(remote);

          const workingDirectory =
            remote?.data?.notes?.workingDirectory ||
            this.getWorkingDirectoryPath();

          if (workingDirectory) {
            this.settingsRepo.set("workingDirectory", workingDirectory);
            await this.downloadNotesDirectoryFromDropbox(workingDirectory);
          }
        }
      }

      const payload = this.buildPayload();
      await this.uploadDbSnapshotToDropbox(payload);
      const notesResult = await this.uploadNotesDirectoryToDropbox();

      this.settingsRepo.set("dropboxLastSyncAt", new Date().toISOString());
      return { ok: true, notes: notesResult };
    } finally {
      this.isSyncing = false;
    }
  }

  startInterval() {
    this.stopInterval();
    const cfg = this.getConfig();
    if (!cfg.enabled || !this.dbx) return;

    const ms = Math.max(1, cfg.intervalMinutes) * 60 * 1000;
    this.intervalRef = setInterval(() => {
      this.syncNow().catch((e) => console.error("Scheduled sync failed:", e));
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
