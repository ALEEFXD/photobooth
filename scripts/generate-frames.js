/**
 * Post-install script: generates built-in frame PNGs with transparent slots.
 * Uses sharp to create frames from raw pixel data.
 */
import sharp from 'sharp';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const framesDir = path.join(root, 'frames');

const FRAMES = [
  {
    id: 'classic-strip',
    name: 'CLASSIC STRIP',
    width: 1200,
    height: 1800,
    printWidth: '4in',
    printHeight: '6in',
    borderColor: { r: 255, g: 255, b: 255 },
    slots: [
      { id: 'slot-1', x: 50, y: 56, width: 1100, height: 380 },
      { id: 'slot-2', x: 50, y: 492, width: 1100, height: 380 },
      { id: 'slot-3', x: 50, y: 928, width: 1100, height: 380 },
      { id: 'slot-4', x: 50, y: 1364, width: 1100, height: 380 },
    ],
  },
  {
    id: '2x2-grid',
    name: '2×2 GRID',
    width: 1200,
    height: 1800,
    printWidth: '4in',
    printHeight: '6in',
    borderColor: { r: 255, g: 255, b: 255 },
    slots: [
      { id: 'slot-1', x: 50, y: 300, width: 530, height: 530 },
      { id: 'slot-2', x: 620, y: 300, width: 530, height: 530 },
      { id: 'slot-3', x: 50, y: 870, width: 530, height: 530 },
      { id: 'slot-4', x: 620, y: 870, width: 530, height: 530 },
    ],
  },
  {
    id: 'filmstrip-3',
    name: 'FILMSTRIP',
    width: 1200,
    height: 1800,
    printWidth: '4in',
    printHeight: '6in',
    borderColor: { r: 0, g: 0, b: 0 },
    slots: [
      { id: 'slot-1', x: 50, y: 88, width: 1100, height: 500 },
      { id: 'slot-2', x: 50, y: 650, width: 1100, height: 500 },
      { id: 'slot-3', x: 50, y: 1212, width: 1100, height: 500 },
    ],
  },
  {
    id: 'single-portrait',
    name: 'SINGLE PORTRAIT',
    width: 1200,
    height: 1800,
    printWidth: '4in',
    printHeight: '6in',
    borderColor: { r: 255, g: 255, b: 255 },
    slots: [
      { id: 'slot-1', x: 60, y: 60, width: 1080, height: 1680 },
    ],
  },
];

async function createFrame(frameDef) {
  const { id, width, height, slots, borderColor } = frameDef;
  const dir = path.join(framesDir, id);

  // Skip if already generated
  if (existsSync(path.join(dir, 'frame.png'))) {
    console.log(`[generate-frames] ${id} already exists, skipping.`);
    return;
  }

  mkdirSync(dir, { recursive: true });

  // Build raw RGBA pixel buffer
  const pixels = Buffer.alloc(width * height * 4);
  const r = borderColor.r, g = borderColor.g, b = borderColor.b;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = (py * width + px) * 4;
      let inSlot = false;
      for (const slot of slots) {
        if (px >= slot.x && px < slot.x + slot.width && py >= slot.y && py < slot.y + slot.height) {
          inSlot = true;
          break;
        }
      }
      if (inSlot) {
        // Fully transparent
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      } else {
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = 255;
      }
    }
  }

  await sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(path.join(dir, 'frame.png'));

  // Write metadata JSON
  const meta = {
    id: frameDef.id,
    name: frameDef.name,
    width,
    height,
    printWidth: frameDef.printWidth,
    printHeight: frameDef.printHeight,
    slots: frameDef.slots,
    custom: false,
  };
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));

  console.log(`[generate-frames] Created ${id}`);
}

async function main() {
  mkdirSync(framesDir, { recursive: true });
  for (const frame of FRAMES) {
    await createFrame(frame);
  }
  console.log(`[generate-frames] Done. ${FRAMES.length} frame(s) available.`);
}

main().catch(err => {
  console.error('[generate-frames] Error:', err.message);
  process.exit(1);
});
