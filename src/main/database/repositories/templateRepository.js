const { randomUUID } = require("crypto");

class TemplateRepository {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.statements = {
      getAll: this.db.prepare(
        "SELECT * FROM templates WHERE deleted = 0 ORDER BY updated_at DESC",
      ),
      getById: this.db.prepare(
        "SELECT * FROM templates WHERE id = ? AND deleted = 0",
      ),
      create: this.db.prepare(`
        INSERT INTO templates (id, name, description, tasks, created_at, updated_at, deleted)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), 0)
      `),
      update: this.db.prepare(`
        UPDATE templates SET name = ?, description = ?, tasks = ?, updated_at = datetime('now')
        WHERE id = ?
      `),
      delete: this.db.prepare(`
        UPDATE templates
        SET deleted = 1,
            updated_at = datetime('now')
        WHERE id = ? AND deleted = 0
      `),
    };
  }

  getAll() {
    return this.statements.getAll
      .all()
      .map((t) => ({ ...t, tasks: JSON.parse(t.tasks) }));
  }

  getById(id) {
    const t = this.statements.getById.get(id);
    if (!t) return null;
    return { ...t, tasks: JSON.parse(t.tasks) };
  }

  create({ name, description, tasks }) {
    const id = randomUUID();
    this.statements.create.run(id, name, description, JSON.stringify(tasks));
    return this.getById(id);
  }

  update(id, { name, description, tasks }) {
    this.statements.update.run(name, description, JSON.stringify(tasks), id);
    return this.getById(id);
  }

  delete(id) {
    this.statements.delete.run(id);
    return true;
  }
}

module.exports = { TemplateRepository };
