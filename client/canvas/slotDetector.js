/**
 * Client-side alpha-transparency slot detection.
 * Analyzes a frame PNG to find rectangular transparent regions (photo slots).
 */

/**
 * Detect transparent rectangular slots in a frame image.
 * Uses connected-component labeling on the alpha channel.
 *
 * @param {HTMLImageElement} img - The frame PNG image
 * @param {number} minSize - Minimum slot dimension in pixels (default 50)
 * @returns {Array<{id, x, y, width, height}>}
 */
export function detectSlots(img, minSize = 50) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  const visited = new Uint8Array(width * height);
  const slots = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixIdx = y * width + x;
      if (visited[pixIdx]) continue;

      const alpha = data[pixIdx * 4 + 3];
      if (alpha > 10) continue; // Not transparent

      // Flood-fill to find bounding box
      let minX = x, maxX = x, minY = y, maxY = y;
      const stack = [[x, y]];
      visited[pixIdx] = 1;

      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (visited[nIdx]) continue;
          const nAlpha = data[nIdx * 4 + 3];
          if (nAlpha > 10) continue;
          visited[nIdx] = 1;
          stack.push([nx, ny]);
        }
      }

      const rw = maxX - minX + 1;
      const rh = maxY - minY + 1;
      if (rw >= minSize && rh >= minSize) {
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

  // Sort top-to-bottom, left-to-right
  slots.sort((a, b) => a.y - b.y || a.x - b.x);
  slots.forEach((s, i) => { s.id = `slot-${i + 1}`; });

  return slots;
}
