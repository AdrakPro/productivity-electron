const { randomUUID } = require("crypto");

/**
 * Statistics Repository - handles statistics and streak tracking
 */
class StatisticsRepository {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.statements = {
      get: this.db.prepare(`
        SELECT * FROM statistics WHERE id = 1
      `),

      update: this.db.prepare(`
        UPDATE statistics 
        SET total_completed = @total_completed,
            current_streak = @current_streak,
            longest_streak = @longest_streak,
            last_activity_date = @last_activity_date,
            total_reviews_completed = @total_reviews_completed
        WHERE id = 1
      `),

      incrementCompleted: this.db.prepare(`
        UPDATE statistics 
        SET total_completed = total_completed + 1,
            last_activity_date = @date
        WHERE id = 1
      `),

      incrementReviewsCompleted: this.db.prepare(`
        UPDATE statistics 
        SET total_reviews_completed = total_reviews_completed + 1
        WHERE id = 1
      `),

      getStreak: this.db.prepare(`
        SELECT * FROM streaks WHERE date = ?
      `),

      getAllStreaks: this.db.prepare(`
        SELECT * FROM streaks ORDER BY date DESC LIMIT 30
      `),

      upsertStreak: this.db.prepare(`
        INSERT INTO streaks (id, date, completed_count, created_at)
        VALUES (@id, @date, @completed_count, datetime('now'))
        ON CONFLICT(date) DO UPDATE SET completed_count = @completed_count
      `),

      incrementStreakCount: this.db.prepare(`
        INSERT INTO streaks (id, date, completed_count, created_at)
        VALUES (@id, @date, 1, datetime('now'))
        ON CONFLICT(date) DO UPDATE SET completed_count = completed_count + 1
      `),
    };
  }

  get() {
    return this.statements.get.get();
  }

  update(data) {
    this.statements.update.run({
      total_completed: data.total_completed,
      current_streak: data.current_streak,
      longest_streak: data.longest_streak,
      last_activity_date: data.last_activity_date,
      total_reviews_completed: data.total_reviews_completed ?? 0,
    });
    return this.get();
  }

  incrementCompleted(date) {
    this.statements.incrementCompleted.run({ date });
    return this.get();
  }

  getStreak(date) {
    return this.statements.getStreak.get(date);
  }

  getAllStreaks() {
    return this.statements.getAllStreaks.all();
  }

  recordCompletion(date) {
    this.statements.incrementStreakCount.run({ id: randomUUID(), date });
    this.incrementCompleted(date);
    this.calculateStreak(date);
    return this.get();
  }

  calculateStreak(currentDate) {
    const stats = this.get();
    const lastActivity = stats.last_activity_date;

    const current = new Date(currentDate);
    const yesterday = new Date(current);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newStreak = stats.current_streak;

    if (!lastActivity) {
      newStreak = 1;
    } else if (lastActivity === currentDate) {
      // Already recorded today
    } else if (lastActivity === yesterdayStr) {
      newStreak = stats.current_streak + 1;
    } else if (lastActivity < yesterdayStr) {
      newStreak = 1;
    }

    const longestStreak = Math.max(stats.longest_streak, newStreak);

    this.statements.update.run({
      total_completed: stats.total_completed,
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_activity_date: currentDate,
      total_reviews_completed: stats.total_reviews_completed ?? 0,
    });
  }

  incrementReviewsCompleted() {
    this.statements.incrementReviewsCompleted.run();
    return this.get();
  }
}

module.exports = {
  StatisticsRepository,
};
