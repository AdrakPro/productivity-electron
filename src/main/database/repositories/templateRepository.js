class TemplateRepository {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.statements = {
      getAll: this.db.prepare(
        "SELECT * FROM templates ORDER BY updated_at DESC",
      ),
      getById: this.db.prepare("SELECT * FROM templates WHERE id = ?"),
      create: this.db.prepare(`
        INSERT INTO templates (name, description, tasks, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `),
      update: this.db.prepare(`
        UPDATE templates SET name = ?, description = ?, tasks = ?, updated_at = datetime('now')
        WHERE id = ?
      `),
      delete: this.db.prepare("DELETE FROM templates WHERE id = ?"),
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
    this.statements.create.run(name, description, JSON.stringify(tasks));
    return this.getAll()[0];
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
