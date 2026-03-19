<script>
  import { createEventDispatcher, onMount } from "svelte";
  import { Check, X } from "lucide-svelte";
  import TextInputWithEmoji from "$components/common/TextInputWithEmoji.svelte";
  import TextareaWithEmoji from "$components/common/TextareaWithEmoji.svelte";
  import PriorityPicker from "$components/common/PriorityPicker.svelte";
  import LabelsPicker from "$components/common/LabelsPicker.svelte";
  import LabelIcon from "$components/common/LabelIcon.svelte";
  import { defaultLabels } from "$lib/stores/priorityStore.js";

  const dispatch = createEventDispatcher();

  let title = "";
  let description = "";
  let priority = "none";
  let labels = [];
  let titleInputRef;

  // Expose focus method
  export function focus() {
    setTimeout(() => {
      titleInputRef?.focus?.();
    }, 50);
  }

  onMount(() => {
    focus();
  });

  function handleSubmit() {
    if (title.trim()) {
      dispatch("submit", {
        title: title.trim(),
        description: description.trim(),
        priority,
        labels,
      });
      title = "";
      description = "";
      priority = "none";
      labels = [];
    }
  }

  function handleCancel() {
    dispatch("cancel");
  }

  function handleTitleKeydown(event) {
    const key = event.detail?.key || event.key;
    if (key === "Escape") {
      handleCancel();
    } else if (key === "Enter" && !event.shiftKey) {
      event.preventDefault?.();
      handleSubmit();
    }
  }

  function handleDescKeydown(event) {
    const key = event.detail?.key || event.key;
    if (key === "Escape") {
      handleCancel();
    }
  }

  function handlePriorityChange(event) {
    priority = event.detail.priority;
  }

  function handleLabelsChange(event) {
    labels = event.detail.labels;
  }

  function removeLabel(labelId) {
    labels = labels.filter((id) => id !== labelId);
  }
</script>

<div class="card mb-4 animate-slideDown">
  <div class="space-y-3">
    <TextInputWithEmoji
      bind:value="{title}"
      bind:this="{titleInputRef}"
      placeholder="Task title... 📝"
      autofocus="{true}"
      on:keydown="{handleTitleKeydown}"
    />

    <TextareaWithEmoji
      bind:value="{description}"
      placeholder="Description (optional) ✨"
      rows="{2}"
      on:keydown="{handleDescKeydown}"
    />

    <!-- Priority & Labels Row -->
    <div class="flex items-center gap-4 flex-wrap">
      <!-- Priority Picker -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-400">Priority</span>
        <PriorityPicker
          bind:value="{priority}"
          on:change="{handlePriorityChange}"
        />
      </div>

      <!-- Labels Picker -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-400">Labels</span>
        <LabelsPicker bind:value="{labels}" on:change="{handleLabelsChange}" />
      </div>
    </div>

    <!-- Selected Labels Display -->
    {#if labels.length > 0}
      <div class="flex flex-wrap gap-1">
        {#each labels as labelId}
          {@const label = defaultLabels.find((l) => l.id === labelId)}
          {#if label}
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs {label.color} text-white"
            >
              <LabelIcon icon="{label.icon}" size="{10}" />
              {label.label}
              <button
                type="button"
                class="hover:bg-white/20 rounded-full p-0.5"
                on:click="{() => removeLabel(labelId)}"
              >
                <X size="{10}" />
              </button>
            </span>
          {/if}
        {/each}
      </div>
    {/if}

    <div class="flex gap-2">
      <button
        class="btn btn-primary flex items-center gap-2"
        on:click="{handleSubmit}"
        disabled="{!title.trim()}"
      >
        <Check size="{18}" />
        Add Task
      </button>
      <button
        class="btn btn-ghost flex items-center gap-2"
        on:click="{handleCancel}"
      >
        <X size="{18}" />
        Cancel
      </button>
    </div>
  </div>
</div>
