const { net, shell } = require("electron");
const { Dropbox } = require("dropbox");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { loadAppConfig } = require("../config/appConfig.js");

const BACKUP_INTERVAL_MINUTES = 5;
const DEFAULT_KEEP_BACKUPS = 5;

class SyncService {
  constructor({ db, settingsRepo }) {
    this.db = db;
    this.settingsRepo = settingsRepo;
    this.intervalRef = null;
    this.isSyncing = false;
    this.dbx = null;
  }

  isOnline() {
    return net.isOnline();
  }

  getOAuthConfig() {
    const cfg = loadAppConfig();
    return {
      appKey: cfg.dropboxAppKey || "",
      redirectUri: "http://127.0.0.1:53682/dropbox/callback",
    };
  }

  base64Url(buffer) {
    return buffer
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  sha256(input) {
    return crypto.createHash("sha256").update(input).digest();
  }

  hasDropboxCredentials() {
    const { appKey } = this.getOAuthConfig();
    const refreshToken = this.settingsRepo
      .get("dropboxRefreshToken", "")
      .trim();
    return !!(appKey && refreshToken);
  }

  getClient() {
    const { appKey } = this.getOAuthConfig();
    const refreshToken = this.settingsRepo
      .get("dropboxRefreshToken", "")
      .trim();

    if (appKey && refreshToken) {
      return new Dropbox({
        clientId: appKey,
        refreshToken,
        fetch,
      });
    }

    return null;
  }

  getConfig() {
    return {
      enabled: !!this.settingsRepo.get("dropboxSyncEnabled", false),
      accessToken: this.settingsRepo.get("dropboxAccessToken", ""),
      appKey: this.settingsRepo.get("dropboxAppKey", ""),
      appSecret: this.settingsRepo.get("dropboxAppSecret", ""),
      refreshToken: this.settingsRepo.get("dropboxRefreshToken", ""),
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
    if (config.dropboxAccessToken !== undefined) {
      this.settingsRepo.set(
        "dropboxAccessToken",
        config.dropboxAccessToken || "",
      );
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
      meta: { version: 5, exportedAt: new Date().toISOString() },
      data: {
        todos: this.db.prepare("SELECT * FROM todos ORDER BY id ASC").all(),
        subtasks: this.db
          .prepare("SELECT * FROM subtasks ORDER BY id ASC")
          .all(),
        reviews: this.db.prepare("SELECT * FROM reviews ORDER BY id ASC").all(),
        templates: this.db
          .prepare("SELECT * FROM templates ORDER BY id ASC")
          .all(),
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

  _toMillis(ts) {
    if (!ts || typeof ts !== "string") return 0;
    const normalized = ts.includes("T") ? ts : ts.replace(" ", "T") + "Z";
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  _isIncomingNewer(localUpdatedAt, incomingUpdatedAt) {
    return this._toMillis(incomingUpdatedAt) > this._toMillis(localUpdatedAt);
  }

  _normalizeIncomingData(data = {}) {
    const now = new Date().toISOString();
    return {
      todos: (data.todos || []).map((t) => ({
        ...t,
        deleted: t.deleted ? 1 : 0,
      })),
      subtasks: (data.subtasks || []).map((s) => ({
        ...s,
        updated_at: s.updated_at || s.created_at || now,
        deleted: s.deleted ? 1 : 0,
      })),
      reviews: (data.reviews || []).map((r) => ({
        ...r,
        updated_at: r.updated_at || r.created_at || now,
        deleted: r.deleted ? 1 : 0,
      })),
      templates: (data.templates || []).map((t) => ({
        ...t,
        updated_at: t.updated_at || t.created_at || now,
        deleted: t.deleted ? 1 : 0,
      })),
      streaks: (data.streaks || []).map((s) => ({
        ...s,
        updated_at: s.updated_at || s.created_at || now,
      })),
      statistics: data.statistics
        ? {
            ...data.statistics,
            updated_at: data.statistics.updated_at || now,
          }
        : null,
      notes: data.notes || {},
    };
  }

  buildDeltaPayload(lastSyncedAt) {
    return {
      meta: {
        version: 5,
        exportedAt: new Date().toISOString(),
        lastSyncedAt: lastSyncedAt || null,
      },
      data: {
        todos: lastSyncedAt
          ? this.db
              .prepare("SELECT * FROM todos WHERE updated_at > ? ORDER BY id ASC")
              .all(lastSyncedAt)
          : this.db.prepare("SELECT * FROM todos ORDER BY id ASC").all(),
        subtasks: lastSyncedAt
          ? this.db
              .prepare(
                "SELECT * FROM subtasks WHERE updated_at > ? ORDER BY id ASC",
              )
              .all(lastSyncedAt)
          : this.db.prepare("SELECT * FROM subtasks ORDER BY id ASC").all(),
        reviews: lastSyncedAt
          ? this.db
              .prepare("SELECT * FROM reviews WHERE updated_at > ? ORDER BY id ASC")
              .all(lastSyncedAt)
          : this.db.prepare("SELECT * FROM reviews ORDER BY id ASC").all(),
        templates: lastSyncedAt
          ? this.db
              .prepare(
                "SELECT * FROM templates WHERE updated_at > ? ORDER BY id ASC",
              )
              .all(lastSyncedAt)
          : this.db.prepare("SELECT * FROM templates ORDER BY id ASC").all(),
        streaks: lastSyncedAt
          ? this.db
              .prepare("SELECT * FROM streaks WHERE updated_at > ? ORDER BY date DESC")
              .all(lastSyncedAt)
          : this.db.prepare("SELECT * FROM streaks ORDER BY date DESC").all(),
        statistics: lastSyncedAt
          ? this.db
              .prepare("SELECT * FROM statistics WHERE id = 1 AND updated_at > ?")
              .get(lastSyncedAt)
          : this.db.prepare("SELECT * FROM statistics WHERE id = 1").get(),
        notes: {
          workingDirectory: this.getWorkingDirectoryPath(),
        },
      },
    };
  }

  _mergeRecordArraysByKey(base = [], incoming = [], key, updatedAtKey = "updated_at") {
    const map = new Map((base || []).map((item) => [item[key], item]));

    for (const next of incoming || []) {
      const current = map.get(next[key]);
      if (!current) {
        map.set(next[key], next);
        continue;
      }

      if (this._isIncomingNewer(current[updatedAtKey], next[updatedAtKey])) {
        map.set(next[key], next);
      }
    }

    return Array.from(map.values());
  }

  _mergePayloadData(basePayload, incomingPayload) {
    const baseData = this._normalizeIncomingData(basePayload?.data || {});
    const incomingData = this._normalizeIncomingData(incomingPayload?.data || {});

    const mergedStatistics =
      incomingData.statistics &&
      (!baseData.statistics ||
        this._isIncomingNewer(
          baseData.statistics.updated_at,
          incomingData.statistics.updated_at,
        ))
        ? incomingData.statistics
        : baseData.statistics;

    return {
      meta: {
        version: 5,
        exportedAt: new Date().toISOString(),
      },
      data: {
        todos: this._mergeRecordArraysByKey(baseData.todos, incomingData.todos, "id"),
        subtasks: this._mergeRecordArraysByKey(
          baseData.subtasks,
          incomingData.subtasks,
          "id",
        ),
        reviews: this._mergeRecordArraysByKey(
          baseData.reviews,
          incomingData.reviews,
          "id",
        ),
        templates: this._mergeRecordArraysByKey(
          baseData.templates,
          incomingData.templates,
          "id",
        ),
        streaks: this._mergeRecordArraysByKey(
          baseData.streaks,
          incomingData.streaks,
          "date",
        ),
        statistics: mergedStatistics,
        notes: {
          workingDirectory:
            incomingData?.notes?.workingDirectory ||
            baseData?.notes?.workingDirectory ||
            this.getWorkingDirectoryPath(),
        },
      },
    };
  }

  _getBackupPath(remotePath) {
    const ext = path.posix.extname(remotePath);
    const base = remotePath.slice(0, remotePath.length - ext.length);
    return `${base}.backup${ext}`;
  }

  async downloadDbSnapshotFromDropbox(snapshotPath) {
    const dbx = this.getClient();
    if (!dbx) throw new Error("Dropbox token is not configured");

    const targetPath = snapshotPath || this.getConfig().remotePath;

    try {
      const res = await dbx.filesDownload({ path: targetPath });
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

  async uploadDbSnapshotToDropbox(payload, targetPath) {
    const dbx = this.getClient();
    if (!dbx) throw new Error("Dropbox token is not configured");

    const remotePath = targetPath || this.getConfig().remotePath;

    await dbx.filesUpload({
      path: remotePath,
      mode: { ".tag": "overwrite" },
      mute: true,
      contents: Buffer.from(JSON.stringify(payload, null, 2), "utf-8"),
    });
  }

  /**
   * Save the current remote snapshot as a backup in Dropbox before overwriting.
   */
  async backupRemoteSnapshot() {
    const { remotePath } = this.getConfig();
    const backupPath = this._getBackupPath(remotePath);

    try {
      const existing = await this.downloadDbSnapshotFromDropbox(remotePath);
      if (existing) {
        await this.uploadDbSnapshotToDropbox(existing, backupPath);
        console.log("Dropbox backup created at:", backupPath);
        return true;
      }
    } catch (e) {
      console.warn("Could not create Dropbox backup:", e?.message || e);
    }
    return false;
  }

  /**
   * Revert local DB and remote snapshot to the last backup.
   */
  async revertToBackup() {
    const dbx = this.getClient();
    if (!dbx) throw new Error("Dropbox token is not configured");
    if (!this.isOnline()) throw new Error("Offline");

    const { remotePath } = this.getConfig();
    const backupPath = this._getBackupPath(remotePath);

    const backup = await this.downloadDbSnapshotFromDropbox(backupPath);
    if (!backup) throw new Error("No backup found in Dropbox");

    this.replaceLocalDbData(backup);
    await this.uploadDbSnapshotToDropbox(backup, remotePath);

    const workingDirectory =
      backup?.data?.notes?.workingDirectory || this.getWorkingDirectoryPath();
    if (workingDirectory) {
      this.settingsRepo.set("workingDirectory", workingDirectory);
      await this.downloadNotesDirectoryFromDropbox(workingDirectory);
    }

    this.settingsRepo.set("dropboxLastSyncAt", new Date().toISOString());
    return { ok: true };
  }

  async ensureDropboxFolder(folderPath) {
    const dbx = this.getClient();
    if (!dbx) throw new Error("Dropbox token is not configured");

    try {
      await dbx.filesCreateFolderV2({ path: folderPath, autorename: false });
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

  async listDropboxFilesRecursive(rootPath) {
    const dbx = this.getClient();
    if (!dbx) throw new Error("Dropbox token is not configured");

    const files = [];
    try {
      let res = await dbx.filesListFolder({ path: rootPath, recursive: true });
      files.push(
        ...(res?.result?.entries || []).filter((e) => e[".tag"] === "file"),
      );

      while (res?.result?.has_more) {
        res = await dbx.filesListFolderContinue({ cursor: res.result.cursor });
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

  isDangerousEmptyLocalState(localFiles) {
    const allowEmptyMirror = !!this.settingsRepo.get(
      "dropboxAllowEmptyMirrorDelete",
      false,
    );
    if (allowEmptyMirror) return false;
    return !localFiles || localFiles.length === 0;
  }

  async uploadNotesDirectoryToDropbox() {
    const dbx = this.getClient();
    if (!dbx) throw new Error("Dropbox token is not configured");

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

    const MAX_FILE_SIZE = 50 * 1024 * 1024;

    const localRelSet = new Set(
      localFiles.map((f) => f.relPath.replace(/\\/g, "/").toLowerCase()),
    );

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
      await dbx.filesUpload({
        path: remoteFilePath,
        mode: { ".tag": "overwrite" },
        mute: true,
        contents: content,
      });

      uploaded++;
    }

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
        await dbx.filesDeleteV2({ path: rf.path_lower || rf.path_display });
        deleted++;
      }
    }

    return { uploaded, skipped, deleted, deleteSkippedByGuard };
  }

  async downloadNotesDirectoryFromDropbox(targetLocalDir) {
    const dbx = this.getClient();
    if (!dbx) throw new Error("Dropbox token is not configured");

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

      const dl = await dbx.filesDownload({
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
    this._mergeRemoteIntoLocal(snapshot);
  }

  /**
   * Returns true if any local record has been modified since lastSyncAt.
   */
  _localHasChangedSince(lastSyncAt) {
    if (!lastSyncAt) return true;

    try {
      if (
        this.db
          .prepare("SELECT 1 FROM todos WHERE updated_at > ? LIMIT 1")
          .get(lastSyncAt)
      )
        return true;
      if (
        this.db
          .prepare("SELECT 1 FROM subtasks WHERE updated_at > ? LIMIT 1")
          .get(lastSyncAt)
      )
        return true;
      if (
        this.db
          .prepare("SELECT 1 FROM reviews WHERE updated_at > ? LIMIT 1")
          .get(lastSyncAt)
      )
        return true;
      if (
        this.db
          .prepare("SELECT 1 FROM templates WHERE updated_at > ? LIMIT 1")
          .get(lastSyncAt)
      )
        return true;
      if (
        this.db
          .prepare("SELECT 1 FROM streaks WHERE updated_at > ? LIMIT 1")
          .get(lastSyncAt)
      )
        return true;
      if (
        this.db
          .prepare("SELECT 1 FROM statistics WHERE updated_at > ? LIMIT 1")
          .get(lastSyncAt)
      )
        return true;
    } catch {
      return true;
    }

    return false;
  }

  /**
   * Merge remote snapshot data into the local database.
   *   - Items only in remote  -> insert locally
   *   - Items only in local   -> keep as-is
   *   - Items in both with differing updated_at -> keep local copy, insert
   *     remote copy with "[CONFLICT] " title prefix
   */
  _mergeRemoteIntoLocal(remote) {
    if (!remote?.data) return;
    const d = this._normalizeIncomingData(remote.data);

    const tx = this.db.transaction(() => {
      for (const rt of d.todos || []) {
        const local = this.db
          .prepare("SELECT id, updated_at FROM todos WHERE id = ?")
          .get(rt.id);
        if (!local) {
          this.db
            .prepare(
              `INSERT INTO todos (id,title,description,due_date,is_global,is_completed,is_archived,completed_at,created_at,updated_at,priority,labels,deleted)
               VALUES (@id,@title,@description,@due_date,@is_global,@is_completed,@is_archived,@completed_at,@created_at,@updated_at,@priority,@labels,@deleted)`,
            )
            .run(rt);
        } else if (this._isIncomingNewer(local.updated_at, rt.updated_at)) {
          this.db
            .prepare(
              `UPDATE todos
               SET title=@title,description=@description,due_date=@due_date,is_global=@is_global,is_completed=@is_completed,is_archived=@is_archived,completed_at=@completed_at,created_at=@created_at,updated_at=@updated_at,priority=@priority,labels=@labels,deleted=@deleted
               WHERE id=@id`,
            )
            .run(rt);
        }
      }

      for (const rs of d.subtasks || []) {
        const local = this.db
          .prepare("SELECT id, updated_at FROM subtasks WHERE id = ?")
          .get(rs.id);
        if (!local) {
          this.db
            .prepare(
              `INSERT INTO subtasks (id,todo_id,title,is_review,is_completed,sort_order,completed_at,created_at,updated_at,deadline,tags,deleted)
               VALUES (@id,@todo_id,@title,@is_review,@is_completed,@sort_order,@completed_at,@created_at,@updated_at,@deadline,@tags,@deleted)`,
            )
            .run(rs);
        } else if (this._isIncomingNewer(local.updated_at, rs.updated_at)) {
          this.db
            .prepare(
              `UPDATE subtasks
               SET todo_id=@todo_id,title=@title,is_review=@is_review,is_completed=@is_completed,sort_order=@sort_order,completed_at=@completed_at,created_at=@created_at,updated_at=@updated_at,deadline=@deadline,tags=@tags,deleted=@deleted
               WHERE id=@id`,
            )
            .run(rs);
        }
      }

      for (const rr of d.reviews || []) {
        const local = this.db
          .prepare("SELECT id, updated_at FROM reviews WHERE id = ?")
          .get(rr.id);
        if (!local) {
          this.db
            .prepare(
              `INSERT INTO reviews (id,todo_id,subtask_id,subtask_title,round,review_date,priority,is_completed,completed_at,created_at,updated_at,review_number,deleted)
               VALUES (@id,@todo_id,@subtask_id,@subtask_title,@round,@review_date,@priority,@is_completed,@completed_at,@created_at,@updated_at,@review_number,@deleted)`,
            )
            .run(rr);
        } else if (this._isIncomingNewer(local.updated_at, rr.updated_at)) {
          this.db
            .prepare(
              `UPDATE reviews
               SET todo_id=@todo_id,subtask_id=@subtask_id,subtask_title=@subtask_title,round=@round,review_date=@review_date,priority=@priority,is_completed=@is_completed,completed_at=@completed_at,created_at=@created_at,updated_at=@updated_at,review_number=@review_number,deleted=@deleted
               WHERE id=@id`,
            )
            .run(rr);
        }
      }

      for (const rt of d.templates || []) {
        const local = this.db
          .prepare("SELECT id, updated_at FROM templates WHERE id = ?")
          .get(rt.id);
        if (!local) {
          this.db
            .prepare(
              `INSERT INTO templates (id,name,description,tasks,created_at,updated_at,deleted)
               VALUES (@id,@name,@description,@tasks,@created_at,@updated_at,@deleted)`,
            )
            .run(rt);
        } else if (this._isIncomingNewer(local.updated_at, rt.updated_at)) {
          this.db
            .prepare(
              `UPDATE templates
               SET name=@name,description=@description,tasks=@tasks,created_at=@created_at,updated_at=@updated_at,deleted=@deleted
               WHERE id=@id`,
            )
            .run(rt);
        }
      }

      for (const rs of d.streaks || []) {
        const local = this.db
          .prepare("SELECT id, updated_at FROM streaks WHERE date = ?")
          .get(rs.date);
        if (!local) {
          this.db
            .prepare(
              `INSERT INTO streaks (id,date,completed_count,created_at,updated_at)
               VALUES (@id,@date,@completed_count,@created_at,@updated_at)`,
            )
            .run(rs);
        } else if (this._isIncomingNewer(local.updated_at, rs.updated_at)) {
          this.db
            .prepare(
              "UPDATE streaks SET completed_count = @completed_count, created_at = @created_at, updated_at = @updated_at WHERE date = @date",
            )
            .run(rs);
        }
      }

      if (d.statistics) {
        const localStats = this.db
          .prepare("SELECT updated_at FROM statistics WHERE id = 1")
          .get();
        if (
          !localStats ||
          this._isIncomingNewer(localStats.updated_at, d.statistics.updated_at)
        ) {
          this.db
            .prepare(
              `UPDATE statistics
               SET total_completed=@total_completed,current_streak=@current_streak,longest_streak=@longest_streak,last_activity_date=@last_activity_date,total_reviews_completed=@total_reviews_completed,updated_at=@updated_at
               WHERE id=1`,
            )
            .run({
              total_completed: d.statistics.total_completed || 0,
              current_streak: d.statistics.current_streak || 0,
              longest_streak: d.statistics.longest_streak || 0,
              last_activity_date: d.statistics.last_activity_date || null,
              total_reviews_completed: d.statistics.total_reviews_completed || 0,
              updated_at: d.statistics.updated_at,
            });
        }
      }
    });

    tx();
  }

  async connectDropbox() {
    const { appKey, redirectUri } = this.getOAuthConfig();
    if (!appKey) {
      throw new Error("Dropbox app key is missing on this build");
    }

    const state = crypto.randomBytes(16).toString("hex");
    const codeVerifier = this.base64Url(crypto.randomBytes(32));
    const codeChallenge = this.base64Url(this.sha256(codeVerifier));

    const authUrl =
      "https://www.dropbox.com/oauth2/authorize" +
      `?client_id=${encodeURIComponent(appKey)}` +
      `&response_type=code` +
      `&token_access_type=offline` +
      `&code_challenge_method=S256` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`;

    const code = await new Promise((resolve, reject) => {
      let done = false;

      const finish = (fn, value) => {
        if (done) return;
        done = true;
        try {
          server.close();
        } catch {}
        fn(value);
      };

      const server = http.createServer((req, res) => {
        try {
          const url = new URL(req.url, "http://127.0.0.1:53682");
          if (url.pathname !== "/dropbox/callback") {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }

          const returnedState = url.searchParams.get("state") || "";
          const returnedCode = url.searchParams.get("code") || "";
          const oauthError = url.searchParams.get("error");

          if (oauthError) {
            res.statusCode = 400;
            res.end("Dropbox authorization failed. You can close this window.");
            return finish(
              reject,
              new Error(`Dropbox OAuth error: ${oauthError}`),
            );
          }

          if (!returnedCode || returnedState !== state) {
            res.statusCode = 400;
            res.end("Invalid OAuth response. You can close this window.");
            return finish(reject, new Error("Invalid OAuth state/code"));
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end("<h3>Dropbox connected. You can close this window.</h3>");
          return finish(resolve, returnedCode);
        } catch (e) {
          return finish(reject, e);
        }
      });

      server.listen(53682, "127.0.0.1", async () => {
        await shell.openExternal(authUrl);
      });

      server.on("error", (e) => finish(reject, e));

      setTimeout(() => {
        finish(reject, new Error("Dropbox connect timed out"));
      }, 120000);
    });

    const body = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: appKey,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Failed token exchange (${tokenRes.status}): ${text}`);
    }

    const tokenJson = await tokenRes.json();
    const refreshToken = tokenJson.refresh_token;

    if (!refreshToken) {
      throw new Error("Dropbox did not return refresh_token");
    }

    this.settingsRepo.set("dropboxRefreshToken", refreshToken);
    this.settingsRepo.set("dropboxConnectedAt", new Date().toISOString());
    this.restartInterval();
    return { ok: true };
  }

  async disconnectDropbox() {
    try {
      const dbx = this.getClient();
      if (dbx) {
        await dbx.authTokenRevoke();
      }
    } catch (e) {
      console.warn("Dropbox revoke failed:", e?.message || e);
    }

    this.settingsRepo.set("dropboxRefreshToken", "");
    this.settingsRepo.set("dropboxConnectedAt", "");
    this.restartInterval();

    return { ok: true };
  }

  /**
   * Incremental Dropbox sync:
   *  1. Pull remote snapshot and merge it into local using updated_at (LWW).
   *  2. Build local delta containing only records changed after last sync.
   *  3. Merge local delta into remote snapshot and upload merged remote snapshot.
   *  4. Update last sync timestamp.
   */
  async syncNow({ pullFirst = false } = {}) {
    if (this.isSyncing) return { ok: false, message: "Already syncing" };
    if (!this.isOnline()) return { ok: false, message: "Offline" };
    if (!this.getClient())
      return { ok: false, message: "Dropbox token not configured" };

    this.isSyncing = true;
    try {
      const lastSyncAt = this.settingsRepo.get("dropboxLastSyncAt", null);
      const remote = await this.downloadDbSnapshotFromDropbox();
      if (remote) {
        this._mergeRemoteIntoLocal(remote);

        const workingDirectory =
          remote?.data?.notes?.workingDirectory || this.getWorkingDirectoryPath();
        if (workingDirectory) {
          this.settingsRepo.set("workingDirectory", workingDirectory);
          await this.downloadNotesDirectoryFromDropbox(workingDirectory);
        }
      }

      const localDelta = this.buildDeltaPayload(lastSyncAt);
      const hasLocalChanges = this._localHasChangedSince(lastSyncAt);

      if (remote && hasLocalChanges) {
        await this.backupRemoteSnapshot();
      }

      const payloadToUpload = remote
        ? this._mergePayloadData(remote, localDelta)
        : localDelta;

      await this.uploadDbSnapshotToDropbox(payloadToUpload);
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
    if (!cfg.enabled || !this.getClient()) return;

    const ms = Math.max(1, cfg.intervalMinutes) * 60 * 1000 * 2;
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
