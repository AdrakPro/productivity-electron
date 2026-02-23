/**
 * Subtask Repository - handles all subtask-related database operations
 */
class SubtaskRepository {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.statements = {
      getByTodoId: this.db.prepare(`
        SELECT * FROM subtasks 
        WHERE todo_id = ?
        ORDER BY sort_order ASC
      `),

      getById: this.db.prepare(`
        SELECT * FROM subtasks WHERE id = ?
      `),

      create: this.db.prepare(`
        INSERT INTO subtasks (todo_id, title, sort_order, deadline, tags, created_at)
        VALUES (@todo_id, @title, @sort_order, @deadline, @tags, datetime('now'))
      `),

      update: this.db.prepare(`
        UPDATE subtasks 
        SET title = @title,
            is_completed = @is_completed,
            completed_at = @completed_at,
            deadline = @deadline,
            tags = @tags
        WHERE id = @id
      `),

      updateSortOrder: this.db.prepare(`
        UPDATE subtasks SET sort_order = ? WHERE id = ?
      `),

      delete: this.db.prepare(`
        DELETE FROM subtasks WHERE id = ?
      `),

      deleteByTodoId: this.db.prepare(`
        DELETE FROM subtasks WHERE todo_id = ?
      `),

      getMaxSortOrder: this.db.prepare(`
        SELECT MAX(sort_order) as max_order FROM subtasks WHERE todo_id = ?
      `),

      countByTodoId: this.db.prepare(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
        FROM subtasks WHERE todo_id = ?
      `),
    };
  }

  getByTodoId(todoId) {
    return this.statements.getByTodoId.all(todoId).map((s) => this._parseSubtask(s));
  }

  getById(id) {
    return this._parseSubtask(this.statements.getById.get(id));
  }

  create(todoId, title, deadline, tags) {
    const maxOrder = this.statements.getMaxSortOrder.get(todoId);
    const sortOrder = (maxOrder?.max_order ?? -1) + 1;

    const result = this.statements.create.run({
      todo_id: todoId,
      title,
      sort_order: sortOrder,
      deadline: deadline || null,
      tags: JSON.stringify(tags || []),
    });

    return this._parseSubtask(this.getById(result.lastInsertRowid));
  }

  _parseSubtask(subtask) {
    if (!subtask) return null;
    return {
      ...subtask,
      tags: subtask.tags ? JSON.parse(subtask.tags) : [],
    };
  }

  update(id, updates) {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Subtask with id ${id} not found`);
    }

    const isCompleted =
      updates.is_completed !== undefined
        ? updates.is_completed
          ? 1
          : 0
        : existing.is_completed;

    const completedAt = updates.is_completed
      ? new Date().toISOString()
      : updates.is_completed === false
        ? null
        : existing.completed_at;

    const existingTags = existing.tags
      ? typeof existing.tags === "string"
        ? JSON.parse(existing.tags)
        : existing.tags
      : [];

    this.statements.update.run({
      id,
      title: updates.title ?? existing.title,
      is_completed: isCompleted,
      completed_at: completedAt,
      deadline:
        updates.deadline !== undefined ? updates.deadline : existing.deadline,
      tags: updates.tags
        ? JSON.stringify(updates.tags)
        : JSON.stringify(existingTags),
    });

    return this._parseSubtask(this.getById(id));
  }

  delete(id) {
    const subtask = this.getById(id);
    if (!subtask) return false;

    const result = this.statements.delete.run(id);

    if (result.changes > 0) {
      this.reorderAfterDelete(subtask.todo_id);
    }

    return result.changes > 0;
  }

  deleteByTodoId(todoId) {
    const result = this.statements.deleteByTodoId.run(todoId);
    return result.changes;
  }

  reorder(todoId, subtaskIds) {
    const updateOrder = this.db.transaction((ids) => {
      ids.forEach((id, index) => {
        this.statements.updateSortOrder.run(index, id);
      });
    });

    updateOrder(subtaskIds);
    return this.getByTodoId(todoId);
  }

  reorderAfterDelete(todoId) {
    const subtasks = this.getByTodoId(todoId);
    subtasks.forEach((subtask, index) => {
      if (subtask.sort_order !== index) {
        this.statements.updateSortOrder.run(index, subtask.id);
      }
    });
  }

  getProgress(todoId) {
    return this.statements.countByTodoId.get(todoId);
  }
}

module.exports = {
  SubtaskRepository,
};
