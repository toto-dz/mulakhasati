const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, 'data', 'settings.json');
const DEFAULT_SETTINGS = {
  openrouter: {
    apiKey: "",
    model: ""
  }
};

/**
 * Ensures that the settings file exists. If not, it creates it with default settings.
 */
function ensureSettingsExist() {
    if (!fs.existsSync(SETTINGS_PATH)) {
        const dir = path.dirname(SETTINGS_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
    }
}

/**
 * Reads settings from the settings.json file.
 * Creates the file with default settings if it doesn't exist.
 * @returns {Object} The settings object.
 */
function readSettings() {
    ensureSettingsExist();
    try {
        const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading settings file:', error);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Saves settings to the settings.json file.
 * Creates the file if it doesn't exist.
 * @param {Object} newSettings - The new settings object to merge or replace.
 * @returns {boolean} True if successful, false otherwise.
 */
function saveSettings(newSettings) {
    ensureSettingsExist();
    try {
        const currentSettings = readSettings();
        const updatedSettings = { ...currentSettings, ...newSettings };
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updatedSettings, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving settings file:', error);
        return false;
    }
}

module.exports = {
    readSettings,
    saveSettings,
    ensureSettingsExist
};
