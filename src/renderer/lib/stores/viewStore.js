import { writable, derived, get } from "svelte/store";

// Current page: 'main' | 'archive' | 'statistics' | 'settings' | 'reviews'
export const currentPage = writable("main");

// View mode: 'daily' | 'global'
export const viewMode = writable("daily");

// Selected date for daily view (ISO string: YYYY-MM-DD)
function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const selectedDate = writable(getTodayISO());

// Helper to parse date without timezone issues
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Helper to format date to YYYY-MM-DD
function formatDateToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Derived store for display-friendly date
export const selectedDateFormatted = derived(selectedDate, ($date) => {
  const date = parseLocalDate($date);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Short formatted date (DD.MM.YYYY)
export const selectedDateShort = derived(selectedDate, ($date) => {
  const date = parseLocalDate($date);
  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, ".");
});

// Check if selected date is today
export const isToday = derived(selectedDate, ($date) => {
  return $date === getTodayISO();
});

// Check if selected date is in the past
export const isPastDate = derived(selectedDate, ($date) => {
  return $date < getTodayISO();
});

// Check if selected date is in the future
export const isFutureDate = derived(selectedDate, ($date) => {
  return $date > getTodayISO();
});

// Navigation functions for daily view
export function goToPreviousDay() {
  selectedDate.update((current) => {
    const date = parseLocalDate(current);
    date.setDate(date.getDate() - 1);
    return formatDateToISO(date);
  });
}

export function goToNextDay() {
  selectedDate.update((current) => {
    const date = parseLocalDate(current);
    date.setDate(date.getDate() + 1);
    return formatDateToISO(date);
  });
}

export function goToToday() {
  selectedDate.set(getTodayISO());
}
