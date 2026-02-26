const { ipcMain } = require("electron");

/**
 * Register template-related IPC handlers
 * @param {TemplateRepository} templateRepo
 */
function registerTemplateHandlers(templateRepo) {
  ipcMain.handle("templates:getAll", async () => {
    return templateRepo.getAll();
  });

  ipcMain.handle("templates:getById", async (event, id) => {
    return templateRepo.getById(id);
  });

  ipcMain.handle("templates:create", async (event, template) => {
    return templateRepo.create(template);
  });

  ipcMain.handle("templates:update", async (event, id, template) => {
    return templateRepo.update(id, template);
  });

  ipcMain.handle("templates:delete", async (event, id) => {
    return templateRepo.delete(id);
  });
}

module.exports = { registerTemplateHandlers };
