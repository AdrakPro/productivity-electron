const { ipcMain } = require("electron");

/**
 * Register subtask-related IPC handlers
 */
function registerSubtaskHandlers(subtaskRepo, todoRepo) {
  ipcMain.handle(
    "subtasks:create",
    async (event, todoId, title, deadline, tags, is_review = false) => {
      try {
        const subtask = subtaskRepo.create(
          todoId,
          title,
          deadline,
          tags,
          is_review,
        );
        return {
          ...subtask,
          is_completed: Boolean(subtask.is_completed),
          is_review: Boolean(subtask.is_review),
        };
      } catch (error) {
        console.error("Error creating subtask:", error);
        throw error;
      }
    },
  );

  ipcMain.handle("subtasks:update", async (event, id, updates) => {
    try {
      const subtask = subtaskRepo.update(id, updates);

      if (subtask) {
        const progress = subtaskRepo.getProgress(subtask.todo_id);
        const allCompleted =
          progress.total > 0 && progress.completed === progress.total;

        todoRepo.update(subtask.todo_id, {
          is_completed: allCompleted,
          completed_at: allCompleted ? new Date().toISOString() : null,
        });
      }

      return subtask
        ? {
            ...subtask,
            is_completed: Boolean(subtask.is_completed),
          }
        : null;
    } catch (error) {
      console.error("Error updating subtask:", error);
      throw error;
    }
  });

  ipcMain.handle("subtasks:delete", async (event, id) => {
    try {
      const subtask = subtaskRepo.getById(id);
      const result = subtaskRepo.delete(id);

      if (result && subtask) {
        const progress = subtaskRepo.getProgress(subtask.todo_id);
        const allCompleted =
          progress.total > 0 && progress.completed === progress.total;

        todoRepo.update(subtask.todo_id, {
          is_completed: allCompleted,
          completed_at: allCompleted ? new Date().toISOString() : null,
        });
      }

      return result;
    } catch (error) {
      console.error("Error deleting subtask:", error);
      throw error;
    }
  });

  ipcMain.handle("subtasks:reorder", async (event, todoId, subtaskIds) => {
    try {
      const subtasks = subtaskRepo.reorder(todoId, subtaskIds);
      return subtasks.map((s) => ({
        ...s,
        is_completed: Boolean(s.is_completed),
      }));
    } catch (error) {
      console.error("Error reordering subtasks:", error);
      throw error;
    }
  });
}

module.exports = {
  registerSubtaskHandlers,
};
