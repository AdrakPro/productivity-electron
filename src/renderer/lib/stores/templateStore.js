import { writable } from "svelte/store";
import { templatesApi } from "$lib/services/api.js";

export const templates = writable([]);

export async function loadTemplates() {
  templates.set(await templatesApi.getAll());
}

export async function createTemplate(template) {
  await templatesApi.create(template);
  await loadTemplates();
}

export async function updateTemplate(id, template) {
  await templatesApi.update(id, template);
  await loadTemplates();
}

export async function deleteTemplate(id) {
  await templatesApi.delete(id);
  await loadTemplates();
}
