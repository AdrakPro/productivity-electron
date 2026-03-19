<script>
  import { onMount, onDestroy } from "svelte";
  import {
    Folder,
    FolderPlus,
    RefreshCw,
    FilePlus,
    Pencil,
    Trash2,
    ExternalLink,
    FolderOpen,
  } from "lucide-svelte";
  import { filesApi } from "$lib/services/api.js";
  import FileTreeNode from "./FileTreeNode.svelte";

  let fileTree = null;
  let workingDirectory = null;
  let isLoading = false;
  let error = null;
  let expandedFolders = new Set();

  // Drag and drop state
  let draggedItem = null;
  let dragOverPath = null;
  let rootDropTarget = false;

  // Context menu state
  let contextMenu = {
    show: false,
    x: 0,
    y: 0,
    target: null,
    type: null,
  };

  // Dialog state
  let dialog = {
    show: false,
    type: null,
    targetPath: null,
    targetName: null,
    targetType: null,
    inputValue: "",
    error: null,
  };

  onMount(async () => {
    await loadWorkingDirectory();
    document.addEventListener("click", closeContextMenu);
  });

  onDestroy(() => {
    document.removeEventListener("click", closeContextMenu);
  });

  async function loadWorkingDirectory() {
    try {
      workingDirectory = await filesApi.getWorkingDirectory();
      if (workingDirectory) {
        await refreshFileTree();
      }
    } catch (err) {
      console.error("Failed to load working directory:", err);
      error = err.message;
    }
  }

  async function refreshFileTree() {
    if (!workingDirectory) return;

    isLoading = true;
    error = null;

    try {
      fileTree = await filesApi.getTree(workingDirectory);
    } catch (err) {
      console.error("Failed to load file tree:", err);
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  async function selectDirectory() {
    try {
      const selected = await filesApi.selectDirectory();
      if (selected) {
        workingDirectory = selected;
        expandedFolders.clear();
        await refreshFileTree();
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
      error = err.message;
    }
  }

  async function openInSystemFileManager() {
    if (!workingDirectory) return;

    try {
      await filesApi.openInFileManager(workingDirectory);
    } catch (err) {
      console.error("Failed to open in file manager:", err);
      error = err.message;
    }
  }

  async function showItemInSystemFileManager(itemPath) {
    try {
      await filesApi.showInFileManager(itemPath);
    } catch (err) {
      console.error("Failed to show in file manager:", err);
      error = err.message;
    }
  }

  function toggleFolder(path) {
    if (expandedFolders.has(path)) {
      expandedFolders.delete(path);
    } else {
      expandedFolders.add(path);
    }
    expandedFolders = new Set(expandedFolders);
  }

  async function openFile(filePath) {
    try {
      await filesApi.openFile(filePath);
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }

  // Drag and Drop Handlers
  function handleDragStart(node) {
    draggedItem = node;
  }

  function handleDragOver(path) {
    if (
      draggedItem &&
      draggedItem.path !== path &&
      !path.startsWith(draggedItem.path + "/")
    ) {
      dragOverPath = path;
    }
  }

  function handleDragLeave(path) {
    if (dragOverPath === path) {
      dragOverPath = null;
    }
  }

  function handleRootDragOver(event) {
    event.preventDefault();

    if (draggedItem && workingDirectory) {
      const itemParent = draggedItem.path.substring(
        0,
        draggedItem.path.lastIndexOf("/"),
      );
      if (itemParent !== workingDirectory) {
        rootDropTarget = true;
        event.dataTransfer.dropEffect = "move";
      }
    }
  }

  function handleRootDragLeave(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      rootDropTarget = false;
    }
  }

  async function handleDrop(sourceData, targetPath) {
    dragOverPath = null;
    rootDropTarget = false;

    if (!sourceData || !targetPath) return;

    const sourcePath = sourceData.path;
    const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf("/"));

    if (sourceParent === targetPath) {
      return;
    }

    if (sourceData.isDirectory && targetPath.startsWith(sourcePath)) {
      return;
    }

    try {
      await filesApi.moveItem(sourcePath, targetPath);
      await refreshFileTree();
    } catch (err) {
      console.error("Failed to move item:", err);
      error = err.message;
    }

    draggedItem = null;
  }

  async function handleRootDrop(event) {
    event.preventDefault();
    rootDropTarget = false;

    if (!draggedItem || !workingDirectory) return;

    try {
      const data = JSON.parse(event.dataTransfer.getData("text/plain"));
      await handleDrop(data, workingDirectory);
    } catch (err) {
      console.error("Failed to handle root drop:", err);
    }
  }

  // Context Menu
  function handleContextMenu(event, node, type) {
    event.preventDefault();
    event.stopPropagation();

    contextMenu = {
      show: true,
      x: event.clientX,
      y: event.clientY,
      target: node,
      type: type,
    };
  }

  function handleRootContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    contextMenu = {
      show: true,
      x: event.clientX,
      y: event.clientY,
      target: { path: workingDirectory, name: "" },
      type: "root",
    };
  }

  function closeContextMenu() {
    if (contextMenu.show) {
      contextMenu = { ...contextMenu, show: false };
    }
  }

  function handleOpenInFileManager() {
    closeContextMenu();

    if (contextMenu.type === "root") {
      openInSystemFileManager();
    } else if (contextMenu.type === "folder") {
      filesApi.openInFileManager(contextMenu.target.path);
    } else {
      // For files, show them in the file manager (highlights the file)
      showItemInSystemFileManager(contextMenu.target.path);
    }
  }

  // Dialog Functions
  function openDialog(type) {
    closeContextMenu();

    dialog = {
      show: true,
      type: type,
      targetPath: contextMenu.target.path,
      targetName: contextMenu.target.name,
      targetType: contextMenu.type,
      inputValue: type === "rename" ? contextMenu.target.name : "",
      error: null,
    };
  }

  function closeDialog() {
    dialog = { ...dialog, show: false };
  }

  async function handleDialogSubmit() {
    dialog.error = null;

    try {
      switch (dialog.type) {
        case "newFile":
          if (!dialog.inputValue.trim()) {
            dialog.error = "File name is required";
            return;
          }
          await filesApi.createFile(
            dialog.targetPath,
            dialog.inputValue.trim(),
          );
          break;

        case "newFolder":
          if (!dialog.inputValue.trim()) {
            dialog.error = "Folder name is required";
            return;
          }
          await filesApi.createFolder(
            dialog.targetPath,
            dialog.inputValue.trim(),
          );
          break;

        case "rename":
          if (!dialog.inputValue.trim()) {
            dialog.error = "Name is required";
            return;
          }
          if (dialog.inputValue.trim() === dialog.targetName) {
            closeDialog();
            return;
          }
          await filesApi.rename(dialog.targetPath, dialog.inputValue.trim());
          break;

        case "delete":
          await filesApi.deleteItem(dialog.targetPath);
          break;
      }

      closeDialog();
      await refreshFileTree();
    } catch (err) {
      console.error("Operation failed:", err);
      dialog.error = err.message || "Operation failed";
    }
  }

  function handleDialogKeydown(event) {
    if (event.key === "Enter") {
      handleDialogSubmit();
    } else if (event.key === "Escape") {
      closeDialog();
    }
  }

  function getDialogTitle() {
    switch (dialog.type) {
      case "newFile":
        return "Create New File";
      case "newFolder":
        return "Create New Folder";
      case "rename":
        return "Rename";
      case "delete":
        return "Delete";
      default:
        return "";
    }
  }
</script>

<div class="h-full flex flex-col">
  <!-- Header -->
  <div
    class="flex items-center justify-between p-2 border-b border-surface-lighter"
  >
    <span class="text-xs font-medium text-gray-400 uppercase">Explorer</span>
    <div class="flex items-center gap-1">
      {#if workingDirectory}
        <button
          class="p-1 rounded hover:bg-surface-lighter text-gray-500 hover:text-on-surface transition-colors"
          on:click="{openInSystemFileManager}"
          title="Open in File Manager"
        >
          <ExternalLink size="{14}" />
        </button>
        <button
          class="p-1 rounded hover:bg-surface-lighter text-gray-500 hover:text-on-surface transition-colors"
          on:click="{refreshFileTree}"
          title="Refresh"
        >
          <RefreshCw size="{14}" />
        </button>
      {/if}
      <button
        class="p-1 rounded hover:bg-surface-lighter text-gray-500 hover:text-on-surface transition-colors"
        on:click="{selectDirectory}"
        title="Select Folder"
      >
        <FolderPlus size="{14}" />
      </button>
    </div>
  </div>

  <!-- Content -->
  <div
    class="explorer-content flex-1 overflow-auto p-1"
    class:root-drop-target="{rootDropTarget}"
    on:contextmenu="{workingDirectory ? handleRootContextMenu : null}"
    on:dragover="{workingDirectory ? handleRootDragOver : null}"
    on:dragleave="{handleRootDragLeave}"
    on:drop="{handleRootDrop}"
    role="tree"
  >
    {#if isLoading}
      <div class="flex items-center justify-center py-8">
        <RefreshCw size="{20}" class="animate-spin text-gray-500" />
      </div>
    {:else if error}
      <div class="text-center py-4 px-2">
        <p class="text-sm text-error">{error}</p>
        <button
          class="text-xs text-primary hover:underline mt-2"
          on:click="{refreshFileTree}"
        >
          Try again
        </button>
      </div>
    {:else if !workingDirectory}
      <div class="text-center py-8 px-2">
        <Folder size="{32}" class="mx-auto text-gray-600 mb-2" />
        <p class="text-sm text-gray-500 mb-3">No folder selected</p>
        <button class="btn btn-primary btn-sm" on:click="{selectDirectory}">
          Select Folder
        </button>
      </div>
    {:else if fileTree && fileTree.children}
      {#if fileTree.children.length === 0}
        <div class="text-center py-4">
          <p class="text-sm text-gray-500">Empty folder</p>
          <p class="text-xs text-gray-600 mt-1">Right-click to create files</p>
        </div>
      {:else}
        {#each fileTree.children as node (node.path)}
          <FileTreeNode
            {node}
            {expandedFolders}
            onToggleFolder="{toggleFolder}"
            onOpenFile="{openFile}"
            onContextMenu="{handleContextMenu}"
            onDragStart="{handleDragStart}"
            onDragOver="{handleDragOver}"
            onDragLeave="{handleDragLeave}"
            onDrop="{handleDrop}"
            {dragOverPath}
          />
        {/each}
      {/if}
    {/if}
  </div>
</div>

<!-- Context Menu -->
{#if contextMenu.show}
  <div
    class="fixed bg-surface-light border border-surface-lighter rounded-lg shadow-xl py-1 z-50 min-w-[180px]"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
    on:click|stopPropagation
    role="menu"
  >
    <!-- Open in File Manager - Always available -->
    <button
      class="w-full px-3 py-1.5 text-sm text-left hover:bg-surface-lighter flex items-center gap-2"
      on:click="{handleOpenInFileManager}"
      role="menuitem"
    >
      <ExternalLink size="{14}" />
      {#if contextMenu.type === "file"}
        Show in File Manager
      {:else}
        Open in File Manager
      {/if}
    </button>

    {#if contextMenu.type === "root" || contextMenu.type === "folder"}
      <div class="border-t border-surface-lighter my-1"></div>
      <button
        class="w-full px-3 py-1.5 text-sm text-left hover:bg-surface-lighter flex items-center gap-2"
        on:click="{() => openDialog('newFile')}"
        role="menuitem"
      >
        <FilePlus size="{14}" />
        New File
      </button>
      <button
        class="w-full px-3 py-1.5 text-sm text-left hover:bg-surface-lighter flex items-center gap-2"
        on:click="{() => openDialog('newFolder')}"
        role="menuitem"
      >
        <FolderPlus size="{14}" />
        New Folder
      </button>
    {/if}

    {#if contextMenu.type !== "root"}
      <div class="border-t border-surface-lighter my-1"></div>
      <button
        class="w-full px-3 py-1.5 text-sm text-left hover:bg-surface-lighter flex items-center gap-2"
        on:click="{() => openDialog('rename')}"
        role="menuitem"
      >
        <Pencil size="{14}" />
        Rename
      </button>
      <button
        class="w-full px-3 py-1.5 text-sm text-left hover:bg-surface-lighter flex items-center gap-2 text-error"
        on:click="{() => openDialog('delete')}"
        role="menuitem"
      >
        <Trash2 size="{14}" />
        Delete
      </button>
    {/if}
  </div>
{/if}

<!-- Dialog Modal -->
{#if dialog.show}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    on:click="{closeDialog}"
    on:keydown="{(e) => e.key === 'Escape' && closeDialog()}"
    role="dialog"
    tabindex="-1"
  >
    <div
      class="bg-surface-light rounded-lg shadow-xl p-4 w-80 max-w-[90vw]"
      on:click|stopPropagation
    >
      <h3 class="text-lg font-medium mb-4">{getDialogTitle()}</h3>

      {#if dialog.type === "delete"}
        <p class="text-sm text-gray-400 mb-4">
          Are you sure you want to delete
          <span class="text-on-surface font-medium">"{dialog.targetName}"</span
          >?
          {#if dialog.targetType === "folder"}
            <br /><span class="text-error">
              This will delete all contents inside.
            </span>
          {/if}
        </p>
      {:else}
        <input
          type="text"
          class="input w-full"
          placeholder="{dialog.type === 'newFile'
            ? 'filename.txt'
            : dialog.type === 'newFolder'
              ? 'folder name'
              : 'new name'}"
          bind:value="{dialog.inputValue}"
          on:keydown="{handleDialogKeydown}"
          autofocus
        />
      {/if}

      {#if dialog.error}
        <p class="text-sm text-error mt-2">{dialog.error}</p>
      {/if}

      <div class="flex justify-end gap-2 mt-4">
        <button class="btn btn-ghost" on:click="{closeDialog}"> Cancel </button>
        <button
          class="btn {dialog.type === 'delete'
            ? 'bg-error hover:bg-error/80 text-white'
            : 'btn-primary'}"
          on:click="{handleDialogSubmit}"
        >
          {dialog.type === "delete" ? "Delete" : "Confirm"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  }

  .explorer-content {
    transition:
      background-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .explorer-content.root-drop-target {
    background-color: rgba(187, 134, 252, 0.08);
    box-shadow: inset 0 0 0 2px rgb(187, 134, 252);
  }
</style>
