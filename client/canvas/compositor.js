/**
 * Client-side canvas compositor.
 * Draws photos into frame slots with transforms and adjustments.
 * Must produce output matching the server-side sharp compositor.
 */

/**
 * Composite photos onto a canvas using the frame template.
 *
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {HTMLImageElement} frameImage - The frame PNG (transparent slots)
 * @param {Array} slots - Slot definitions [{id, x, y, width, height}]
 * @param {Array} photos - [{slotId, image: HTMLImageElement, transform, adjustments}]
 */
export function compositeFrame(canvas, frameImage, slots, photos) {
  const ctx = canvas.getContext('2d');
  canvas.width = frameImage.naturalWidth || frameImage.width;
  canvas.height = frameImage.naturalHeight || frameImage.height;

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw each photo in its slot
  for (const slot of slots) {
    const photo = photos.find((p) => p.slotId === slot.id);
    if (!photo || !photo.image) continue;

    ctx.save();

    // Clip to slot rectangle
    ctx.beginPath();
    ctx.rect(slot.x, slot.y, slot.width, slot.height);
    ctx.clip();

    // Move origin to slot center
    const cx = slot.x + slot.width / 2;
    const cy = slot.y + slot.height / 2;
    ctx.translate(cx, cy);

    // Apply flip
    const t = photo.transform || {};
    ctx.scale(t.flipH ? -1 : 1, t.flipV ? -1 : 1);

    // Apply rotation
    ctx.rotate(((t.rotation || 0) * Math.PI) / 180);

    // Build CSS filter string for adjustments
    const a = photo.adjustments || {};
    const filters = [];
    if (a.brightness !== undefined && a.brightness !== 100) {
      filters.push(`brightness(${a.brightness}%)`);
    }
    if (a.contrast !== undefined && a.contrast !== 100) {
      filters.push(`contrast(${a.contrast}%)`);
    }
    if (a.grayscale) {
      filters.push('grayscale(100%)');
    }
    if (filters.length) {
      ctx.filter = filters.join(' ');
    }

    // Calculate "cover" dimensions
    const scale = t.scale || 1;
    const img = photo.image;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const slotRatio = slot.width / slot.height;

    let drawW, drawH;
    if (imgRatio > slotRatio) {
      drawH = slot.height * scale;
      drawW = drawH * imgRatio;
    } else {
      drawW = slot.width * scale;
      drawH = drawW / imgRatio;
    }

    // Draw centered with pan offset
    const dx = (t.x || 0) - drawW / 2;
    const dy = (t.y || 0) - drawH / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);

    ctx.restore();
  }

  // Draw frame overlay on top (transparent slots reveal photos)
  ctx.drawImage(frameImage, 0, 0);
}

/**
 * Export the composed canvas as a data URL.
 */
export function canvasToDataUrl(canvas, type = 'image/jpeg', quality = 0.95) {
  return canvas.toDataURL(type, quality);
}

/**
 * Export the composed canvas as a Blob.
 */
export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.95) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

/**
 * Draw a single photo into a preview canvas for a specific slot.
 * Used in the adjust screen for per-slot editing.
 */
export function drawSlotPreview(canvas, img, slot, transform = {}, adjustments = {}) {
  const ctx = canvas.getContext('2d');
  canvas.width = slot.width;
  canvas.height = slot.height;

  ctx.fillStyle = '#F0F0F0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!img) return;

  ctx.save();

  const cx = slot.width / 2;
  const cy = slot.height / 2;
  ctx.translate(cx, cy);

  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
  ctx.rotate(((transform.rotation || 0) * Math.PI) / 180);

  const filters = [];
  if (adjustments.brightness !== undefined && adjustments.brightness !== 100) {
    filters.push(`brightness(${adjustments.brightness}%)`);
  }
  if (adjustments.contrast !== undefined && adjustments.contrast !== 100) {
    filters.push(`contrast(${adjustments.contrast}%)`);
  }
  if (adjustments.grayscale) {
    filters.push('grayscale(100%)');
  }
  if (filters.length) ctx.filter = filters.join(' ');

  const scale = transform.scale || 1;
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const slotRatio = slot.width / slot.height;

  let drawW, drawH;
  if (imgRatio > slotRatio) {
    drawH = slot.height * scale;
    drawW = drawH * imgRatio;
  } else {
    drawW = slot.width * scale;
    drawH = drawW / imgRatio;
  }

  const dx = (transform.x || 0) - drawW / 2;
  const dy = (transform.y || 0) - drawH / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);

  ctx.restore();
}
