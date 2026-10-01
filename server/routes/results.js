/**
 * Results API routes.
 * POST /api/results — compose final strip and save as JPEG
 * GET  /api/results — list results in active folder
 */
import { Router } from 'express';
import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { getActiveFolder, uniqueName, FRAMES_DIR } from '../utils.js';
import { compose } from '../compose.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const { resultsPath, name } = getActiveFolder();
    const files = readdirSync(resultsPath)
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map((f) => ({
        filename: f,
        url: `/output/${name}/results/${f}`,
      }));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { frameId, photos } = req.body;

    if (!frameId || !photos || !Array.isArray(photos)) {
      return res.status(400).json({
        error: 'Request body must include frameId and photos array.',
      });
    }

    // Load frame metadata
    const metaPath = path.join(FRAMES_DIR, frameId, 'meta.json');
    if (!existsSync(metaPath)) {
      return res.status(404).json({ error: `Frame "${frameId}" not found.` });
    }
    const frameMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    const framePath = path.join(FRAMES_DIR, frameId, 'frame.png');

    // Resolve photo file paths
    const { draftsPath, resultsPath, name } = getActiveFolder();
    const resolvedPhotos = photos.map((p) => ({
      ...p,
      filePath: path.join(draftsPath, p.draftFile),
    }));

    // Compose and save
    const filename = uniqueName('result', '.jpg');
    const outputPath = path.join(resultsPath, filename);

    await compose(framePath, frameMeta, resolvedPhotos, outputPath);

    res.json({
      success: true,
      filename,
      url: `/output/${name}/results/${filename}`,
    });
  } catch (err) {
    console.error('[results] Compose error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
