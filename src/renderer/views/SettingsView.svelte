<script>
  import { onMount } from "svelte";
  import {
    Settings,
    Folder,
    Power,
    Info,
    FolderOpen,
    X,
    Download,
    Upload,
    Keyboard,
    Trash2,
    AlertTriangle,
    RefreshCw,
    HardDriveDownload,
  } from "lucide-svelte";
  import {
    settings,
    loadSettings,
    setAutoLaunch,
  } from "$lib/stores/settingsStore.js";
  import {
    workingDirectory,
    selectWorkingDirectory,
    clearWorkingDirectory,
    loadWorkingDirectory,
  } from "$lib/stores/fileStore.js";
  import { exportTodos, importTodos } from "$lib/stores/todoStore.js";
  import { appApi } from "$lib/services/api.js";
  import ToggleSwitch from "$components/common/ToggleSwitch.svelte";
  import {
    syncConfig,
    loadSyncConfig,
    syncLastSyncAt,
    saveSyncConfig,
    refreshSyncStatus,
  } from "$lib/stores/syncStore.js";
  let fileInput;

  // Local sync form state
  let syncBackupFolderPath = "";
  let syncKeepBackups = 5;
  let syncSaving = false;

  // Clear data dialog state
  let showClearDataDialog = false;
  let clearDataConfirmText = "";
  let isClearing = false;
  let clearError = null;

  onMount(async () => {
    loadSettings();
    loadWorkingDirectory();

    await loadSyncConfig();
    await refreshSyncStatus(true);

    const cfg = $syncConfig;
    syncBackupFolderPath = cfg.backupFolderPath || "";
    syncKeepBackups = Number(cfg.keepBackups || 5);
  });

  async function handleAutoLaunchChange(event) {
    await setAutoLaunch(event.detail.checked);
  }

  async function handleSelectFolder() {
    await selectWorkingDirectory();
  }

  async function handleClearFolder() {
    await clearWorkingDirectory();
  }

  function handleExport() {
    exportTodos();
  }

  function handleImportClick() {
    fileInput?.click();
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0];
    if (file) {
      await importTodos(file);
      event.target.value = "";
    }
  }

  async function handleSaveSyncSettings() {
    syncSaving = true;
    try {
      await saveSyncConfig({
        backupFolderPath: syncBackupFolderPath?.trim() || "",
        keepBackups: Math.max(1, Number(syncKeepBackups || 5)),
      });
      await refreshSyncStatus(true);
    } finally {
      syncSaving = false;
    }
  }

  // Clear data functions
  function openClearDataDialog() {
    showClearDataDialog = true;
    clearDataConfirmText = "";
    clearError = null;
  }

  function closeClearDataDialog() {
    showClearDataDialog = false;
    clearDataConfirmText = "";
    clearError = null;
  }

  async function handleClearAllData() {
    if (clearDataConfirmText !== "DELETE") {
      clearError = 'Please type "DELETE" to confirm';
      return;
    }

    isClearing = true;
    clearError = null;

    try {
      await appApi.clearAllData();
      closeClearDataDialog();

      // Restart the app to reinitialize with fresh data
      await appApi.quit();
    } catch (error) {
      console.error("Failed to clear data:", error);
      clearError = error.message || "Failed to clear data";
    } finally {
      isClearing = false;
    }
  }

  function handleClearDialogKeydown(event) {
    if (event.key === "Enter" && clearDataConfirmText === "DELETE") {
      handleClearAllData();
    } else if (event.key === "Escape") {
      closeClearDataDialog();
    }
  }
</script>

<div class="h-full flex flex-col overflow-auto">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-on-surface flex items-center gap-2">
      <Settings size="{28}" />
      Settings
    </h1>
    <p class="text-gray-400 text-sm mt-1">Configure your app preferences</p>
  </div>

  <!-- Settings Sections -->
  <div class="space-y-6">
    <!-- Startup Section -->
    <div class="card animate-fadeIn">
      <h3
        class="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2"
      >
        <Power size="{16}" />
        Startup
      </h3>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-on-surface font-medium">Launch at startup</p>
          <p class="text-sm text-gray-500">
            Automatically start the app when you log in
          </p>
        </div>

        <ToggleSwitch
          checked="{$settings.autoLaunch}"
          on:change="{handleAutoLaunchChange}"
        />
      </div>
    </div>

    <!-- Local Backup Section -->
    <div class="card animate-fadeIn" style="animation-delay: 25ms">
      <h3
        class="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2"
      >
        <HardDriveDownload size="{16}" />
        Local Backups
      </h3>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-on-surface font-medium">Automatic backup interval</p>
            <p class="text-sm text-gray-500">
              Backups are saved every 5 minutes and when app closes
            </p>
          </div>
        </div>

        <div>
          <label class="block text-sm text-gray-400 mb-2">Backup folder path</label>
          <input
            type="text"
            class="w-full bg-surface-lighter border border-surface-lighter rounded-lg px-3 py-2 text-on-surface"
            bind:value="{syncBackupFolderPath}"
            placeholder="Default app userData/backups"
          />
        </div>

        <div>
          <label class="block text-sm text-gray-400 mb-2">Backups to keep</label>
          <input
            type="number"
            min="1"
            class="w-full bg-surface-lighter border border-surface-lighter rounded-lg px-3 py-2 text-on-surface"
            bind:value="{syncKeepBackups}"
          />
        </div>

        <div class="flex gap-3">
          <button
            class="btn btn-ghost flex items-center gap-2"
            on:click="{handleSaveSyncSettings}"
            disabled="{syncSaving}"
          >
            <HardDriveDownload size="{16}" />
            {syncSaving ? "Saving..." : "Save Backup Settings"}
          </button>

          {#if $syncLastSyncAt}
            <p class="text-xs text-gray-500">
              Last backup: {new Date($syncLastSyncAt).toLocaleString()}
            </p>
          {/if}
        </div>
      </div>
    </div>

    <!-- File Explorer Section -->
    <div class="card animate-fadeIn" style="animation-delay: 50ms">
      <h3
        class="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2"
      >
        <Folder size="{16}" />
        File Explorer
      </h3>

      <div class="space-y-4">
        <div>
          <p class="text-on-surface font-medium mb-2">Working Directory</p>
          <p class="text-sm text-gray-500 mb-3">
            Select a folder to browse in the file explorer sidebar
          </p>

          {#if $workingDirectory}
            <div class="flex items-center gap-2">
              <div
                class="flex-1 bg-surface-lighter rounded-lg px-3 py-2 text-sm truncate"
              >
                <span class="text-gray-400">📁</span>
                <span class="ml-2 text-on-surface">{$workingDirectory}</span>
              </div>
              <button
                class="btn btn-ghost p-2"
                on:click="{handleClearFolder}"
                title="Remove folder"
              >
                <X size="{18}" />
              </button>
            </div>
          {:else}
            <button
              class="btn btn-ghost flex items-center gap-2"
              on:click="{handleSelectFolder}"
            >
              <FolderOpen size="{18}" />
              Select Folder
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Data Management Section -->
    <div class="card animate-fadeIn" style="animation-delay: 100ms">
      <h3
        class="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2"
      >
        <Download size="{16}" />
        Data Management
      </h3>

      <div class="space-y-6">
        <div>
          <p class="text-on-surface font-medium mb-2">Export & Import</p>
          <p class="text-sm text-gray-500 mb-3">
            Backup your tasks or restore from a previous backup
          </p>

          <div class="flex gap-3">
            <button
              class="btn btn-ghost flex items-center gap-2"
              on:click="{handleExport}"
            >
              <Download size="{18}" />
              Export Data
            </button>

            <button
              class="btn btn-ghost flex items-center gap-2"
              on:click="{handleImportClick}"
            >
              <Upload size="{18}" />
              Import Data
            </button>

            <input
              bind:this="{fileInput}"
              type="file"
              accept=".json"
              class="hidden"
              on:change="{handleFileSelected}"
            />
          </div>
        </div>

        <div class="pt-4 border-t border-surface-lighter">
          <p class="text-on-surface font-medium mb-2 text-error">Danger Zone</p>
          <p class="text-sm text-gray-500 mb-3">
            Permanently delete all your data including todos, statistics, and
            settings. This action cannot be undone.
          </p>

          <button
            class="btn btn-danger flex items-center gap-2"
            on:click="{openClearDataDialog}"
          >
            <Trash2 size="{18}" />
            Clear All Data
          </button>
        </div>
      </div>
    </div>

    <!-- Keyboard Shortcuts -->
    <div class="card animate-fadeIn" style="animation-delay: 150ms">
      <h3
        class="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2"
      >
        <Keyboard size="{16}" />
        Keyboard Shortcuts
      </h3>
      <div class="space-y-2 text-sm">
        <div class="flex items-center justify-between py-1">
          <span class="text-gray-400">New task</span>
          <div class="flex gap-1 items-center">
            <kbd class="px-2 py-1 bg-surface-lighter rounded text-xs">N</kbd>
            <span class="text-gray-600 text-xs">or</span>
            <kbd class="px-2 py-1 bg-surface-lighter rounded text-xs">Ctrl</kbd>
            <span class="text-gray-600 text-xs">+</span>
            <kbd class="px-2 py-1 bg-surface-lighter rounded text-xs">N</kbd>
          </div>
        </div>
      </div>
    </div>

    <!-- About Section -->
    <div class="card animate-fadeIn" style="animation-delay: 200ms">
      <h3
        class="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2"
      >
        <Info size="{16}" />
        About
      </h3>
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-gray-400">Version</span>
          <span class="text-on-surface">{$settings.appVersion}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-gray-400">Built with</span>
          <span class="text-on-surface">Electron + Svelte + SQLite</span>
        </div>
      </div>
    </div>
  </div>
</div>

{#if showClearDataDialog}
  <div
    class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fadeIn"
    on:click="{closeClearDataDialog}"
    on:keydown="{handleClearDialogKeydown}"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div
      class="bg-surface-light rounded-xl shadow-2xl p-6 w-[420px] max-w-[90vw] animate-scaleIn"
      on:click|stopPropagation
    >
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 bg-error/20 rounded-lg">
          <AlertTriangle size="{24}" class="text-error" />
        </div>
        <div>
          <h3 class="text-xl font-bold text-on-surface">Clear All Data</h3>
          <p class="text-sm text-gray-500">This action is irreversible</p>
        </div>
      </div>

      <div class="mb-5">
        <p class="text-gray-300 mb-3">
          This will permanently delete all of your data:
        </p>
      </div>

      <div class="mb-5">
        <label class="block text-sm text-gray-400 mb-2">
          Type
          <span
            class="font-bold text-on-surface bg-surface-lighter px-1.5 py-0.5 rounded"
            >DELETE</span
          >
          to confirm:
        </label>
        <input
          type="text"
          class="w-full bg-surface-lighter border border-surface-lighter rounded-lg px-4 py-2.5 text-on-surface"
          placeholder="Type DELETE here"
          bind:value="{clearDataConfirmText}"
          on:keydown="{handleClearDialogKeydown}"
          autofocus
        />
      </div>

      {#if clearError}
        <div class="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg">
          <p class="text-sm text-error">{clearError}</p>
        </div>
      {/if}

      <div class="flex justify-end gap-3">
        <button
          class="btn btn-ghost px-4 py-2"
          on:click="{closeClearDataDialog}"
          disabled="{isClearing}"
        >
          Cancel
        </button>
        <button
          class="btn btn-danger px-4 py-2 flex items-center gap-2"
          on:click="{handleClearAllData}"
          disabled="{isClearing || clearDataConfirmText !== 'DELETE'}"
        >
          {#if isClearing}
            <RefreshCw size="{16}" class="animate-spin" />
            Clearing...
          {:else}
            <Trash2 size="{16}" />
            Clear All Data
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .btn-danger {
    background-color: rgba(207, 102, 121, 0.2);
    color: #cf6679;
    border: 1px solid rgba(207, 102, 121, 0.3);
  }
  .btn-danger:hover:not(:disabled) {
    background-color: rgba(207, 102, 121, 0.3);
  }
  .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
