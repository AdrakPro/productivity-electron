const { registerTodoHandlers } = require("./todoHandlers.js");
const { registerSubtaskHandlers } = require("./subtaskHandlers.js");
const { registerStatisticsHandlers } = require("./statisticsHandlers.js");
const { registerFileHandlers } = require("./fileHandlers.js");
const { registerAppHandlers } = require("./appHandlers.js");
const { registerReviewHandlers } = require("./reviewHandlers.js");

const {
  TodoRepository,
} = require("../database/repositories/todoRepository.js");
const {
  SubtaskRepository,
} = require("../database/repositories/subtaskRepository.js");
const {
  StatisticsRepository,
} = require("../database/repositories/statisticsRepository.js");
const {
  SettingsRepository,
} = require("../database/repositories/settingsRepository.js");
const {
  ReviewRepository,
} = require("../database/repositories/reviewRepository.js");

/**
 * Register all IPC handlers
 */
function registerAllHandlers(db) {
  const todoRepo = new TodoRepository(db);
  const subtaskRepo = new SubtaskRepository(db);
  const statisticsRepo = new StatisticsRepository(db);
  const settingsRepo = new SettingsRepository(db);
  const reviewRepo = new ReviewRepository(db);

  registerTodoHandlers(todoRepo, subtaskRepo, statisticsRepo);
  registerSubtaskHandlers(subtaskRepo, todoRepo);
  registerStatisticsHandlers(statisticsRepo);
  registerFileHandlers(settingsRepo);
  registerAppHandlers(settingsRepo);
  registerReviewHandlers(reviewRepo, statisticsRepo);

  console.log("All IPC handlers registered");
}

module.exports = {
  registerAllHandlers,
};
