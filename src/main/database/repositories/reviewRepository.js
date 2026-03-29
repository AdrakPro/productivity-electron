const { randomUUID } = require("crypto");

/**
 * Review Repository - handles spaced-repetition review scheduling
 */
class ReviewRepository {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.statements = {
      getByTodoId: this.db.prepare(`
        SELECT r.*, t.title as todo_title
        FROM reviews r
        JOIN todos t ON r.todo_id = t.id
        WHERE r.todo_id = ? AND r.deleted = 0
        ORDER BY r.review_number ASC
      `),

      getBySubtaskId: this.db.prepare(`
        SELECT r.*, t.title as todo_title
        FROM reviews r
               JOIN todos t ON r.todo_id = t.id
        WHERE r.subtask_id = ? AND r.deleted = 0
        ORDER BY r.review_number ASC
      `),

      getById: this.db.prepare(`
        SELECT r.*, t.title as todo_title
        FROM reviews r
        JOIN todos t ON r.todo_id = t.id
        WHERE r.id = ? AND r.deleted = 0
      `),

      getByDate: this.db.prepare(`
        SELECT r.*, t.title as todo_title
        FROM reviews r
        JOIN todos t ON r.todo_id = t.id
        WHERE r.review_date = ? AND r.is_completed = 0 AND r.deleted = 0
        ORDER BY r.review_date ASC, r.review_number ASC
      `),

      getDueToday: this.db.prepare(`
        SELECT r.*, t.title as todo_title
        FROM reviews r
        JOIN todos t ON r.todo_id = t.id
        WHERE r.review_date <= ? AND r.is_completed = 0 AND r.deleted = 0
        ORDER BY r.review_date ASC, r.review_number ASC
      `),

      getAllPending: this.db.prepare(`
        SELECT r.*, t.title as todo_title
        FROM reviews r
        JOIN todos t ON r.todo_id = t.id
        WHERE r.is_completed = 0 AND r.deleted = 0
        ORDER BY r.review_date ASC, r.review_number ASC
      `),

      getAll: this.db.prepare(`
        SELECT r.*, t.title as todo_title
        FROM reviews r
        JOIN todos t ON r.todo_id = t.id
        WHERE r.deleted = 0
        ORDER BY r.review_date ASC, r.review_number ASC
      `),

      create: this.db.prepare(`
        INSERT INTO reviews (id, todo_id, subtask_id, subtask_title, review_number, review_date, priority, created_at, updated_at, deleted)
        VALUES (@id, @todo_id, @subtask_id, @subtask_title, @review_number, @review_date, @priority, datetime('now'), datetime('now'), 0)
      `),

      deleteBySubtaskId: this.db.prepare(`
        UPDATE reviews
        SET deleted = 1,
            updated_at = datetime('now')
        WHERE subtask_id = ? AND deleted = 0
      `),

      complete: this.db.prepare(`
        UPDATE reviews
        SET is_completed = 1,
            completed_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ? AND deleted = 0
      `),

      updatePriority: this.db.prepare(`
        UPDATE reviews
        SET priority = ?,
            updated_at = datetime('now')
        WHERE id = ? AND deleted = 0
      `),

      getCompletedCount: this.db.prepare(`
        SELECT COUNT(*) as count FROM reviews WHERE is_completed = 1 AND deleted = 0
      `),
    };
  }

  getByTodoId(todoId) {
    return this.statements.getByTodoId.all(todoId);
  }

  getById(id) {
    return this.statements.getById.get(id);
  }

  getByDate(date) {
    return this.statements.getByDate.all(date);
  }

  getDueToday() {
    const today = new Date().toISOString().split("T")[0];
    return this.statements.getDueToday.all(today);
  }

  getAllPending() {
    return this.statements.getAllPending.all();
  }

  getAll() {
    return this.statements.getAll.all();
  }

  create(todoId, subtaskId, subtaskTitle, reviewNumber, reviewDate, priority) {
    const id = randomUUID();
    this.statements.create.run({
      id,
      todo_id: todoId,
      subtask_id: subtaskId || null,
      subtask_title: subtaskTitle || null,
      review_number: reviewNumber,
      review_date: reviewDate,
      priority: priority || "none",
    });
    return this.getById(id);
  }

  complete(id) {
    const review = this.getById(id);
    if (!review) throw new Error(`Review with id ${id} not found`);

    this.statements.complete.run(id);

    // Auto-schedule next review based on confirmation date
    let nextReview = null;

    if (review.review_number === 1) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 7);
      const nextDateStr = nextDate.toISOString().split("T")[0];
      nextReview = this.create(
        review.todo_id,
        review.subtask_id,
        review.subtask_title,
        2,
        nextDateStr,
        review.priority,
      );
    } else if (review.review_number === 2) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 14);
      const nextDateStr = nextDate.toISOString().split("T")[0];
      nextReview = this.create(
        review.todo_id,
        review.subtask_id,
        review.subtask_title,
        3,
        nextDateStr,
        review.priority,
      );
    }
    // review_number === 3: no more reviews

    return { completed: this.getById(id), nextReview };
  }

  updatePriority(id, priority) {
    this.statements.updatePriority.run(priority, id);
    return this.getById(id);
  }

  getCompletedCount() {
    return this.statements.getCompletedCount.get().count;
  }

  deleteBySubtaskId(subtaskId) {
    return this.statements.deleteBySubtaskId.run(subtaskId);
  }
}

module.exports = {
  ReviewRepository,
};
