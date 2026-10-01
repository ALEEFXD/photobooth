/**
 * Folder management API routes.
 * GET   /api/folders        — list all folders
 * POST  /api/folders        — create new folder
 * PATCH /api/folders/active  — set active folder
 */
import { Router } from 'express';
import { readdirSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { getOutputRoot, readConfig, writeConfig } from '../utils.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const outputRoot = getOutputRoot();
    mkdirSync(outputRoot, { recursive: true });

    const folders = readdirSync(outputRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const draftsDir = path.join(outputRoot, d.name, 'drafts');
        const resultsDir = path.join(outputRoot, d.name, 'results');
        let draftCount = 0;
        let resultCount = 0;
        try { draftCount = readdirSync(draftsDir).length; } catch {}
        try { resultCount = readdirSync(resultsDir).length; } catch {}
        return {
          name: d.name,
          draftCount,
          resultCount,
        };
      });

    const config = readConfig();
    res.json({ folders, activeFolder: config.activeFolder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Folder name is required.' });
    }

    // Sanitize: allow only alphanumeric, hyphens, underscores
    const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    if (!sanitized) {
      return res.status(400).json({ error: 'Invalid folder name.' });
    }

    const outputRoot = getOutputRoot();
    const folderPath = path.join(outputRoot, sanitized);
    mkdirSync(path.join(folderPath, 'drafts'), { recursive: true });
    mkdirSync(path.join(folderPath, 'results'), { recursive: true });

    // Set as active folder
    writeConfig({ activeFolder: sanitized });

    res.json({ name: sanitized, message: `Folder "${sanitized}" created and set as active.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/active', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required.' });
    }

    const outputRoot = getOutputRoot();
    const folderPath = path.join(outputRoot, name);
    if (!existsSync(folderPath)) {
      return res.status(404).json({ error: `Folder "${name}" does not exist.` });
    }

    writeConfig({ activeFolder: name });
    res.json({ activeFolder: name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
