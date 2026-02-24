<script>
  import {
    Archive,
    BarChart3,
    BookOpen,
    Calendar,
    Globe,
    Home,
    Settings,
  } from "lucide-svelte";
  import { currentPage, viewMode } from "$lib/stores/viewStore.js";

  function navigateTo(page) {
    currentPage.set(page);
  }

  function toggleViewMode() {
    viewMode.update((current) => (current === "daily" ? "global" : "daily"));
  }
</script>

<header class="bg-surface-light border-b border-surface-lighter px-4 py-3">
  <div class="flex items-center">
    <!-- Left: View Mode Toggle -->
    <div class="flex-1">
      <button
        class="btn btn-ghost flex items-center gap-2 px-3 py-2"
        on:click="{toggleViewMode}"
        title="Switch to {$viewMode === 'daily' ? 'Global' : 'Daily'} view"
      >
        {#if $viewMode === "daily"}
          <Calendar size="{20}" class="text-primary" />
          <span class="text-sm font-medium">Daily</span>
        {:else}
          <Globe size="{20}" class="text-secondary" />
          <span class="text-sm font-medium">Global</span>
        {/if}
      </button>
    </div>

    <!-- Center: Navigation -->
    <nav class="flex items-center gap-2">
      <button
        class="btn btn-ghost flex items-center gap-2 {$currentPage === 'main'
          ? 'bg-surface-lighter text-primary'
          : ''}"
        on:click="{() => navigateTo('main')}"
      >
        <Home size="{18}" />
        <span>Home</span>
      </button>
<!--      <button-->
<!--        class="btn btn-ghost flex items-center gap-2 {$currentPage === 'archive'-->
<!--          ? 'bg-surface-lighter text-primary'-->
<!--          : ''}"-->
<!--        on:click="{() => navigateTo('archive')}"-->
<!--      >-->
<!--        <Archive size="{18}" />-->
<!--        <span>Archive</span>-->
<!--      </button>-->
      <button
        class="btn btn-ghost flex items-center gap-2 {$currentPage === 'reviews'
          ? 'bg-surface-lighter text-primary'
          : ''}"
        on:click="{() => navigateTo('reviews')}"
      >
        <BookOpen size="{18}" />
        <span>Reviews</span>
      </button>
      <button
        class="btn btn-ghost flex items-center gap-2 {$currentPage ===
        'statistics'
          ? 'bg-surface-lighter text-primary'
          : ''}"
        on:click="{() => navigateTo('statistics')}"
      >
        <BarChart3 size="{18}" />
        <span>Statistics</span>
      </button>
    </nav>

    <!-- Right: Settings -->
    <div class="flex-1 flex justify-end">
      <button
        class="btn btn-ghost flex items-center gap-2 px-3 py-2 {$currentPage ===
        'settings'
          ? 'bg-surface-lighter text-primary'
          : ''}"
        on:click="{() => navigateTo('settings')}"
        title="Settings"
      >
        <Settings size="{20}" />
      </button>
    </div>
  </div>
</header>
