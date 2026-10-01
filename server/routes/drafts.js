/**
 * Drafts API routes.
 * GET    /api/drafts            — list drafts in active folder
 * POST   /api/drafts            — save a draft image (base64 or multipart)
 * DELETE /api/drafts/:filename  — delete a draft
 */
import { Router } from 'express';
import multer from 'multer';
import { readdirSync, unlinkSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { getActiveFolder, uniqueName, readConfig } from '../utils.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

router.get('/', (req, res) => {
  try {
    const { draftsPath, name } = getActiveFolder();
    const files = readdirSync(draftsPath)
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map((f) => ({
        filename: f,
        url: `/output/${name}/drafts/${f}`,
      }));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', upload.single('photo'), (req, res) => {
  try {
    const { draftsPath, name } = getActiveFolder();
    let filename;

    if (req.file) {
      // Multipart upload
      filename = uniqueName('photo', '.jpg');
      const dest = path.join(draftsPath, filename);
      writeFileSync(dest, req.file.buffer);
    } else if (req.body.image) {
      // Base64 upload (from webcam capture)
      const base64 = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      filename = uniqueName('photo', '.jpg');
      const dest = path.join(draftsPath, filename);
      writeFileSync(dest, buffer);
    } else {
      return res.status(400).json({ error: 'No image provided. Send as multipart or base64.' });
    }

    res.json({
      success: true,
      filename,
      url: `/output/${name}/drafts/${filename}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:filename', (req, res) => {
  try {
    const { draftsPath } = getActiveFolder();
    const filePath = path.join(draftsPath, req.params.filename);

    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Draft not found.' });
    }

    unlinkSync(filePath);
    res.json({ success: true, message: 'Draft deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
