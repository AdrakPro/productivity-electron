const { ipcMain } = require("electron");

/**
 * Register review-related IPC handlers
 */
function registerReviewHandlers(reviewRepo, statisticsRepo) {
  ipcMain.handle("reviews:getByTodoId", async (event, todoId) => {
    try {
      return reviewRepo.getByTodoId(todoId);
    } catch (error) {
      console.error("Error getting reviews by todo id:", error);
      throw error;
    }
  });

  ipcMain.handle("reviews:getByDate", async (event, date) => {
    try {
      return reviewRepo.getByDate(date);
    } catch (error) {
      console.error("Error getting reviews by date:", error);
      throw error;
    }
  });

  ipcMain.handle("reviews:getDueToday", async () => {
    try {
      return reviewRepo.getDueToday();
    } catch (error) {
      console.error("Error getting due reviews:", error);
      throw error;
    }
  });

  ipcMain.handle("reviews:getAllPending", async () => {
    try {
      return reviewRepo.getAllPending();
    } catch (error) {
      console.error("Error getting pending reviews:", error);
      throw error;
    }
  });

  ipcMain.handle("reviews:complete", async (event, id) => {
    try {
      const result = reviewRepo.complete(id);
      statisticsRepo.incrementReviewsCompleted();
      return result;
    } catch (error) {
      console.error("Error completing review:", error);
      throw error;
    }
  });

  ipcMain.handle("reviews:getAll", async () => {
    try {
      return reviewRepo.getAll();
    } catch (error) {
      console.error("Error getting all reviews:", error);
      throw error;
    }
  });

  ipcMain.handle("reviews:create", async (event, todoId, reviewNumber, reviewDate, priority) => {
    try {
      return reviewRepo.create(todoId, reviewNumber, reviewDate, priority);
    } catch (error) {
      console.error("Error creating review:", error);
      throw error;
    }
  });

  ipcMain.handle("reviews:updatePriority", async (event, id, priority) => {
    try {
      return reviewRepo.updatePriority(id, priority);
    } catch (error) {
      console.error("Error updating review priority:", error);
      throw error;
    }
  });
}

module.exports = {
  registerReviewHandlers,
};
