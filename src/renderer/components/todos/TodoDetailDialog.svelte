<script>
  import {
    Calendar,
    CheckCircle2,
    Circle,
    Clock,
    Globe,
    X,
  } from "lucide-svelte";
  import {
    closeTodoDetail,
    isDetailDialogOpen,
    selectedArchivedTodo,
  } from "$lib/stores/archiveStore.js";
  import { getTodoProgress } from "$lib/stores/todoStore.js";

  // Format date for display (DD.MM.YYYY)
  function formatDate(dateStr) {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr.split("T")[0] + "T00:00:00");
    return date
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/\//g, ".");
  }

  function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return "N/A";
    const date = new Date(dateTimeStr);
    return date
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(/\//g, ".");
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && $isDetailDialogOpen) {
      closeTodoDetail();
    }
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      closeTodoDetail();
    }
  }

  $: progress = $selectedArchivedTodo
    ? getTodoProgress($selectedArchivedTodo)
    : null;
  $: hasSubtasks = $selectedArchivedTodo?.subtasks?.length > 0;
  $: completedSubtasks =
    $selectedArchivedTodo?.subtasks?.filter((s) => s.is_completed) || [];
  $: pendingSubtasks =
    $selectedArchivedTodo?.subtasks?.filter((s) => !s.is_completed) || [];
</script>

<svelte:window on:keydown="{handleKeydown}" />

{#if $isDetailDialogOpen && $selectedArchivedTodo}
  <div
    class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
    on:click="{handleBackdropClick}"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialog-title"
  >
    <div
      class="bg-surface-light rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
    >
      <div
        class="flex items-start justify-between p-4 border-b border-surface-lighter"
      >
        <div class="flex items-center gap-3">
          {#if $selectedArchivedTodo.is_global}
            <div class="p-2 rounded-lg bg-secondary/20">
              <Globe size="{20}" class="text-secondary" />
            </div>
          {:else}
            <div class="p-2 rounded-lg bg-primary/20">
              <Calendar size="{20}" class="text-primary" />
            </div>
          {/if}
          <div>
            <h2 id="dialog-title" class="text-lg font-semibold text-on-surface">
              {$selectedArchivedTodo.title}
            </h2>
            <span class="text-sm text-gray-500">
              {$selectedArchivedTodo.is_global ? "Global Task" : "Daily Task"}
            </span>
          </div>
        </div>
        <button
          class="btn-ghost p-2 rounded-lg hover:bg-surface-lighter"
          on:click="{closeTodoDetail}"
          aria-label="Close dialog"
        >
          <X size="{20}" />
        </button>
      </div>

      <div class="p-4 overflow-auto flex-1 space-y-4">
        {#if $selectedArchivedTodo.description}
          <div>
            <h3 class="text-sm font-medium text-gray-400 mb-2">Description</h3>
            <p class="text-on-surface bg-surface-lighter rounded-lg p-3">
              {$selectedArchivedTodo.description}
            </p>
          </div>
        {/if}

        {#if hasSubtasks}
          <div>
            <h3
              class="text-sm font-medium text-gray-400 mb-2 flex items-center justify-between"
            >
              <span>Subtasks</span>
              <span class="text-xs">
                {progress.completed}/{progress.total} completed ({progress.percentage}%)
              </span>
            </h3>

            <div
              class="h-2 bg-surface-lighter rounded-full overflow-hidden mb-3"
            >
              <div
                class="h-full transition-all duration-300"
                class:bg-primary="{progress.percentage < 100}"
                class:bg-secondary="{progress.percentage === 100}"
                style="width: {progress.percentage}%"
              ></div>
            </div>

            <div class="bg-surface-lighter rounded-lg p-3 space-y-2">
              {#if completedSubtasks.length > 0}
                <div class="space-y-1">
                  <p class="text-xs text-gray-500 font-medium mb-2">
                    ✓ Completed
                  </p>
                  {#each completedSubtasks as subtask}
                    <div class="flex items-center gap-2 text-sm">
                      <CheckCircle2
                        size="{16}"
                        class="text-secondary flex-shrink-0"
                      />
                      <span class="text-gray-400 line-through"
                        >{subtask.title}</span
                      >
                    </div>
                  {/each}
                </div>
              {/if}

              {#if pendingSubtasks.length > 0}
                <div
                  class="space-y-1 {completedSubtasks.length > 0
                    ? 'mt-3 pt-3 border-t border-surface'
                    : ''}"
                >
                  <p class="text-xs text-gray-500 font-medium mb-2">
                    ○ Not Completed
                  </p>
                  {#each pendingSubtasks as subtask}
                    <div class="flex items-center gap-2 text-sm">
                      <Circle size="{16}" class="text-gray-500 flex-shrink-0" />
                      <span class="text-on-surface">{subtask.title}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <div class="grid grid-cols-2 gap-4">
          <div class="bg-surface-lighter rounded-lg p-3">
            <div class="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Calendar size="{14}" />
              <span>Date</span>
            </div>
            <p class="text-on-surface font-medium">
              {formatDate($selectedArchivedTodo.due_date)}
            </p>
          </div>

          <div class="bg-surface-lighter rounded-lg p-3">
            <div class="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <CheckCircle2 size="{14}" />
              <span>Archived</span>
            </div>
            <p class="text-on-surface font-medium">
              {formatDateTime($selectedArchivedTodo.completed_at)}
            </p>
          </div>

          <div class="bg-surface-lighter rounded-lg p-3">
            <div class="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Clock size="{14}" />
              <span>Created</span>
            </div>
            <p class="text-on-surface font-medium">
              {formatDateTime($selectedArchivedTodo.created_at)}
            </p>
          </div>

          <div class="bg-surface-lighter rounded-lg p-3">
            <div class="flex items-center gap-2 text-gray-400 text-sm mb-1">
              {#if $selectedArchivedTodo.is_global}
                <Globe size="{14}" />
              {:else}
                <Calendar size="{14}" />
              {/if}
              <span>Type</span>
            </div>
            <p
              class="font-medium {$selectedArchivedTodo.is_global
                ? 'text-secondary'
                : 'text-primary'}"
            >
              {$selectedArchivedTodo.is_global ? "Global" : "Daily"}
            </p>
          </div>
        </div>
      </div>

      <div class="p-4 border-t border-surface-lighter">
        <button class="btn btn-primary w-full" on:click="{closeTodoDetail}">
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
