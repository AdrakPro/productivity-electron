const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function getUserConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function ensureInitialUserConfig() {
  const file = getUserConfigPath();
  if (fs.existsSync(file)) return file;

  fs.mkdirSync(path.dirname(file), { recursive: true });

  const initial = {
    dropboxAppKey: "xtelvdn4x1ts5xu",
  };

  fs.writeFileSync(file, JSON.stringify(initial, null, 2), "utf8");
  return file;
}

function loadAppConfig() {
  const file = ensureInitialUserConfig();
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

module.exports = {
  getUserConfigPath,
  ensureInitialUserConfig,
  loadAppConfig,
};
