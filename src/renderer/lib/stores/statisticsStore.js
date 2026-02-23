import { derived, writable } from "svelte/store";
import { statisticsApi, streaksApi } from "$lib/services/api.js";

export const statistics = writable({
  total_completed: 0,
  current_streak: 0,
  longest_streak: 0,
  last_activity_date: null,
  total_reviews_completed: 0,
});

export const streakData = writable([]);

export const isLoading = writable(false);
export const error = writable(null);

export const streakStatus = derived(statistics, ($stats) => {
  if ($stats.current_streak === 0) {
    return {
      status: "inactive",
      message: "Start your streak today!",
      emoji: "🌱",
    };
  } else if (
    $stats.current_streak >= $stats.longest_streak &&
    $stats.current_streak > 1
  ) {
    return {
      status: "record",
      message: "You're on a record streak!",
      emoji: "🏆",
    };
  } else if ($stats.current_streak >= 7) {
    return { status: "hot", message: "Amazing streak!", emoji: "🔥" };
  } else if ($stats.current_streak >= 3) {
    return { status: "good", message: "Keep it going!", emoji: "⭐" };
  } else {
    return { status: "active", message: "Nice start!", emoji: "✨" };
  }
});

export async function loadStatistics() {
  isLoading.set(true);
  error.set(null);

  try {
    const stats = await statisticsApi.get();
    if (stats) {
      statistics.set(stats);
    }

    const streaks = await streaksApi.get();
    if (streaks) {
      streakData.set(streaks);
    }
  } catch (err) {
    console.error("Failed to load statistics:", err);
    error.set(err.message);
  } finally {
    isLoading.set(false);
  }
}

export async function recordCompletion(date) {
  error.set(null);

  try {
    const updatedStats = await streaksApi.recordCompletion(date);
    if (updatedStats) {
      statistics.set(updatedStats);
    }

    const streaks = await streaksApi.get();
    if (streaks) {
      streakData.set(streaks);
    }
  } catch (err) {
    console.error("Failed to record completion:", err);
    error.set(err.message);
  }
}

export async function updateStatistics(data) {
  error.set(null);

  try {
    const updatedStats = await statisticsApi.update(data);
    if (updatedStats) {
      statistics.set(updatedStats);
    }
    return updatedStats;
  } catch (err) {
    console.error("Failed to update statistics:", err);
    error.set(err.message);
    throw err;
  }
}
