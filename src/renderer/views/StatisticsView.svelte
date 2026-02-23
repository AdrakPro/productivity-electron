<script>
  import { onMount } from "svelte";
  import {
    BarChart3,
    BookOpen,
    Calendar,
    CheckCircle2,
    Flame,
    TrendingUp,
    Trophy,
  } from "lucide-svelte";
  import {
    loadStatistics,
    statistics,
    streakStatus,
  } from "$lib/stores/statisticsStore.js";
  import { todos } from "$lib/stores/todoStore.js";
  import StreakCalendar from "$components/statistics/StreakCalendar.svelte";
  import StatsCard from "$components/statistics/StatsCard.svelte";

  onMount(() => {
    loadStatistics();
  });

  // Calculate additional stats from todos
  $: totalTodos = $todos.length;
  $: archivedTodos = $todos.filter((t) => t.is_archived).length;
  $: activeTodos = $todos.filter((t) => !t.is_archived).length;
  $: globalTodos = $todos.filter((t) => t.is_global && !t.is_archived).length;
  $: dailyTodos = $todos.filter((t) => !t.is_global && !t.is_archived).length;

  // Completion rate
  $: completionRate =
    totalTodos > 0 ? Math.round((archivedTodos / totalTodos) * 100) : 0;
</script>

<div class="h-full flex flex-col overflow-auto">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-on-surface flex items-center gap-2">
      <BarChart3 size="{28}" />
      Statistics & Streaks
    </h1>
    <p class="text-gray-400 text-sm mt-1">Track your productivity</p>
  </div>

  <!-- Streak Banner -->
  <div
    class="card mb-6 bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="text-4xl">
          {$streakStatus.emoji}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <Flame size="{24}" class="text-orange-500" />
            <span class="text-3xl font-bold text-on-surface">
              {$statistics.current_streak}
            </span>
            <span class="text-gray-400">day streak</span>
          </div>
          <p class="text-sm text-gray-400 mt-1">{$streakStatus.message}</p>
        </div>
      </div>

      <div class="text-right">
        <div class="flex items-center gap-2 text-gray-400">
          <Trophy size="{18}" class="text-yellow-500" />
          <span>Best: {$statistics.longest_streak} days</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Stats Grid -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <StatsCard
      title="Total Completed"
      value="{$statistics.total_completed}"
      icon="{CheckCircle2}"
      iconColor="text-secondary"
    />
    <StatsCard
      title="Active Tasks"
      value="{activeTodos}"
      icon="{TrendingUp}"
      iconColor="text-primary"
    />
    <StatsCard
      title="Daily Tasks"
      value="{dailyTodos}"
      icon="{Calendar}"
      iconColor="text-blue-400"
    />
    <StatsCard
      title="Global Tasks"
      value="{globalTodos}"
      icon="{BarChart3}"
      iconColor="text-purple-400"
    />
    <StatsCard
      title="Total Reviews Done"
      value="{$statistics.total_reviews_completed ?? 0}"
      icon="{BookOpen}"
      iconColor="text-indigo-400"
    />
  </div>

  <!-- Completion Rate -->
  <div class="card mb-6">
    <h3 class="text-sm font-medium text-gray-400 mb-3">
      Overall Completion Rate
    </h3>
    <div class="flex items-center gap-4">
      <div class="flex-1">
        <div class="h-4 bg-surface-lighter rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
            style="width: {completionRate}%"
          ></div>
        </div>
      </div>
      <span class="text-2xl font-bold text-on-surface">{completionRate}%</span>
    </div>
    <p class="text-xs text-gray-500 mt-2">
      {archivedTodos} completed out of {totalTodos} total tasks
    </p>
  </div>

  <!-- Streak Calendar -->
  <div class="card flex-1">
    <h3 class="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
      <Calendar size="{16}" />
      Activity Calendar
    </h3>
    <StreakCalendar />
  </div>
</div>
