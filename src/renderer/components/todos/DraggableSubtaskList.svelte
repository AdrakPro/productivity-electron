<script>
  import { createEventDispatcher } from "svelte";
  import { flip } from "svelte/animate";
  import { GripVertical } from "lucide-svelte";
  import SubtaskItem from "./SubtaskItem.svelte";

  export let subtasks = [];
  export let readonly = false;
  export let isGlobal = false;
  export let isReview = false;

  const dispatch = createEventDispatcher();

  let draggedIndex = null;
  let dragOverIndex = null;

  function handleDragStart(event, index) {
    if (readonly) return;
    draggedIndex = index;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", index.toString());
  }

  function handleDragOver(event, index) {
    if (readonly || draggedIndex === null) return;
    event.preventDefault();
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = null;
  }

  function handleDrop(event, index) {
    if (readonly || draggedIndex === null) return;
    event.preventDefault();

    if (draggedIndex !== index) {
      // Reorder subtasks
      const newSubtasks = [...subtasks];
      const [removed] = newSubtasks.splice(draggedIndex, 1);
      newSubtasks.splice(index, 0, removed);

      dispatch("reorder", {
        subtasks: newSubtasks,
        subtaskIds: newSubtasks.map((s) => s.id),
      });
    }

    draggedIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
    dragOverIndex = null;
  }
</script>

<div class="space-y-1">
  {#each subtasks as subtask, index (subtask.id)}
    <div
      class="flex items-center gap-1 rounded transition-colors
             {dragOverIndex === index ? 'bg-primary/20' : ''}
             {draggedIndex === index ? 'opacity-50' : ''}"
      draggable="{!readonly}"
      on:dragstart="{(e) => handleDragStart(e, index)}"
      on:dragover="{(e) => handleDragOver(e, index)}"
      on:dragleave="{handleDragLeave}"
      on:drop="{(e) => handleDrop(e, index)}"
      on:dragend="{handleDragEnd}"
      animate:flip="{{ duration: 200 }}"
    >
      <!-- Drag Handle -->
      {#if !readonly}
        <div
          class="cursor-grab active:cursor-grabbing p-1 text-gray-600 hover:text-gray-400"
        >
          <GripVertical size="{14}" />
        </div>
      {/if}

      <!-- Subtask Item -->
      <div class="flex-1">
        <SubtaskItem
          {subtask}
          {readonly}
          {isGlobal}
          {isReview}
          on:toggle
          on:delete
          on:edit
        />
      </div>
    </div>
  {/each}
</div>
