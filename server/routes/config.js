/**
 * Config API routes.
 * GET   /api/config — read current config
 * PATCH /api/config — update config fields
 */
import { Router } from 'express';
import { readConfig, writeConfig } from '../utils.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const config = readConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/', (req, res) => {
  try {
    const allowedKeys = ['activeFolder', 'captureDelay', 'captureMode', 'outputRoot'];
    const updates = {};

    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid config fields provided.' });
    }

    const config = writeConfig(updates);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
