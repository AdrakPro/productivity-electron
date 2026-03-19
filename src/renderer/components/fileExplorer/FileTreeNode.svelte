<script>
  import {
    Folder,
    FolderOpen,
    File,
    ChevronRight,
    ChevronDown,
  } from "lucide-svelte";

  export let node;
  export let expandedFolders;
  export let onToggleFolder;
  export let onOpenFile;
  export let onContextMenu;
  export let onDragStart;
  export let onDragOver;
  export let onDragLeave;
  export let onDrop;
  export let dragOverPath = null;
  export let depth = 0;

  let isDragging = false;

  function handleDragStart(event) {
    isDragging = true;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        path: node.path,
        name: node.name,
        isDirectory: node.isDirectory,
      }),
    );
    onDragStart(node);
  }

  function handleDragEnd() {
    isDragging = false;
  }

  function handleDragOver(event) {
    // Only allow drop on folders
    if (node.isDirectory) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      onDragOver(node.path);
    }
  }

  function handleDragLeave(event) {
    // Check if we're leaving the element (not entering a child)
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      onDragLeave(node.path);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    if (node.isDirectory) {
      try {
        const data = JSON.parse(event.dataTransfer.getData("text/plain"));
        onDrop(data, node.path);
      } catch (err) {
        console.error("Failed to parse drag data:", err);
      }
    }
  }

  $: isDropTarget = dragOverPath === node.path && node.isDirectory;
</script>

{#if node.isDirectory}
  <div class="select-none">
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="w-full flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer transition-colors
        {isDropTarget
        ? 'bg-primary/30 ring-2 ring-primary'
        : 'hover:bg-surface-lighter'}
        {isDragging ? 'opacity-50' : ''}"
      style="padding-left: {depth * 12 + 8}px;"
      draggable="true"
      on:click="{() => onToggleFolder(node.path)}"
      on:contextmenu="{(e) => onContextMenu(e, node, 'folder')}"
      on:dragstart="{handleDragStart}"
      on:dragend="{handleDragEnd}"
      on:dragover="{handleDragOver}"
      on:dragleave="{handleDragLeave}"
      on:drop="{handleDrop}"
      role="treeitem"
      tabindex="0"
      on:keydown="{(e) => e.key === 'Enter' && onToggleFolder(node.path)}"
    >
      <span class="text-gray-500 flex-shrink-0">
        {#if expandedFolders.has(node.path)}
          <ChevronDown size="{14}" />
        {:else}
          <ChevronRight size="{14}" />
        {/if}
      </span>
      <span class="flex-shrink-0">
        {#if expandedFolders.has(node.path)}
          <FolderOpen size="{14}" class="text-primary" />
        {:else}
          <Folder size="{14}" class="text-primary" />
        {/if}
      </span>
      <span class="truncate flex-1 text-left">{node.name}</span>
    </div>

    {#if expandedFolders.has(node.path) && node.children}
      {#each node.children as child (child.path)}
        <svelte:self
          node="{child}"
          {expandedFolders}
          {onToggleFolder}
          {onOpenFile}
          {onContextMenu}
          {onDragStart}
          {onDragOver}
          {onDragLeave}
          {onDrop}
          {dragOverPath}
          depth="{depth + 1}"
        />
      {/each}
    {/if}
  </div>
{:else}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="w-full flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer select-none transition-colors
      {isDragging ? 'opacity-50' : 'hover:bg-surface-lighter'}"
    style="padding-left: {depth * 12 + 28}px;"
    draggable="true"
    on:dblclick="{() => onOpenFile(node.path)}"
    on:contextmenu="{(e) => onContextMenu(e, node, 'file')}"
    on:dragstart="{handleDragStart}"
    on:dragend="{handleDragEnd}"
    role="treeitem"
    tabindex="0"
    on:keydown="{(e) => e.key === 'Enter' && onOpenFile(node.path)}"
  >
    <File size="{14}" class="text-gray-500 flex-shrink-0" />
    <span class="truncate flex-1 text-left">{node.name}</span>
  </div>
{/if}
