const { app, BrowserWindow, Tray, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const {
  initializeDatabase,
  closeDatabase,
} = require("./database/connection.js");
const { ensureInitialUserConfig } = require("./config/appConfig.js");
const { runMigrations } = require("./database/migrations.js");
const { registerAllHandlers } = require("./ipc/handlers.js");

let mainWindow = null;
let tray = null;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// Get the correct icon path for dev and production
function getIconPath() {
  if (isDev) {
    return path.join(__dirname, "..", "..", "resources", "icons", "icon.png");
  } else {
    // In production, resources are in the app's resources folder
    return path.join(process.resourcesPath, "icons", "icon.png");
  }
}

function createWindow() {
  if (mainWindow) return;

  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#121212",
    titleBarStyle: "default",
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load from dist folder
    mainWindow.loadFile(path.join(__dirname, "..", "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (tray === null) {
    createTray();
  }
}

function getLinuxTrayIconPath() {
  const sourceIcon = getIconPath();

  // Copy to userData to avoid /tmp issues on Linux
  const userDataPath = app.getPath("userData");
  const destIcon = path.join(userDataPath, "tray-icon.png");

  try {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    if (fs.existsSync(sourceIcon)) {
      fs.copyFileSync(sourceIcon, destIcon);
      return destIcon;
    }
  } catch (error) {
    console.error("Failed to copy tray icon:", error);
  }

  return sourceIcon;
}

function createTray() {
  let iconPath;

  if (process.platform === "linux") {
    iconPath = getLinuxTrayIconPath();
  } else {
    iconPath = getIconPath();
  }

  if (!iconPath || !fs.existsSync(iconPath)) {
    console.error("Tray icon not found:", iconPath);
    return;
  }

  try {
    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show",
        click: () => mainWindow?.show(),
      },
      {
        label: "Hide",
        click: () => mainWindow?.hide(),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => app.quit(),
      },
    ]);

    tray.setToolTip("Todo Productivity");
    tray.setContextMenu(contextMenu);

    tray.on("click", () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });
  } catch (error) {
    console.error("Failed to create tray:", error);
  }
}

app.whenReady().then(async () => {
  const cfgPath = ensureInitialUserConfig();
  console.log("Config initialized at:", cfgPath);

  app.setName("Todo Productivity");

  try {
    const db = initializeDatabase();
    runMigrations(db);
    const { syncService} = registerAllHandlers(db);
    createWindow();

    setTimeout(() => {
      syncService?.syncNow({ pullFirst: true }).catch((e) => {
        console.error("Startup Dropbox sync failed:", e);
      });
    }, 2000);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error("Failed to initialize app:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  closeDatabase();
  if (tray) {
    tray.destroy();
  }
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});
