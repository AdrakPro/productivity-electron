<script>
  import { createEventDispatcher } from "svelte";
  import { Check, Edit3, Trash2, X, Calendar, AlertCircle, BookOpen } from "lucide-svelte";
  import TextInputWithEmoji from "$components/common/TextInputWithEmoji.svelte";
  import { getSubtaskTagsByIds } from "$lib/stores/priorityStore.js";

  export let subtask;
  export let readonly = false;
  export let isGlobal = false;
  export let isReview = false;

  const dispatch = createEventDispatcher();

  let isEditing = false;
  let editTitle = subtask.title;
  let editIsReview = subtask.is_review ?? false;

  $: tags = getSubtaskTagsByIds(subtask.tags || []);

  function isDeadlinePassed(dateStr) {
    if (!dateStr) return false;
    const today = new Date().toISOString().split("T")[0];
    return dateStr < today;
  }

  function formatDeadline(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/\//g, ".");
  }

  $: isOverdue = isGlobal && subtask.deadline && isDeadlinePassed(subtask.deadline);

  function toggleCompleted() {
    dispatch("toggle", {
      subtaskId: subtask.id,
      isCompleted: !subtask.is_completed,
    });
  }

  function handleDelete() {
    dispatch("delete", { subtaskId: subtask.id });
  }

  function startEdit() {
    editTitle = subtask.title;
    isEditing = true;
  }

  function saveEdit() {
    if (editTitle.trim()) {
      dispatch("edit", {
        subtaskId: subtask.id,
        title: editTitle.trim(),
        is_review: editIsReview,
      });
    }
    isEditing = false;
  }

  function cancelEdit() {
    isEditing = false;
  }

  function handleKeydown(event) {
    const key = event.detail?.key || event.key;
    if (key === "Enter") {
      saveEdit();
    } else if (key === "Escape") {
      cancelEdit();
    }
  }
</script>

<div class="flex items-start gap-2 group py-1">
  <button
    class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5
           {subtask.is_completed
      ? 'bg-primary border-primary'
      : 'border-gray-500 hover:border-primary'}"
    on:click="{toggleCompleted}"
    disabled="{readonly}"
  >
    {#if subtask.is_completed}
      <Check size="{12}" class="text-on-primary" />
    {/if}
  </button>

  {#if isEditing && !readonly}
    <div class="flex-1 flex items-center gap-2">
      <TextInputWithEmoji
        bind:value="{editTitle}"
        placeholder="Subtask title..."
        autofocus="{true}"
        inputClass="text-sm py-1"
        on:keydown="{handleKeydown}"
      />
      <button
        class="p-1 rounded hover:bg-surface-lighter flex-shrink-0"
        on:click="{saveEdit}"
      >
        <Check size="{14}" class="text-primary" />
      </button>
      <button
        class="p-1 rounded hover:bg-surface-lighter flex-shrink-0"
        on:click="{cancelEdit}"
      >
        <X size="{14}" class="text-gray-500" />
      </button>
      <label class="flex items-center gap-1.5 cursor-pointer" title="Mark for spaced-repetition review">
        <input type="checkbox" bind:checked={editIsReview} class="rounded" />
        <BookOpen size={13} class="text-indigo-400" />
        <span class="text-xs text-gray-400">Review</span>
      </label>
    </div>
  {:else}
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1 flex-wrap">
        <span
          class="text-sm {subtask.is_completed
            ? 'line-through text-gray-500'
            : 'text-on-surface'}"
        >
          {subtask.title}
        </span>

        <!-- Tags badges -->
        {#each tags as tag}
          <span
            class="inline-flex items-center px-1.5 py-0.5 rounded text-xs {tag.color} text-white"
          >
            {tag.label}
          </span>
        {/each}

        <!-- Review indicator for review tasks -->
        {#if subtask.is_review}
          <span
            class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-indigo-500/20 text-indigo-400"
          >
            <BookOpen size="{13}" />
            Review
          </span>
        {/if}

        <!-- Deadline badge for global subtasks -->
        {#if isGlobal && subtask.deadline}
          <span
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs
            {isOverdue
              ? 'bg-error/20 text-error'
              : 'bg-primary/20 text-primary'}"
          >
            {#if isOverdue}
              <AlertCircle size="{10}" />
              Overdue ({formatDeadline(subtask.deadline)})
            {:else}
              <Calendar size="{10}" />
              {formatDeadline(subtask.deadline)}
            {/if}
          </span>
        {/if}
      </div>
    </div>

    {#if !readonly}
      <div
        class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      >
        <button
          class="p-1 rounded hover:bg-surface-lighter text-gray-500 hover:text-on-surface"
          on:click="{startEdit}"
          title="Edit subtask"
        >
          <Edit3 size="{14}" />
        </button>
        <button
          class="p-1 rounded hover:bg-surface-lighter text-gray-500 hover:text-error"
          on:click="{handleDelete}"
          title="Delete subtask"
        >
          <Trash2 size="{14}" />
        </button>
      </div>
    {/if}
  {/if}
</div>
