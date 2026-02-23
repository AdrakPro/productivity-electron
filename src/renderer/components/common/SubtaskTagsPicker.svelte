<script>
  import { createEventDispatcher, tick } from "svelte";
  import { Tag, ChevronDown } from "lucide-svelte";
  import { subtaskTags } from "$lib/stores/priorityStore.js";
  import Portal from "./Portal.svelte";

  export let value = [];

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let buttonRef;
  let dropdownStyle = "";

  $: selectedTags = value
    .map((id) => subtaskTags.find((t) => t.id === id))
    .filter(Boolean);

  function toggleTag(tagId) {
    if (value.includes(tagId)) {
      value = value.filter((id) => id !== tagId);
    } else {
      value = [...value, tagId];
    }
    dispatch("change", { tags: value });
  }

  function handleClickOutside(event) {
    if (isOpen && buttonRef && !buttonRef.contains(event.target)) {
      const dropdown = document.querySelector(".subtask-tags-dropdown-portal");
      if (dropdown && dropdown.contains(event.target)) {
        return;
      }
      isOpen = false;
    }
  }

  async function toggleDropdown(event) {
    event.stopPropagation();
    isOpen = !isOpen;

    if (isOpen) {
      await tick();
      positionDropdown();
    }
  }

  function positionDropdown() {
    if (!buttonRef) return;

    const rect = buttonRef.getBoundingClientRect();
    const dropdownHeight = 280;
    const dropdownWidth = 200;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top, left;

    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      top = rect.top - Math.min(dropdownHeight, spaceAbove - 8) - 4;
    } else {
      top = rect.bottom + 4;
    }

    left = rect.left;
    if (left + dropdownWidth > window.innerWidth) {
      left = window.innerWidth - dropdownWidth - 8;
    }

    dropdownStyle = `top: ${Math.max(4, top)}px; left: ${Math.max(4, left)}px;`;
  }

  function handleScrollOrResize() {
    if (isOpen) {
      positionDropdown();
    }
  }
</script>

<svelte:window
  on:click="{handleClickOutside}"
  on:scroll|capture="{handleScrollOrResize}"
  on:resize="{handleScrollOrResize}"
/>

<div class="tags-picker-container">
  <button
    bind:this="{buttonRef}"
    type="button"
    class="picker-button"
    on:click="{toggleDropdown}"
    title="Tags"
  >
    <Tag size="{14}" class="text-gray-500" />
    {#if selectedTags.length === 0}
      <span class="text-gray-400 text-xs">Tags</span>
    {:else}
      <div class="selected-tags">
        {#each selectedTags.slice(0, 2) as tag}
          <span class="tag-badge {tag.color}">{tag.label}</span>
        {/each}
        {#if selectedTags.length > 2}
          <span class="more-count">+{selectedTags.length - 2}</span>
        {/if}
      </div>
    {/if}
    <ChevronDown size="{12}" class="text-gray-500" />
  </button>
</div>

{#if isOpen}
  <Portal>
    <div
      class="subtask-tags-dropdown-portal"
      style="{dropdownStyle}"
      on:click|stopPropagation
    >
      <div class="dropdown-list">
        {#each subtaskTags as tag}
          <button
            type="button"
            class="dropdown-item"
            on:click|stopPropagation="{() => toggleTag(tag.id)}"
          >
            <span class="tag-color-dot {tag.color}"></span>
            <span class="tag-name">{tag.label}</span>
            {#if value.includes(tag.id)}
              <span class="checkmark">✓</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  </Portal>
{/if}

<style>
  .tags-picker-container {
    position: relative;
    display: inline-block;
  }

  .picker-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 8px;
    border: 1px solid #2d2d2d;
    background: transparent;
    font-size: 13px;
    cursor: pointer;
    transition: background-color 0.15s;
    color: inherit;
  }

  .picker-button:hover {
    background-color: #2d2d2d;
  }

  .selected-tags {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .tag-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 11px;
    color: white;
  }

  .more-count {
    font-size: 11px;
    color: #9ca3af;
  }

  :global(.subtask-tags-dropdown-portal) {
    position: fixed;
    min-width: 180px;
    max-width: 220px;
    background-color: #1e1e1e;
    border: 1px solid #3d3d3d;
    border-radius: 8px;
    box-shadow: 0 10px 50px rgba(0, 0, 0, 0.6);
    z-index: 99999;
    overflow: hidden;
    animation: stportalFadeIn 0.15s ease-out;
  }

  :global(.subtask-tags-dropdown-portal .dropdown-list) {
    max-height: 260px;
    overflow-y: auto;
    padding: 4px 0;
  }

  :global(.subtask-tags-dropdown-portal .dropdown-item) {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 12px;
    font-size: 13px;
    text-align: left;
    background: none;
    border: none;
    color: #ffffff;
    cursor: pointer;
    transition: background-color 0.15s;
  }

  :global(.subtask-tags-dropdown-portal .dropdown-item:hover) {
    background-color: #2d2d2d;
  }

  :global(.subtask-tags-dropdown-portal .tag-color-dot) {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  :global(.subtask-tags-dropdown-portal .tag-name) {
    flex: 1;
  }

  :global(.subtask-tags-dropdown-portal .checkmark) {
    color: #bb86fc;
    font-weight: bold;
  }

  @keyframes -global-stportalFadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
