/**
 * Camera API routes.
 * GET  /api/camera/status  — detect camera, return type + status
 * POST /api/camera/capture — trigger DSLR capture
 * POST /api/camera/refresh — force re-detection
 */
import { Router } from 'express';
import path from 'path';
import { getStatus, getProvider, refreshCamera, detectCamera, getAvailableProviders, switchCamera } from '../camera/index.js';
import { getActiveFolder, uniqueName } from '../utils.js';

const router = Router();

// Detect camera on first load
detectCamera().catch(console.error);

router.get('/status', async (req, res) => {
  try {
    const status = await getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const status = await refreshCamera();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/providers', async (req, res) => {
  try {
    const providers = getAvailableProviders();
    res.json({ providers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/switch', async (req, res) => {
  try {
    const { type } = req.body;
    if (!type || !['dslr', 'webcam'].includes(type)) {
      return res.status(400).json({ error: 'Invalid camera type. Use "dslr" or "webcam".' });
    }
    const status = await switchCamera(type);
    res.json(status);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/capture', async (req, res) => {
  try {
    const provider = getProvider();
    if (!provider || provider.type === 'webcam') {
      return res.status(400).json({
        error: 'No DSLR connected. Use webcam capture (client-side) instead.',
      });
    }

    const { draftsPath } = getActiveFolder();
    const filename = uniqueName('dslr', '.jpg');
    const outputPath = path.join(draftsPath, filename);

    await provider.capture(outputPath);

    res.json({
      success: true,
      filename,
      path: `/output/${getActiveFolder().name}/drafts/${filename}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
