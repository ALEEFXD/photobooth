/**
 * Server-side image compositor using sharp.
 * Replicates the client-side canvas compositing for final JPEG export.
 */
import sharp from 'sharp';
import path from 'path';
import { readFileSync, existsSync } from 'fs';

/**
 * Process a single photo to fit a slot with transforms and adjustments.
 */
async function processPhotoForSlot(photoPath, slot, transform = {}, adjustments = {}) {
  if (!existsSync(photoPath)) {
    throw new Error(`Photo not found: ${photoPath}`);
  }

  // Step 1: Load and get original metadata
  let pipeline = sharp(photoPath);
  const origMeta = await pipeline.metadata();

  // Step 2: Apply rotation (sharp auto-orients, then we apply user rotation)
  const rotation = transform.rotation || 0;
  if (rotation !== 0) {
    pipeline = pipeline.rotate(rotation, {
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });
  }

  // Step 3: Apply flip
  if (transform.flipV) pipeline = pipeline.flip();
  if (transform.flipH) pipeline = pipeline.flop();

  // Step 4: Apply adjustments
  if (adjustments.grayscale) {
    pipeline = pipeline.greyscale();
  }

  const brightness = (adjustments.brightness ?? 100) / 100;
  const contrast = (adjustments.contrast ?? 100) / 100;
  if (brightness !== 1 || contrast !== 1) {
    // linear: output = a * input + b
    // a = contrast, b = 128*(1-contrast) + 128*(brightness-1)
    const a = contrast;
    const b = 128 * (1 - contrast) + 128 * (brightness - 1);
    pipeline = pipeline.linear(a, b);
  }

  // Step 5: Convert to buffer to get post-transform dimensions
  let buf = await pipeline.toBuffer();
  const meta = await sharp(buf).metadata();

  // Step 6: Resize to cover the slot, factoring in scale
  const scale = transform.scale || 1;
  const imgRatio = meta.width / meta.height;
  const slotRatio = slot.width / slot.height;

  let resizeW, resizeH;
  if (imgRatio > slotRatio) {
    resizeH = Math.round(slot.height * scale);
    resizeW = Math.round(resizeH * imgRatio);
  } else {
    resizeW = Math.round(slot.width * scale);
    resizeH = Math.round(resizeW / imgRatio);
  }

  // Ensure at least slot dimensions
  resizeW = Math.max(resizeW, slot.width);
  resizeH = Math.max(resizeH, slot.height);

  buf = await sharp(buf)
    .resize(resizeW, resizeH, { fit: 'fill' })
    .toBuffer();

  // Step 7: Extract slot-sized region (center + pan offset)
  const panX = transform.x || 0;
  const panY = transform.y || 0;
  const cx = Math.round((resizeW - slot.width) / 2 - panX);
  const cy = Math.round((resizeH - slot.height) / 2 - panY);

  const extractLeft = Math.max(0, Math.min(cx, resizeW - slot.width));
  const extractTop = Math.max(0, Math.min(cy, resizeH - slot.height));
  const extractW = Math.min(slot.width, resizeW - extractLeft);
  const extractH = Math.min(slot.height, resizeH - extractTop);

  buf = await sharp(buf)
    .extract({ left: extractLeft, top: extractTop, width: extractW, height: extractH })
    .toBuffer();

  return buf;
}

/**
 * Compose a final photo strip.
 *
 * @param {string} framePath - Path to the frame PNG
 * @param {object} frameMeta - Frame metadata (width, height, slots)
 * @param {Array} photos - Array of { slotId, filePath, transform, adjustments }
 * @param {string} outputPath - Where to save the final JPEG
 */
export async function compose(framePath, frameMeta, photos, outputPath) {
  const { width, height, slots } = frameMeta;

  // Build composite layers: photos first, then frame overlay
  const layers = [];

  for (const photo of photos) {
    const slot = slots.find((s) => s.id === photo.slotId);
    if (!slot || !photo.filePath) continue;

    try {
      const photoBuf = await processPhotoForSlot(
        photo.filePath,
        slot,
        photo.transform,
        photo.adjustments
      );

      layers.push({
        input: photoBuf,
        top: slot.y,
        left: slot.x,
      });
    } catch (err) {
      console.error(`[compose] Error processing photo for ${photo.slotId}:`, err.message);
    }
  }

  // Add frame PNG on top (transparent slots will show photos beneath)
  if (existsSync(framePath)) {
    layers.push({
      input: framePath,
      top: 0,
      left: 0,
    });
  }

  // Composite everything onto a white canvas
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(layers)
    .jpeg({ quality: 95 })
    .toFile(outputPath);

  return outputPath;
}
