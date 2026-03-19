<script>
  import { onMount } from "svelte";
  import {
    createTemplate,
    deleteTemplate,
    loadTemplates,
    templates,
    updateTemplate,
  } from "$lib/stores/templateStore.js";
  import {
    addTodo,
    deleteTodo,
    loadTodos,
    todos,
  } from "$lib/stores/todoStore.js";
  import { error as showError, success } from "$lib/stores/toastStore.js";
  import LabelsPicker from "$components/common/LabelsPicker.svelte";
  import PriorityPicker from "$components/common/PriorityPicker.svelte";

  let editing = false;
  let editTemplate = { name: "", description: "", tasks: [] };
  let createMode = false;

  function getNextMonday() {
    const today = new Date();
    const day = today.getDay();
    const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday;
  }

  let weekDates = [];
  $: {
    const monday = getNextMonday();
    weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }

  const weekdayShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function isWeekday(date) {
    const day = new Date(date).getDay();
    return day !== 5 && day !== 6;
  }
  function isWeekend(date) {
    const day = new Date(date).getDay();
    return day === 5 || day === 6;
  }
  function toggleTaskDay(index, date) {
    if (!editTemplate.tasks[index].days) editTemplate.tasks[index].days = [];
    if (editTemplate.tasks[index].days.includes(date)) {
      editTemplate.tasks[index].days = editTemplate.tasks[index].days.filter(
        (d) => d !== date,
      );
    } else {
      editTemplate.tasks[index].days = [
        ...editTemplate.tasks[index].days,
        date,
      ];
    }
  }
  function assignAllDays(index) {
    editTemplate.tasks[index].days = [...weekDates];
  }
  function assignWeekdays(index) {
    editTemplate.tasks[index].days = weekDates.filter(isWeekday);
  }
  function assignWeekends(index) {
    editTemplate.tasks[index].days = weekDates.filter(isWeekend);
  }
  function handleTaskField(index, field, value) {
    if (!editTemplate.tasks[index]) return;
    editTemplate.tasks = editTemplate.tasks.map((task, i) =>
      i === index ? { ...task, [field]: value } : task,
    );
  }
  function addTask() {
    editTemplate.tasks = [
      ...editTemplate.tasks,
      {
        title: "",
        description: "",
        priority: "none",
        labels: [],
        days: [],
      },
    ];
  }
  function removeTask(index) {
    editTemplate.tasks = editTemplate.tasks.filter((_, i) => i !== index);
  }
  function startEdit(template) {
    editing = !!template;
    createMode = true;
    editTemplate = template
      ? { ...template, tasks: template.tasks.map((t) => ({ ...t })) }
      : { name: "", description: "", tasks: [] };
  }
  function cancelEdit() {
    editTemplate = { name: "", description: "", tasks: [] };
    editing = false;
    createMode = false;
  }
  function saveTemplate() {
    if (!editTemplate.name.trim()) {
      showError("Template needs a name");
      return;
    }
    if (editTemplate.tasks.length === 0) {
      showError("Template must have at least one task");
      return;
    }
    if (editing) {
      updateTemplate(editTemplate.id, editTemplate);
      success("Template updated");
    } else {
      createTemplate(editTemplate);
      success("Template created");
    }
    cancelEdit();
  }
  function removeTemplate(id) {
    if (confirm("Delete this template?")) {
      deleteTemplate(id);
      success("Template deleted");
    }
  }

  async function removeTodosForDay(date) {
    for (const todo of $todos) {
      if (!todo.is_global && !todo.is_archived && todo.due_date === date) {
        await deleteTodo(todo.id);
      }
    }
  }

  async function applyTemplate(template) {
    const allDays = Array.from(
      new Set(
        template.tasks.flatMap((t) =>
          t.days && t.days.length > 0 ? t.days : [weekDates[0]],
        ),
      ),
    );

    for (const day of allDays) {
      await removeTodosForDay(day);
    }

    for (const t of template.tasks) {
      if (!t.title.trim()) continue;
      const days = t.days && t.days.length > 0 ? t.days : [weekDates[0]];
      for (const d of days) {
        await addTodo({
          title: t.title,
          description: t.description,
          due_date: d,
          priority: t.priority || "none",
          labels: t.labels || [],
          is_global: false,
        });
      }
    }
    success("Template applied for next week, tasks overwritten for each day!");
    await loadTodos();
  }

  onMount(loadTemplates);
</script>

<div
  class="max-w-5xl mx-auto mt-8 p-6 bg-surface-light rounded-lg shadow-lg text-on-surface font-sans"
>
  <h1 class="text-2xl font-semibold mb-6">Templates</h1>
  <div class="flex flex-wrap gap-4 items-center mb-8">
    <button class="btn btn-primary" on:click="{() => startEdit(null)}">
      Create Template
    </button>
  </div>

  {#if createMode}
    <div
      class="bg-surface rounded-lg p-5 border border-surface-lighter shadow-sm mb-10"
    >
      <h2 class="text-lg font-semibold mb-4">
        {editing ? "Edit Template" : "Create Template"}
      </h2>
      <div class="mb-4">
        <label class="block mb-2 text-on-surface">Name</label>
        <input
          type="text"
          class="input w-full mb-3 bg-surface-lighter border border-surface-lighter text-on-surface"
          bind:value="{editTemplate.name}"
        />
        <label class="block mb-2 text-on-surface">Description</label>
        <textarea
          class="input w-full mb-3 bg-surface-lighter border border-surface-lighter text-on-surface"
          bind:value="{editTemplate.description}"
          rows="2"
          placeholder="Optional"
        ></textarea>
      </div>
      <h3 class="text-lg mb-2">Tasks</h3>
      <ul class="space-y-2 mb-4 w-full overflow-x-auto">
        {#each editTemplate.tasks as task, index (index)}
          <li
            class="flex flex-col gap-2 items-start min-w-max bg-surface-lighter p-3 rounded mb-2"
          >
            <div class="flex gap-2 items-center">
              <input
                type="text"
                class="input w-32 min-w-0 bg-surface-lighter border border-surface-lighter text-on-surface"
                placeholder="Title"
                value="{task.title}"
                on:input="{(e) =>
                  handleTaskField(index, 'title', e.target.value)}"
              />
              <input
                type="text"
                class="input w-32 min-w-0 bg-surface-lighter border border-surface-lighter text-on-surface"
                placeholder="Description"
                value="{task.description}"
                on:input="{(e) =>
                  handleTaskField(index, 'description', e.target.value)}"
              />
              <PriorityPicker
                value="{task.priority}"
                on:change="{(e) =>
                  handleTaskField(index, 'priority', e.detail.priority)}"
              />
              <LabelsPicker
                value="{task.labels}"
                on:change="{(e) =>
                  handleTaskField(index, 'labels', e.detail.labels)}"
              />
              <button
                class="btn btn-error btn-xs"
                on:click="{() => removeTask(index)}"
              >
                Remove
              </button>
            </div>
            <div class="flex items-center gap-2 mt-2 flex-wrap">
              <span class="text-xs text-gray-400 mr-2">Assign to days:</span>
              {#each weekDates as date, i}
                <button
                  class="px-2 py-1 rounded border border-surface-lighter text-xs font-semibold"
                  class:bg-primary="{task.days && task.days.includes(date)}"
                  class:text-on-primary="{task.days &&
                    task.days.includes(date)}"
                  on:click="{() => toggleTaskDay(index, date)}"
                >
                  {weekdayShort[i]}
                </button>
              {/each}
              <button
                class="btn btn-secondary btn-xs ml-2"
                on:click="{() => assignAllDays(index)}">All</button
              >
              <button
                class="btn btn-secondary btn-xs"
                on:click="{() => assignWeekdays(index)}">Weekdays</button
              >
              <button
                class="btn btn-secondary btn-xs"
                on:click="{() => assignWeekends(index)}">Weekends</button
              >
            </div>
          </li>
        {/each}
      </ul>
      <button class="btn btn-secondary mb-4" on:click="{addTask}"
        >Add Task</button
      >
      <div class="flex gap-2 mt-2">
        <button class="btn btn-primary" on:click="{saveTemplate}">Save</button>
        <button class="btn btn-ghost" on:click="{cancelEdit}">Cancel</button>
      </div>
    </div>
  {/if}

  <div class="space-y-8">
    {#each $templates as template (template.id)}
      <div
        class="bg-surface rounded-lg p-5 border border-surface-lighter shadow-sm flex flex-col gap-2"
      >
        <div class="flex justify-between items-start">
          <div>
            <div class="font-bold text-lg text-on-surface">{template.name}</div>
            {#if template.description}
              <div class="text-sm text-gray-400 mt-1">
                {template.description}
              </div>
            {/if}
          </div>
          <div class="flex flex-col gap-2">
            <button
              class="btn btn-primary btn-sm"
              on:click="{() => applyTemplate(template)}">Apply</button
            >
            <button
              class="btn btn-secondary btn-sm"
              on:click="{() => startEdit(template)}">Edit</button
            >
            <button
              class="btn btn-error btn-sm"
              on:click="{() => removeTemplate(template.id)}">Delete</button
            >
          </div>
        </div>
        <ul class="mt-2">
          {#each template.tasks as t}
            <li class="text-sm flex gap-2 items-center mb-1">
              <span class="font-semibold">{t.title}</span>
              {#if t.priority !== "none"}
                <span
                  class="px-2 py-0.5 rounded text-xs"
                  class:bg-blue-500="{t.priority === 'low'}"
                  class:bg-yellow-500="{t.priority === 'medium'}"
                  class:bg-orange-500="{t.priority === 'high'}"
                  class:bg-red-500="{t.priority === 'urgent'}"
                >
                  {t.priority}
                </span>
              {/if}
              {#if t.labels && t.labels.length > 0}
                <span class="text-xs text-gray-400">{t.labels.join(", ")}</span>
              {/if}
              {#if t.days && t.days.length > 0}
                <span class="ml-2 text-xs text-purple-400">
                  {t.days
                    .map((d) => {
                      const i = weekDates.indexOf(d);
                      return i >= 0
                        ? weekdayShort[i]
                        : new Date(d).toLocaleDateString("en-US", {
                            weekday: "short",
                          });
                    })
                    .join(", ")}
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>
</div>
