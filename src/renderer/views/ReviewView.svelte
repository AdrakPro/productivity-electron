<script>
  import { onMount } from "svelte";
  import { BookOpen, CheckCircle2, AlertCircle, Clock } from "lucide-svelte";
  import {
    reviews,
    pendingReviews,
    overdueReviews,
    reviewsByDate,
    loadReviews,
    completeReview,
    updateReviewPriority,
  } from "$lib/stores/reviewStore.js";
  import { getPriorityById, priorities } from "$lib/stores/priorityStore.js";
  import PriorityPicker from "$components/common/PriorityPicker.svelte";

  onMount(() => {
    loadReviews();
  });

  function getTodayISO() {
    return new Date().toISOString().split("T")[0];
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return "";
    const date = new Date(dateTimeStr);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).replace(/\//g, ".");
  }

  const reviewColors = {
    1: "bg-blue-500",
    2: "bg-orange-500",
    3: "bg-green-500",
  };

  const reviewLabels = {
    1: "Review 1",
    2: "Review 2",
    3: "Review 3",
  };

  async function handleComplete(reviewId) {
    await completeReview(reviewId);
  }

  async function handlePriorityChange(reviewId, event) {
    const newPriority = event.detail?.priority || event.detail;
    await updateReviewPriority(reviewId, newPriority);
  }

  $: today = getTodayISO();
  $: sortedDates = Object.keys($reviewsByDate).sort();
  $: overdueDates = sortedDates.filter((d) => d < today);
  $: todayDates = sortedDates.filter((d) => d === today);
  $: upcomingDates = sortedDates.filter((d) => d > today);
</script>

<div class="h-full flex flex-col overflow-auto">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-on-surface flex items-center gap-2">
      <BookOpen size="{28}" class="text-indigo-400" />
      Reviews
    </h1>
    <p class="text-gray-400 text-sm mt-1">Spaced repetition review schedule</p>
  </div>

  {#if $pendingReviews.length === 0}
    <div class="card text-center py-12">
      <CheckCircle2 size="{48}" class="text-secondary mx-auto mb-3" />
      <p class="text-on-surface font-medium">All reviews completed!</p>
      <p class="text-gray-400 text-sm mt-1">
        No pending reviews at the moment.
      </p>
    </div>
  {:else}
    <!-- Overdue Reviews -->
    {#if overdueDates.length > 0}
      <div class="mb-6">
        <h2
          class="flex items-center gap-2 text-sm font-semibold text-error mb-3"
        >
          <AlertCircle size="{16}" />
          Overdue ({$overdueReviews.length})
        </h2>
        <div class="space-y-3">
          {#each overdueDates as date}
            {#each $reviewsByDate[date] as review}
              <div class="card border border-error/30 bg-error/5">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3 flex-1 min-w-0">
                    <span
                      class="px-2 py-0.5 rounded text-xs text-white flex-shrink-0 {reviewColors[
                        review.review_number
                      ] || 'bg-gray-500'}"
                    >
                      {reviewLabels[Number(review.review_number)] || "Review"}
                    </span>
                    <div class="min-w-0">
                      <p class="font-medium text-on-surface truncate">
                        {review.subtask_title}
                      </p>
                      <p class="text-xs text-error mt-0.5 flex items-center gap-1">
                        <AlertCircle size="{12}" />
                        Overdue since {formatDate(review.review_date)}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <span class="px-2 py-0.5 rounded text-xs {getPriorityById(review.priority)?.bgLight} {getPriorityById(review.priority)?.textColor}">
                      {getPriorityById(review.priority)?.label}
                    </span>
                    <button
                      class="btn btn-primary btn-sm flex items-center gap-1"
                      on:click="{() => handleComplete(review.id)}"
                    >
                      <CheckCircle2 size="{14}" />
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          {/each}
        </div>
      </div>
    {/if}

    <!-- Today's Reviews -->
    {#if todayDates.length > 0}
      <div class="mb-6">
        <h2
          class="flex items-center gap-2 text-sm font-semibold text-primary mb-3"
        >
          <Clock size="{16}" />
          Due Today ({todayDates.reduce(
            (acc, d) => acc + $reviewsByDate[d].length,
            0,
          )})
        </h2>
        <div class="space-y-3">
          {#each todayDates as date}
            {#each $reviewsByDate[date] as review}
              <div
                class="card border border-primary/30"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3 flex-1 min-w-0">
                      <span
                        class="px-2 py-0.5 rounded text-xs text-white flex-shrink-0 {reviewColors[
                          review.review_number
                        ] || 'bg-gray-500'}"
                      >
                        {reviewLabels[review.review_number] || "Review"}
                      </span>
                    <div class="min-w-0">
                      <p class="font-medium text-on-surface truncate">
                        {review.subtask_title}
                      </p>
                      <p class="text-xs text-primary mt-0.5">Due today</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <PriorityPicker
                      value="{review.priority}"
                      on:change="{(e) => handlePriorityChange(review.id, e)}"
                    />
                    <button
                      class="btn btn-primary btn-sm flex items-center gap-1"
                      on:click="{() => handleComplete(review.id)}"
                    >
                      <CheckCircle2 size="{14}" />
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          {/each}
        </div>
      </div>
    {/if}

    <!-- Upcoming Reviews -->
    {#if upcomingDates.length > 0}
      <div>
        <h2
          class="flex items-center gap-2 text-sm font-semibold text-gray-400 mb-3"
        >
          <BookOpen size="{16}" />
          Upcoming
        </h2>
        <div class="space-y-3">
          {#each upcomingDates as date}
            <div class="mb-4">
              <p class="text-xs text-gray-500 mb-2">{formatDate(date)}</p>
              <div class="space-y-2">
                {#each $reviewsByDate[date] as review}
                  <div class="card">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-start gap-3 flex-1 min-w-0">
                        <span
                          class="px-2 py-0.5 rounded text-xs text-white flex-shrink-0 {reviewColors[
                            review.review_number
                          ] || 'bg-gray-500'}"
                        >
                          {reviewLabels[review.review_number] || "Review"}
                        </span>
                        <div class="min-w-0">
                          <p class="font-medium text-on-surface truncate">
                            {review.subtask_title}
                          </p>
                          <p class="text-xs text-gray-500 mt-0.5">
                            {formatDate(review.review_date)}
                          </p>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 flex-shrink-0">
                        <PriorityPicker
                          value="{review.priority}"
                          on:change="{(e) =>
                            handlePriorityChange(review.id, e)}"
                        />
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .btn-sm {
    padding: 0.25rem 0.75rem;
    font-size: 0.8125rem;
  }
</style>
