const { ipcMain, shell, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

/**
 * Register file-related IPC handlers
 */
function registerFileHandlers(settingsRepo) {
  // Get file tree
  ipcMain.handle("files:getTree", async (event, rootPath) => {
    try {
      if (!rootPath || !fs.existsSync(rootPath)) {
        return null;
      }
      return buildFileTree(rootPath);
    } catch (error) {
      console.error("Error getting file tree:", error);
      throw error;
    }
  });

  // Open file with system default application
  ipcMain.handle("files:openFile", async (event, filePath) => {
    try {
      const result = await shell.openPath(filePath);
      if (result) {
        throw new Error(result);
      }
      return true;
    } catch (error) {
      console.error("Error opening file:", error);
      throw error;
    }
  });

  // Open folder in system file manager
  ipcMain.handle("files:openInFileManager", async (event, folderPath) => {
    try {
      // shell.openPath opens the folder in the default file manager
      const result = await shell.openPath(folderPath);
      if (result) {
        throw new Error(result);
      }
      return true;
    } catch (error) {
      console.error("Error opening in file manager:", error);
      throw error;
    }
  });

  // Show item in file manager (highlights the file/folder)
  ipcMain.handle("files:showInFileManager", async (event, itemPath) => {
    try {
      // shell.showItemInFolder opens the parent folder and selects/highlights the item
      shell.showItemInFolder(itemPath);
      return true;
    } catch (error) {
      console.error("Error showing in file manager:", error);
      throw error;
    }
  });

  // Select directory dialog
  ipcMain.handle("files:selectDirectory", async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const selectedPath = result.filePaths[0];
      settingsRepo.set("workingDirectory", selectedPath);

      return selectedPath;
    } catch (error) {
      console.error("Error selecting directory:", error);
      throw error;
    }
  });

  // Get working directory
  ipcMain.handle("files:getWorkingDirectory", async () => {
    try {
      return settingsRepo.get("workingDirectory", null);
    } catch (error) {
      console.error("Error getting working directory:", error);
      throw error;
    }
  });

  // Set working directory
  ipcMain.handle("files:setWorkingDirectory", async (event, dirPath) => {
    try {
      settingsRepo.set("workingDirectory", dirPath);
      return true;
    } catch (error) {
      console.error("Error setting working directory:", error);
      throw error;
    }
  });

  // Create new file
  ipcMain.handle("files:createFile", async (event, parentPath, fileName) => {
    try {
      const filePath = path.join(parentPath, fileName);

      if (fs.existsSync(filePath)) {
        throw new Error("File already exists");
      }

      fs.writeFileSync(filePath, "");
      return true;
    } catch (error) {
      console.error("Error creating file:", error);
      throw error;
    }
  });

  // Create new folder
  ipcMain.handle(
    "files:createFolder",
    async (event, parentPath, folderName) => {
      try {
        const folderPath = path.join(parentPath, folderName);

        if (fs.existsSync(folderPath)) {
          throw new Error("Folder already exists");
        }

        fs.mkdirSync(folderPath, { recursive: true });
        return true;
      } catch (error) {
        console.error("Error creating folder:", error);
        throw error;
      }
    },
  );

  // Rename file or folder
  ipcMain.handle("files:rename", async (event, oldPath, newName) => {
    try {
      const parentDir = path.dirname(oldPath);
      const newPath = path.join(parentDir, newName);

      if (fs.existsSync(newPath)) {
        throw new Error("A file or folder with this name already exists");
      }

      fs.renameSync(oldPath, newPath);
      return true;
    } catch (error) {
      console.error("Error renaming:", error);
      throw error;
    }
  });

  // Delete file or folder
  ipcMain.handle("files:deleteItem", async (event, itemPath) => {
    try {
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(itemPath);
      }

      return true;
    } catch (error) {
      console.error("Error deleting:", error);
      throw error;
    }
  });

  // Move file or folder
  ipcMain.handle("files:moveItem", async (event, sourcePath, targetFolder) => {
    try {
      const itemName = path.basename(sourcePath);
      const destPath = path.join(targetFolder, itemName);

      if (!fs.existsSync(sourcePath)) {
        throw new Error("Source file or folder does not exist");
      }

      if (fs.existsSync(destPath)) {
        throw new Error(
          `"${itemName}" already exists in the destination folder`,
        );
      }

      if (targetFolder.startsWith(sourcePath + path.sep)) {
        throw new Error("Cannot move a folder into itself");
      }

      if (sourcePath === destPath) {
        throw new Error("Source and destination are the same");
      }

      fs.renameSync(sourcePath, destPath);

      return { success: true, newPath: destPath };
    } catch (error) {
      console.error("Error moving item:", error);
      throw error;
    }
  });

  // Copy file or folder
  ipcMain.handle("files:copyItem", async (event, sourcePath, targetFolder) => {
    try {
      const itemName = path.basename(sourcePath);
      let destPath = path.join(targetFolder, itemName);

      if (!fs.existsSync(sourcePath)) {
        throw new Error("Source file or folder does not exist");
      }

      if (fs.existsSync(destPath)) {
        const ext = path.extname(itemName);
        const baseName = path.basename(itemName, ext);
        let counter = 1;

        while (fs.existsSync(destPath)) {
          destPath = path.join(targetFolder, `${baseName} (${counter})${ext}`);
          counter++;
        }
      }

      const stats = fs.statSync(sourcePath);

      if (stats.isDirectory()) {
        copyFolderRecursive(sourcePath, destPath);
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }

      return { success: true, newPath: destPath };
    } catch (error) {
      console.error("Error copying item:", error);
      throw error;
    }
  });
}

/**
 * Copy folder recursively
 */
function copyFolderRecursive(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  const items = fs.readdirSync(source);

  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    const stats = fs.statSync(sourcePath);

    if (stats.isDirectory()) {
      copyFolderRecursive(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

/**
 * Build a file tree structure from a directory
 */
function buildFileTree(dirPath, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) return null;

  const stats = fs.statSync(dirPath);
  const name = path.basename(dirPath);

  if (
    name.startsWith(".") ||
    ["node_modules", "dist", "build", "__pycache__", ".git", ".svn"].includes(
      name,
    )
  ) {
    return null;
  }

  const node = {
    name,
    path: dirPath,
    isDirectory: stats.isDirectory(),
  };

  if (stats.isDirectory()) {
    try {
      const children = fs
        .readdirSync(dirPath)
        .map((child) =>
          buildFileTree(path.join(dirPath, child), depth + 1, maxDepth),
        )
        .filter(Boolean)
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

      node.children = children;
    } catch (error) {
      node.children = [];
    }
  }

  return node;
}

module.exports = {
  registerFileHandlers,
};
