import { writable, derived } from "svelte/store";
import { reviewsApi } from "$lib/services/api.js";
import { error as showError } from "./toastStore.js";

// All reviews
export const reviews = writable([]);

// Loading state
export const isLoading = writable(false);

// Derived: pending (incomplete) reviews
export const pendingReviews = derived(reviews, ($reviews) =>
  $reviews.filter((r) => !r.is_completed),
);

// Today's ISO date helper
function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

// Derived: reviews due today (review_date <= today AND not completed)
export const todayReviews = derived(reviews, ($reviews) => {
  const today = getTodayISO();
  return $reviews.filter((r) => r.review_date <= today && !r.is_completed);
});

// Derived: overdue reviews (review_date < today AND not completed)
export const overdueReviews = derived(reviews, ($reviews) => {
  const today = getTodayISO();
  return $reviews.filter((r) => r.review_date < today && !r.is_completed);
});

// Derived: pending reviews grouped by review_date
export const reviewsByDate = derived(pendingReviews, ($pending) => {
  const groups = {};
  for (const review of $pending) {
    if (!groups[review.review_date]) {
      groups[review.review_date] = [];
    }
    groups[review.review_date].push(review);
  }
  return groups;
});

export async function loadReviews() {
  isLoading.set(true);
  try {
    const data = await reviewsApi.getAll();
    reviews.set(data);
  } catch (err) {
    console.error("Failed to load reviews:", err);
    showError("Failed to load reviews");
  } finally {
    isLoading.set(false);
  }
}

export async function loadTodayReviews() {
  try {
    const data = await reviewsApi.getDueToday();
    return data;
  } catch (err) {
    console.error("Failed to load today's reviews:", err);
    return [];
  }
}

export async function completeReview(id) {
  try {
    const result = await reviewsApi.complete(id);
    // Refresh all reviews
    await loadReviews();
    return result;
  } catch (err) {
    console.error("Failed to complete review:", err);
    showError("Failed to complete review");
    throw err;
  }
}

export async function updateReviewPriority(id, priority) {
  try {
    const updated = await reviewsApi.updatePriority(id, priority);
    reviews.update((list) =>
      list.map((r) => (r.id === id ? { ...r, priority } : r)),
    );
    return updated;
  } catch (err) {
    console.error("Failed to update review priority:", err);
    showError("Failed to update review priority");
    throw err;
  }
}
