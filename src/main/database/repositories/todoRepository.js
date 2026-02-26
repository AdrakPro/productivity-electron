/**
 * Todo Repository - handles all todo-related database operations
 */
class TodoRepository {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.statements = {
      getAll: this.db.prepare(`
        SELECT * FROM todos ORDER BY created_at DESC
      `),

      getById: this.db.prepare(`
        SELECT * FROM todos WHERE id = ?
      `),

      getByDate: this.db.prepare(`
        SELECT * FROM todos 
        WHERE due_date = ? AND is_global = 0 AND is_archived = 0
        ORDER BY 
          CASE priority 
            WHEN 'urgent' THEN 0 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
            ELSE 4 
          END,
          created_at ASC
      `),

      getGlobal: this.db.prepare(`
        SELECT * FROM todos 
        WHERE is_global = 1 AND is_archived = 0
        ORDER BY 
          CASE priority 
            WHEN 'urgent' THEN 0 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
            ELSE 4 
          END,
          created_at ASC
      `),

      getArchived: this.db.prepare(`
        SELECT * FROM todos 
        WHERE is_archived = 1
        ORDER BY completed_at DESC
      `),

      create: this.db.prepare(`
        INSERT INTO todos (title, description, due_date, is_global, priority, labels, created_at, updated_at)
        VALUES (@title, @description, @due_date, @is_global, @priority, @labels, datetime('now'), datetime('now'))
      `),

      update: this.db.prepare(`
        UPDATE todos 
        SET title = @title, 
            description = @description, 
            due_date = @due_date,
            is_global = @is_global,
            is_completed = @is_completed,
            completed_at = @completed_at,
            priority = @priority,
            labels = @labels,
            updated_at = datetime('now')
        WHERE id = @id
      `),

      delete: this.db.prepare(`
        DELETE FROM todos WHERE id = ?
      `),

      archive: this.db.prepare(`
        UPDATE todos 
        SET is_archived = 1, 
            is_completed = 1,
            completed_at = COALESCE(completed_at, datetime('now')),
            updated_at = datetime('now')
        WHERE id = ?
      `),

      archiveByDate: this.db.prepare(`
        UPDATE todos 
        SET is_archived = 1,
            completed_at = COALESCE(completed_at, datetime('now')),
            updated_at = datetime('now')
        WHERE due_date = ? AND is_global = 0 AND is_archived = 0
      `),
    };
  }

  _parseTodo(todo) {
    if (!todo) return null;
    return {
      ...todo,
      labels: todo.labels ? JSON.parse(todo.labels) : [],
    };
  }

  getAll() {
    return this.statements.getAll.all().map(this._parseTodo);
  }

  getById(id) {
    return this._parseTodo(this.statements.getById.get(id));
  }

  getByDate(date) {
    return this.statements.getByDate.all(date).map(this._parseTodo);
  }

  getGlobal() {
    return this.statements.getGlobal.all().map(this._parseTodo);
  }

  getArchived() {
    return this.statements.getArchived.all().map(this._parseTodo);
  }

  create(todo) {
    const result = this.statements.create.run({
      title: todo.title,
      description: todo.description || null,
      due_date: todo.due_date || null,
      is_global: todo.is_global ? 1 : 0,
      priority: todo.priority || "none",
      labels: JSON.stringify(todo.labels || []),
    });

    return this.getById(result.lastInsertRowid);
  }

  update(id, updates) {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Todo with id ${id} not found`);
    }

    this.statements.update.run({
      id,
      title: updates.title ?? existing.title,
      description: updates.description ?? existing.description,
      due_date: updates.due_date ?? existing.due_date,
      is_global:
        updates.is_global !== undefined
          ? updates.is_global
            ? 1
            : 0
          : existing.is_global,
      is_completed:
        updates.is_completed !== undefined
          ? updates.is_completed
            ? 1
            : 0
          : existing.is_completed,
      completed_at: updates.completed_at ?? existing.completed_at,
      priority: updates.priority ?? existing.priority,
      labels: updates.labels
        ? JSON.stringify(updates.labels)
        : JSON.stringify(existing.labels),
    });

    return this.getById(id);
  }

  delete(id) {
    const result = this.statements.delete.run(id);
    return result.changes > 0;
  }

  archive(id) {
    const result = this.statements.archive.run(id);
    return result.changes > 0 ? this.getById(id) : null;
  }

  archiveByDate(date) {
    const result = this.statements.archiveByDate.run(date);
    return result.changes;
  }
}

module.exports = {
  TodoRepository,
};
