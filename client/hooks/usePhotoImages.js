import { useState, useEffect, useRef } from 'react';

/**
 * Hook for loading photo images keyed by imageUrl.
 * Returns { [imageUrl]: HTMLImageElement }.
 * Safe across slot remaps — images are tracked by URL, not slot ID.
 */
export function usePhotoImages(photos) {
  const [images, setImages] = useState({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    for (const photo of photos) {
      if (!photo.imageUrl) continue;
      // Already loaded
      if (images[photo.imageUrl]) continue;

      const img = new Image();
      img.onload = () => {
        if (mountedRef.current) {
          setImages((prev) => ({ ...prev, [photo.imageUrl]: img }));
        }
      };
      img.src = photo.imageUrl;
    }
  }, [photos]);

  return images;
}
