/**
 * Shared utilities: config read/write, path helpers.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const CONFIG_PATH = path.join(ROOT, 'config.json');
export const FRAMES_DIR = path.join(ROOT, 'frames');

/**
 * Read config.json, creating defaults if missing.
 */
export function readConfig() {
  const defaults = {
    activeFolder: 'default',
    captureDelay: 8,
    captureMode: 'timer',
    outputRoot: './output',
  };
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  try {
    return { ...defaults, ...JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) };
  } catch {
    return defaults;
  }
}

/**
 * Write config.json (merge with existing).
 */
export function writeConfig(updates) {
  const current = readConfig();
  const merged = { ...current, ...updates };
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

/**
 * Resolve the output root to an absolute path.
 */
export function getOutputRoot() {
  const config = readConfig();
  return path.resolve(ROOT, config.outputRoot);
}

/**
 * Get the active folder's absolute path, creating it if needed.
 */
export function getActiveFolder() {
  const config = readConfig();
  const folderPath = path.join(getOutputRoot(), config.activeFolder);
  const draftsPath = path.join(folderPath, 'drafts');
  const resultsPath = path.join(folderPath, 'results');
  mkdirSync(draftsPath, { recursive: true });
  mkdirSync(resultsPath, { recursive: true });
  return { folderPath, draftsPath, resultsPath, name: config.activeFolder };
}

/**
 * Generate a unique filename with timestamp.
 */
export function uniqueName(prefix = 'photo', ext = '.jpg') {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${ts}-${rand}${ext}`;
}
