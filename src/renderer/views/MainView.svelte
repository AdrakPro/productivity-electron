<script>
  import TodoList from "$components/todos/TodoList.svelte";
  import DayNavigation from "$components/todos/DayNavigation.svelte";
  import { viewMode } from "$lib/stores/viewStore.js";

  let todoListRef;

  // Expose method to parent
  export function triggerNewTask() {
    todoListRef?.triggerNewTask();
  }
</script>

<div class="h-full flex flex-col">
  <!-- View Title & Navigation -->
  <div class="mb-4">
    {#if $viewMode === "daily"}
      <DayNavigation />
    {:else}
      <h1 class="text-2xl font-bold text-on-surface">Global Tasks</h1>
      <p class="text-gray-400 text-sm mt-1">
        Tasks not tied to specific days, with subtask deadlines
      </p>
    {/if}
  </div>

  <!-- Todo List -->
  <TodoList bind:this={todoListRef} />
</div>
