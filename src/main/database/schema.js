/**
 * Initialize the database schema (fresh start, no migration tracking)
 */
function initializeSchema(db) {
  console.log("Initializing database schema...");

  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      is_global INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      priority TEXT DEFAULT 'none',
      labels TEXT DEFAULT '[]',
      is_review INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
    CREATE INDEX IF NOT EXISTS idx_todos_is_global ON todos(is_global);
    CREATE INDEX IF NOT EXISTS idx_todos_is_archived ON todos(is_archived);

    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      todo_id TEXT NOT NULL,
      title TEXT NOT NULL,
      is_review INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      deadline TEXT,
      tags TEXT DEFAULT '[]',
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);

    CREATE TABLE IF NOT EXISTS streaks (
      id TEXT PRIMARY KEY,
      date TEXT UNIQUE NOT NULL,
      completed_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_streaks_date ON streaks(date);

    CREATE TABLE IF NOT EXISTS statistics (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_completed INTEGER DEFAULT 0,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_activity_date TEXT,
      total_reviews_completed INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO statistics (id, total_completed, current_streak, longest_streak, total_reviews_completed)
    VALUES (1, 0, 0, 0, 0);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      tasks TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      todo_id TEXT NOT NULL,
      subtask_id TEXT,
      subtask_title TEXT,
      round INTEGER DEFAULT 1,
      review_date TEXT,
      priority TEXT DEFAULT 'none',
      is_completed INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      review_number INTEGER DEFAULT 1,
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
      FOREIGN KEY (subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_todo_id ON reviews(todo_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_subtask_id ON reviews(subtask_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_review_date ON reviews(review_date);
  `);

  console.log("Schema initialized successfully");
}

module.exports = { initializeSchema };
