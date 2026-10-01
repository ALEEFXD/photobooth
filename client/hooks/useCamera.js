import { useState, useCallback, useEffect } from 'react';
import { useSession } from '../context/SessionContext';

/**
 * Hook for camera detection and capture orchestration.
 * Communicates with the backend /api/camera/* endpoints.
 */
export function useCamera() {
  const { cameraStatus, setCameraStatus } = useSession();
  const [availableProviders, setAvailableProviders] = useState(['webcam']);

  const detectCamera = useCallback(async () => {
    try {
      const res = await fetch('/api/camera/status');
      const status = await res.json();
      setCameraStatus(status);
      return status;
    } catch (err) {
      const fallback = {
        type: 'webcam',
        provider: 'webcam',
        model: 'Browser Webcam',
        message: 'Could not reach server. Using webcam.',
        warnings: [err.message],
      };
      setCameraStatus(fallback);
      return fallback;
    }
  }, [setCameraStatus]);

  const refreshCamera = useCallback(async () => {
    try {
      const res = await fetch('/api/camera/refresh', { method: 'POST' });
      const status = await res.json();
      setCameraStatus(status);
      return status;
    } catch (err) {
      return cameraStatus;
    }
  }, [cameraStatus, setCameraStatus]);

  /**
   * Trigger a DSLR capture. Returns { filename, path } or null.
   */
  const captureDSLR = useCallback(async () => {
    try {
      const res = await fetch('/api/camera/capture', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'DSLR capture failed.');
      }
      return await res.json();
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Save a webcam capture (base64 image) as a draft.
   */
  const saveWebcamCapture = useCallback(async (base64Image) => {
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save capture.');
      }
      return await res.json();
    } catch (err) {
      throw err;
    }
  }, []);

  const switchCamera = useCallback(async (type) => {
    try {
      const res = await fetch('/api/camera/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to switch camera.');
      }
      const status = await res.json();
      setCameraStatus(status);
      return status;
    } catch (err) {
      throw err;
    }
  }, [setCameraStatus]);

  // Fetch available providers on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/camera/providers');
        const data = await res.json();
        if (data.providers) setAvailableProviders(data.providers);
      } catch {
        // Ignore — defaults to ['webcam']
      }
    })();
  }, []);

  // Auto-detect on mount
  useEffect(() => {
    if (!cameraStatus) {
      detectCamera();
    }
  }, [cameraStatus, detectCamera]);

  return {
    cameraStatus,
    availableProviders,
    isWebcam: !cameraStatus || cameraStatus.type === 'webcam',
    isDSLR: cameraStatus?.type === 'dslr',
    detectCamera,
    refreshCamera,
    switchCamera,
    captureDSLR,
    saveWebcamCapture,
  };
}
