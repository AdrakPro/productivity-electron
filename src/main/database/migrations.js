/**
 * Run all database migrations
 */
function runMigrations(db) {
  console.log("Running database migrations...");

  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executed_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const migrations = [
    {
      name: "001_create_todos_table",
      sql: `
        CREATE TABLE IF NOT EXISTS todos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          due_date TEXT,
          is_global INTEGER DEFAULT 0,
          is_completed INTEGER DEFAULT 0,
          is_archived INTEGER DEFAULT 0,
          completed_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
        CREATE INDEX IF NOT EXISTS idx_todos_is_global ON todos(is_global);
        CREATE INDEX IF NOT EXISTS idx_todos_is_archived ON todos(is_archived);
      `,
    },
    {
      name: "002_create_subtasks_table",
      sql: `
        CREATE TABLE IF NOT EXISTS subtasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          todo_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          is_completed INTEGER DEFAULT 0,
          sort_order INTEGER DEFAULT 0,
          completed_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
      `,
    },
    {
      name: "003_create_streaks_table",
      sql: `
        CREATE TABLE IF NOT EXISTS streaks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT UNIQUE NOT NULL,
          completed_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_streaks_date ON streaks(date);
      `,
    },
    {
      name: "004_create_statistics_table",
      sql: `
        CREATE TABLE IF NOT EXISTS statistics (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          total_completed INTEGER DEFAULT 0,
          current_streak INTEGER DEFAULT 0,
          longest_streak INTEGER DEFAULT 0,
          last_activity_date TEXT
        );
        
        INSERT OR IGNORE INTO statistics (id, total_completed, current_streak, longest_streak)
        VALUES (1, 0, 0, 0);
      `,
    },
    {
      name: "005_create_settings_table",
      sql: `
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `,
    },
    {
      name: "006_add_priority_and_labels_to_todos",
      sql: `
        ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'none';
        ALTER TABLE todos ADD COLUMN labels TEXT DEFAULT '[]';
      `,
    },
    {
      name: "007_add_deadline_to_subtasks",
      sql: `
        ALTER TABLE subtasks ADD COLUMN deadline TEXT;
      `,
    },
    {
      name: "008_add_review_system",
      sql: `
        ALTER TABLE todos ADD COLUMN is_review INTEGER DEFAULT 0;

        CREATE TABLE IF NOT EXISTS reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          todo_id INTEGER NOT NULL,
          review_number INTEGER NOT NULL,
          review_date TEXT NOT NULL,
          priority TEXT DEFAULT 'none',
          is_completed INTEGER DEFAULT 0,
          completed_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_reviews_todo_id ON reviews(todo_id);
        CREATE INDEX IF NOT EXISTS idx_reviews_review_date ON reviews(review_date);
        CREATE INDEX IF NOT EXISTS idx_reviews_is_completed ON reviews(is_completed);
      `,
    },
    {
      name: "009_add_total_reviews_to_statistics",
      sql: `
        ALTER TABLE statistics ADD COLUMN total_reviews_completed INTEGER DEFAULT 0;
      `,
    },
    {
      name: "010_add_tags_to_subtasks",
      sql: `
        ALTER TABLE subtasks ADD COLUMN tags TEXT DEFAULT '[]';
      `,
    },
  ];

  // Check which migrations have been executed
  const executedMigrations = db
    .prepare("SELECT name FROM migrations")
    .all()
    .map((row) => row.name);

  // Run pending migrations
  for (const migration of migrations) {
    if (!executedMigrations.includes(migration.name)) {
      console.log(`Running migration: ${migration.name}`);

      try {
        db.exec(migration.sql);

        // Record the migration
        db.prepare("INSERT INTO migrations (name) VALUES (?)").run(
          migration.name,
        );

        console.log(`Migration ${migration.name} completed successfully`);
      } catch (error) {
        // Handle "duplicate column" error gracefully for ALTER TABLE
        if (error.message.includes("duplicate column")) {
          console.log(`Column already exists, skipping: ${migration.name}`);
          db.prepare("INSERT INTO migrations (name) VALUES (?)").run(
            migration.name,
          );
        } else {
          console.error(`Migration ${migration.name} failed:`, error);
          throw error;
        }
      }
    }
  }

  console.log("All migrations completed");
}

module.exports = {
  runMigrations,
};
