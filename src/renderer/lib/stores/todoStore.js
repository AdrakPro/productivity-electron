import { writable, derived, get } from "svelte/store";
import { viewMode, selectedDate } from "./viewStore.js";
import {
  todosApi,
  subtasksApi,
  statisticsApi,
  streaksApi,
} from "$lib/services/api.js";
import { success, error as showError } from "./toastStore.js";

// All todos from database (with subtasks embedded)
export const todos = writable([]);

// Recently deleted todos (for undo)
export const deletedTodos = writable([]);

// Loading state
export const isLoading = writable(false);

// Error state
export const error = writable(null);

// Filtered todos based on view mode and selected date
export const filteredTodos = derived(
  [todos, viewMode, selectedDate],
  ([$todos, $viewMode, $selectedDate]) => {
    let filtered;
    if ($viewMode === "global") {
      filtered = $todos.filter((todo) => todo.is_global && !todo.is_archived);
    } else {
      filtered = $todos.filter(
        (todo) =>
          !todo.is_global &&
          todo.due_date === $selectedDate &&
          !todo.is_archived,
      );
    }

    // Sort by priority (urgent first, then high, medium, low, none)
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
    return filtered.sort((a, b) => {
      const priorityA = priorityOrder[a.priority] ?? 4;
      const priorityB = priorityOrder[b.priority] ?? 4;
      return priorityA - priorityB;
    });
  },
);

// Get todo progress (completed subtasks / total subtasks)
export function getTodoProgress(todo) {
  if (!todo.subtasks || todo.subtasks.length === 0) {
    return { completed: 0, total: 0, percentage: 0, isFullyCompleted: false };
  }
  const completed = todo.subtasks.filter((s) => s.is_completed).length;
  const total = todo.subtasks.length;
  const percentage = Math.round((completed / total) * 100);
  const isFullyCompleted = completed === total && total > 0;
  return { completed, total, percentage, isFullyCompleted };
}

// Check if all subtasks are completed
export function isAllSubtasksCompleted(todo) {
  if (!todo.subtasks || todo.subtasks.length === 0) return false;
  return todo.subtasks.every((s) => s.is_completed);
}

// Check if a todo is considered "done"
export function isTodoDone(todo) {
  if (todo.subtasks && todo.subtasks.length > 0) {
    return todo.subtasks.every((s) => s.is_completed);
  }
  return todo.is_completed;
}

// Pending todos count
export const pendingCount = derived(filteredTodos, ($filtered) => {
  return $filtered.filter((todo) => !isTodoDone(todo)).length;
});

// ============ API Operations ============

export async function loadTodos() {
  isLoading.set(true);
  error.set(null);

  try {
    const data = await todosApi.getAll();
    todos.set(data);
  } catch (err) {
    console.error("Failed to load todos:", err);
    error.set(err.message);
    showError("Failed to load tasks");
  } finally {
    isLoading.set(false);
  }
}

export async function addTodo(todoData) {
  error.set(null);

  try {
    const newTodo = await todosApi.create({
      ...todoData,
      priority: todoData.priority || "none",
      labels: todoData.labels || [],
    });
    todos.update((list) => [...list, newTodo]);

    success("Task created");
    return newTodo;
  } catch (err) {
    console.error("Failed to add todo:", err);
    error.set(err.message);
    showError("Failed to create task");
    throw err;
  }
}

export async function updateTodo(id, updates) {
  error.set(null);

  try {
    const updatedTodo = await todosApi.update(id, updates);
    todos.update((list) =>
      list.map((todo) => (todo.id === id ? updatedTodo : todo)),
    );
    return updatedTodo;
  } catch (err) {
    console.error("Failed to update todo:", err);
    error.set(err.message);
    showError("Failed to update task");
    throw err;
  }
}

export async function deleteTodo(id) {
  error.set(null);

  // Store the todo for undo
  const todoToDelete = get(todos).find((t) => t.id === id);

  try {
    await todosApi.delete(id);
    todos.update((list) => list.filter((todo) => todo.id !== id));

    // Add to deleted todos for undo
    if (todoToDelete) {
      deletedTodos.update((list) => [
        ...list,
        { ...todoToDelete, deletedAt: Date.now() },
      ]);

      // Show toast with undo action
      success("Task deleted", 5000, {
        label: "Undo",
        onClick: () => restoreTodo(todoToDelete),
      });
    }
  } catch (err) {
    console.error("Failed to delete todo:", err);
    error.set(err.message);
    showError("Failed to delete task");
    throw err;
  }
}

// Restore a deleted todo
export async function restoreTodo(todo) {
  try {
    const restoredTodo = await todosApi.create({
      title: todo.title,
      description: todo.description,
      due_date: todo.due_date,
      is_global: todo.is_global,
      priority: todo.priority,
      labels: todo.labels,
    });

    // Restore subtasks
    if (todo.subtasks && todo.subtasks.length > 0) {
      for (const subtask of todo.subtasks) {
        await subtasksApi.create(
          restoredTodo.id,
          subtask.title,
          subtask.deadline || null,
          subtask.tags || [],
        );
      }
    }

    // Reload todos to get complete data
    await loadTodos();

    // Remove from deleted todos
    deletedTodos.update((list) => list.filter((t) => t.id !== todo.id));

    success("Task restored");
  } catch (err) {
    console.error("Failed to restore todo:", err);
    showError("Failed to restore task");
  }
}

export async function archiveTodo(id) {
  error.set(null);

  try {
    const archivedTodo = await todosApi.archive(id);
    if (archivedTodo) {
      todos.update((list) =>
        list.map((todo) => (todo.id === id ? archivedTodo : todo)),
      );
    }
    success("Task archived");
    return archivedTodo;
  } catch (err) {
    console.error("Failed to archive todo:", err);
    error.set(err.message);
    showError("Failed to archive task");
    throw err;
  }
}

export async function archiveDailyTodos(date) {
  error.set(null);

  try {
    await todosApi.archiveByDate(date);
    await loadTodos();
  } catch (err) {
    console.error("Failed to archive daily todos:", err);
    error.set(err.message);
    throw err;
  }
}

export async function archiveOverdueGlobalTodos() {
  const today = new Date().toISOString().split("T")[0];
  const $todos = get(todos);

  const overdueTodos = $todos.filter(
    (todo) =>
      todo.is_global &&
      todo.due_date &&
      todo.due_date < today &&
      !todo.is_archived,
  );

  for (const todo of overdueTodos) {
    try {
      await archiveTodo(todo.id);
    } catch (err) {
      console.error(`Failed to archive overdue task ${todo.id}:`, err);
    }
  }
}

// ============ Subtask Operations ============

function recalculateTodoCompletion(todo) {
  if (!todo.subtasks || todo.subtasks.length === 0) {
    return {
      ...todo,
      is_completed: false,
      completed_at: null,
    };
  }

  const allCompleted = todo.subtasks.every((s) => s.is_completed);

  return {
    ...todo,
    is_completed: allCompleted,
    completed_at: allCompleted
      ? todo.completed_at || new Date().toISOString()
      : null,
  };
}

export async function addSubtask(todoId, title, deadline, tags) {
  error.set(null);

  try {
    const newSubtask = await subtasksApi.create(todoId, title, deadline, tags);

    todos.update((list) =>
      list.map((todo) => {
        if (todo.id === todoId) {
          const updatedTodo = {
            ...todo,
            subtasks: [...(todo.subtasks || []), newSubtask],
          };
          return recalculateTodoCompletion(updatedTodo);
        }
        return todo;
      }),
    );

    return newSubtask;
  } catch (err) {
    console.error("Failed to add subtask:", err);
    error.set(err.message);
    showError("Failed to add subtask");
    throw err;
  }
}

export async function updateSubtask(todoId, subtaskId, updates) {
  error.set(null);

  try {
    const updatedSubtask = await subtasksApi.update(subtaskId, updates);

    todos.update((list) =>
      list.map((todo) => {
        if (todo.id === todoId) {
          const subtasks = todo.subtasks.map((s) =>
            s.id === subtaskId ? updatedSubtask : s,
          );

          const updatedTodo = {
            ...todo,
            subtasks,
          };

          return recalculateTodoCompletion(updatedTodo);
        }
        return todo;
      }),
    );

    return updatedSubtask;
  } catch (err) {
    console.error("Failed to update subtask:", err);
    error.set(err.message);
    showError("Failed to update subtask");
    throw err;
  }
}

export async function deleteSubtask(todoId, subtaskId) {
  error.set(null);

  try {
    await subtasksApi.delete(subtaskId);

    todos.update((list) =>
      list.map((todo) => {
        if (todo.id === todoId) {
          const subtasks = todo.subtasks.filter((s) => s.id !== subtaskId);

          const updatedTodo = {
            ...todo,
            subtasks,
          };

          return recalculateTodoCompletion(updatedTodo);
        }
        return todo;
      }),
    );
  } catch (err) {
    console.error("Failed to delete subtask:", err);
    error.set(err.message);
    showError("Failed to delete subtask");
    throw err;
  }
}

// Reorder subtasks (for drag & drop)
export async function reorderSubtasks(todoId, subtaskIds) {
  error.set(null);

  try {
    const reorderedSubtasks = await subtasksApi.reorder(todoId, subtaskIds);

    todos.update((list) =>
      list.map((todo) => {
        if (todo.id === todoId) {
          return {
            ...todo,
            subtasks: reorderedSubtasks,
          };
        }
        return todo;
      }),
    );

    return reorderedSubtasks;
  } catch (err) {
    console.error("Failed to reorder subtasks:", err);
    error.set(err.message);
    showError("Failed to reorder subtasks");
    throw err;
  }
}

// ============ Export/Import (WITH STATISTICS) ============

export async function exportTodos() {
  const $todos = get(todos);

  // Get current statistics and streaks
  let stats = null;
  let streaks = [];

  try {
    stats = await statisticsApi.get();
    streaks = await streaksApi.get();
  } catch (err) {
    console.error("Failed to get statistics for export:", err);
  }

  const data = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    todos: $todos,
    statistics: stats,
    streaks: streaks,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `todo-backup-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  success("Data exported successfully (includes statistics)");
}

export async function importTodos(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);

        if (!data.todos || !Array.isArray(data.todos)) {
          throw new Error("Invalid backup file format");
        }

        let importedTodos = 0;
        let importedStats = false;
        let importedStreaks = 0;

        // Import todos
        for (const todo of data.todos) {
          try {
            const newTodo = await todosApi.create({
              title: todo.title,
              description: todo.description,
              due_date: todo.due_date,
              is_global: todo.is_global,
              priority: todo.priority || "none",
              labels: todo.labels || [],
            });

            // Import subtasks
            if (todo.subtasks && todo.subtasks.length > 0) {
              for (const subtask of todo.subtasks) {
                await subtasksApi.create(
                  newTodo.id,
                  subtask.title,
                  subtask.deadline || null,
                  subtask.tags || [],
                );
                // Mark as completed if it was completed
                if (subtask.is_completed) {
                  const createdSubtasks =
                    (await todosApi.getAll()).find((t) => t.id === newTodo.id)
                      ?.subtasks || [];
                  const lastSubtask =
                    createdSubtasks[createdSubtasks.length - 1];
                  if (lastSubtask) {
                    await subtasksApi.update(lastSubtask.id, {
                      is_completed: true,
                    });
                  }
                }
              }
            }

            // If todo was archived, archive it
            if (todo.is_archived) {
              await todosApi.archive(newTodo.id);
            }

            importedTodos++;
          } catch (err) {
            console.error("Failed to import todo:", err);
          }
        }

        // Import statistics (merge with existing)
        if (data.statistics) {
          try {
            const currentStats = await statisticsApi.get();
            await statisticsApi.update({
              total_completed:
                (currentStats?.total_completed || 0) +
                (data.statistics.total_completed || 0),
              current_streak:
                data.statistics.current_streak ||
                currentStats?.current_streak ||
                0,
              longest_streak: Math.max(
                data.statistics.longest_streak || 0,
                currentStats?.longest_streak || 0,
              ),
              last_activity_date:
                data.statistics.last_activity_date ||
                currentStats?.last_activity_date,
            });
            importedStats = true;
          } catch (err) {
            console.error("Failed to import statistics:", err);
          }
        }

        // Import streaks
        if (data.streaks && Array.isArray(data.streaks)) {
          for (const streak of data.streaks) {
            try {
              // Record each streak day
              if (streak.date && streak.completed_count > 0) {
                for (let i = 0; i < streak.completed_count; i++) {
                  await streaksApi.recordCompletion(streak.date);
                }
                importedStreaks++;
              }
            } catch (err) {
              console.error("Failed to import streak:", err);
            }
          }
        }

        // Reload all data
        await loadTodos();

        // Reload statistics
        const { loadStatistics } = await import("./statisticsStore.js");
        await loadStatistics();

        // Build success message
        let message = `Imported ${importedTodos} tasks`;
        if (importedStats) {
          message += ", statistics";
        }
        if (importedStreaks > 0) {
          message += `, ${importedStreaks} streak days`;
        }

        success(message);
        resolve({
          todos: importedTodos,
          stats: importedStats,
          streaks: importedStreaks,
        });
      } catch (err) {
        console.error("Failed to parse import file:", err);
        showError("Invalid backup file");
        reject(err);
      }
    };

    reader.onerror = () => {
      showError("Failed to read file");
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}
