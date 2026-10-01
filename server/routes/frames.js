/**
 * Frame management API routes.
 * GET  /api/frames           — list all frames with metadata
 * POST /api/frames           — upload custom frame PNG
 * PUT  /api/frames/:id       — update frame metadata (slots, name)
 * GET  /api/frames/:id/image — serve frame PNG
 */
import { Router } from 'express';
import multer from 'multer';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { FRAMES_DIR } from '../utils.js';

const router = Router();

// Multer for frame PNG uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png') cb(null, true);
    else cb(new Error('Only PNG files are allowed for frames.'));
  },
});

/**
 * Auto-detect transparent rectangular slots from a PNG's alpha channel.
 */
async function detectSlots(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const slots = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixIdx = y * width + x;
      if (visited[pixIdx]) continue;

      const alpha = data[pixIdx * channels + 3];
      if (alpha > 10) continue; // Not transparent enough

      // Flood-fill to find bounding box of transparent region
      let minX = x, maxX = x, minY = y, maxY = y;
      const stack = [[x, y]];
      visited[pixIdx] = 1;

      while (stack.length > 0) {
        const [cx, cy] = stack.pop();

        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        // Check 4 neighbors
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (visited[nIdx]) continue;
          const nAlpha = data[nIdx * channels + 3];
          if (nAlpha > 10) continue;
          visited[nIdx] = 1;
          stack.push([nx, ny]);
        }
      }

      // Only keep regions larger than 50x50 pixels
      const rw = maxX - minX + 1;
      const rh = maxY - minY + 1;
      if (rw > 50 && rh > 50) {
        slots.push({
          id: `slot-${slots.length + 1}`,
          x: minX,
          y: minY,
          width: rw,
          height: rh,
        });
      }
    }
  }

  // Sort slots top-to-bottom, left-to-right
  slots.sort((a, b) => a.y - b.y || a.x - b.x);

  // Re-assign IDs after sorting
  slots.forEach((s, i) => { s.id = `slot-${i + 1}`; });

  return slots;
}

router.get('/', (req, res) => {
  try {
    mkdirSync(FRAMES_DIR, { recursive: true });

    const frameDirs = readdirSync(FRAMES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    const frames = [];
    for (const dir of frameDirs) {
      const metaPath = path.join(FRAMES_DIR, dir.name, 'meta.json');
      if (!existsSync(metaPath)) continue;
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
        frames.push(meta);
      } catch {}
    }

    res.json(frames);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', upload.single('frame'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PNG file uploaded.' });
    }

    const name = req.body.name || 'Custom Frame';
    const id = `custom-${Date.now()}`;
    const dir = path.join(FRAMES_DIR, id);
    mkdirSync(dir, { recursive: true });

    // Save the PNG
    const framePath = path.join(dir, 'frame.png');
    const imgMeta = await sharp(req.file.buffer).metadata();
    await sharp(req.file.buffer).png().toFile(framePath);

    // Auto-detect slots
    const slots = await detectSlots(req.file.buffer);

    const meta = {
      id,
      name,
      width: imgMeta.width,
      height: imgMeta.height,
      printWidth: '4in',
      printHeight: '6in',
      slots,
      custom: true,
    };

    writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));

    res.json(meta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const metaPath = path.join(FRAMES_DIR, id, 'meta.json');
    if (!existsSync(metaPath)) {
      return res.status(404).json({ error: `Frame "${id}" not found.` });
    }

    const existing = JSON.parse(readFileSync(metaPath, 'utf-8'));
    const updates = req.body;

    // Allow updating: name, slots, printWidth, printHeight
    if (updates.name) existing.name = updates.name;
    if (updates.slots) existing.slots = updates.slots;
    if (updates.printWidth) existing.printWidth = updates.printWidth;
    if (updates.printHeight) existing.printHeight = updates.printHeight;

    writeFileSync(metaPath, JSON.stringify(existing, null, 2));
    res.json(existing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/image', (req, res) => {
  const { id } = req.params;
  const framePath = path.join(FRAMES_DIR, id, 'frame.png');
  if (!existsSync(framePath)) {
    return res.status(404).json({ error: `Frame image "${id}" not found.` });
  }
  res.sendFile(framePath);
});

export default router;
