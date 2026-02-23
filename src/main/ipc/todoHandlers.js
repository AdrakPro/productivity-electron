const { ipcMain } = require("electron");

/**
 * Register todo-related IPC handlers
 */
function registerTodoHandlers(todoRepo, subtaskRepo, statisticsRepo) {
  ipcMain.handle("todos:getAll", async () => {
    try {
      const todos = todoRepo.getAll();
      return todos.map((todo) => ({
        ...todo,
        is_global: Boolean(todo.is_global),
        is_completed: Boolean(todo.is_completed),
        is_archived: Boolean(todo.is_archived),
        is_review: Boolean(todo.is_review),
        subtasks: subtaskRepo.getByTodoId(todo.id).map((s) => ({
          ...s,
          is_completed: Boolean(s.is_completed),
        })),
      }));
    } catch (error) {
      console.error("Error getting all todos:", error);
      throw error;
    }
  });

  ipcMain.handle("todos:getByDate", async (event, date) => {
    try {
      const todos = todoRepo.getByDate(date);
      return todos.map((todo) => ({
        ...todo,
        is_global: Boolean(todo.is_global),
        is_completed: Boolean(todo.is_completed),
        is_archived: Boolean(todo.is_archived),
        is_review: Boolean(todo.is_review),
        subtasks: subtaskRepo.getByTodoId(todo.id).map((s) => ({
          ...s,
          is_completed: Boolean(s.is_completed),
        })),
      }));
    } catch (error) {
      console.error("Error getting todos by date:", error);
      throw error;
    }
  });

  ipcMain.handle("todos:getGlobal", async () => {
    try {
      const todos = todoRepo.getGlobal();
      return todos.map((todo) => ({
        ...todo,
        is_global: Boolean(todo.is_global),
        is_completed: Boolean(todo.is_completed),
        is_archived: Boolean(todo.is_archived),
        is_review: Boolean(todo.is_review),
        subtasks: subtaskRepo.getByTodoId(todo.id).map((s) => ({
          ...s,
          is_completed: Boolean(s.is_completed),
        })),
      }));
    } catch (error) {
      console.error("Error getting global todos:", error);
      throw error;
    }
  });

  ipcMain.handle("todos:getArchived", async () => {
    try {
      const todos = todoRepo.getArchived();
      return todos.map((todo) => ({
        ...todo,
        is_global: Boolean(todo.is_global),
        is_completed: Boolean(todo.is_completed),
        is_archived: Boolean(todo.is_archived),
        is_review: Boolean(todo.is_review),
        subtasks: subtaskRepo.getByTodoId(todo.id).map((s) => ({
          ...s,
          is_completed: Boolean(s.is_completed),
        })),
      }));
    } catch (error) {
      console.error("Error getting archived todos:", error);
      throw error;
    }
  });

  ipcMain.handle("todos:create", async (event, todoData) => {
    try {
      const todo = todoRepo.create(todoData);
      return {
        ...todo,
        is_global: Boolean(todo.is_global),
        is_completed: Boolean(todo.is_completed),
        is_archived: Boolean(todo.is_archived),
        is_review: Boolean(todo.is_review),
        subtasks: [],
      };
    } catch (error) {
      console.error("Error creating todo:", error);
      throw error;
    }
  });

  ipcMain.handle("todos:update", async (event, id, updates) => {
    try {
      const todo = todoRepo.update(id, updates);

      if (updates.is_completed && !updates.is_archived) {
        const date = todo.due_date || new Date().toISOString().split("T")[0];
        statisticsRepo.recordCompletion(date);
      }

      return {
        ...todo,
        is_global: Boolean(todo.is_global),
        is_completed: Boolean(todo.is_completed),
        is_archived: Boolean(todo.is_archived),
        is_review: Boolean(todo.is_review),
        subtasks: subtaskRepo.getByTodoId(todo.id).map((s) => ({
          ...s,
          is_completed: Boolean(s.is_completed),
        })),
      };
    } catch (error) {
      console.error("Error updating todo:", error);
      throw error;
    }
  });

  ipcMain.handle("todos:delete", async (event, id) => {
    try {
      return todoRepo.delete(id);
    } catch (error) {
      console.error("Error deleting todo:", error);
      throw error;
    }
  });

  ipcMain.handle("todos:archive", async (event, id) => {
    try {
      const todo = todoRepo.archive(id);
      if (todo) {
        const date = todo.due_date || new Date().toISOString().split("T")[0];
        statisticsRepo.recordCompletion(date);
      }
      return todo
        ? {
            ...todo,
            is_global: Boolean(todo.is_global),
            is_completed: Boolean(todo.is_completed),
            is_archived: Boolean(todo.is_archived),
            is_review: Boolean(todo.is_review),
            subtasks: subtaskRepo.getByTodoId(todo.id).map((s) => ({
              ...s,
              is_completed: Boolean(s.is_completed),
            })),
          }
        : null;
    } catch (error) {
      console.error("Error archiving todo:", error);
      throw error;
    }
  });

  ipcMain.handle("todos:archiveByDate", async (event, date) => {
    try {
      return todoRepo.archiveByDate(date);
    } catch (error) {
      console.error("Error archiving todos by date:", error);
      throw error;
    }
  });
}

module.exports = {
  registerTodoHandlers,
};
