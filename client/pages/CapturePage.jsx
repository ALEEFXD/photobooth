import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useCamera } from '../hooks/useCamera';
import { useWebcam } from '../hooks/useWebcam';
import { useCountdown } from '../hooks/useCountdown';
import { compositeFrame } from '../canvas/compositor';
import Button from '../components/Button';
import Countdown from '../components/Countdown';
import StatusIndicator from '../components/StatusIndicator';
import Icon from '../components/Icon';

export default function CapturePage() {
  const navigate = useNavigate();
  const { frame, photos, setPhoto, captureDelay, captureMode } = useSession();
  const { cameraStatus, isWebcam, captureDSLR, saveWebcamCapture, switchCamera, availableProviders } = useCamera();
  const { videoRef, stream, error: webcamError, start: startWebcam, stop: stopWebcam, capture: captureFrame } = useWebcam();
  const { seconds, isRunning, start: startCountdown, stop: stopCountdown } = useCountdown(captureDelay);

  const canvasRef = useRef(null);
  const frameImgRef = useRef(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [captureError, setCaptureError] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [photoImages, setPhotoImages] = useState({});

  // Current slot to fill
  const filledSlotIds = photos.map((p) => p.slotId);
  const nextSlot = frame?.slots.find((s) => !filledSlotIds.includes(s.id));
  const allFilled = frame && filledSlotIds.length >= frame.slots.length;

  // Load frame image
  useEffect(() => {
    if (!frame) {
      navigate('/frames');
      return;
    }
    const img = new Image();
    img.onload = () => {
      frameImgRef.current = img;
      setFrameLoaded(true);
    };
    img.src = frame.imageSrc;
  }, [frame, navigate]);

  // Start webcam if needed
  useEffect(() => {
    if (isWebcam && !stream) {
      startWebcam();
    }
    return () => {
      if (isWebcam) stopWebcam();
    };
  }, [isWebcam]);

  // Handle camera switch
  const handleCameraSwitch = useCallback(async (e) => {
    const type = e.target.value;
    if ((type === 'webcam' && isWebcam) || (type === 'dslr' && !isWebcam)) return;
    setIsSwitching(true);
    setCaptureError(null);
    try {
      // Stop webcam if switching away from it
      if (isWebcam && type === 'dslr') {
        stopWebcam();
      }
      await switchCamera(type);
      // Start webcam if switching to it
      if (type === 'webcam') {
        // Small delay to allow state update before starting
        setTimeout(() => startWebcam(), 100);
      }
    } catch (err) {
      setCaptureError(err.message);
    } finally {
      setIsSwitching(false);
    }
  }, [isWebcam, switchCamera, startWebcam, stopWebcam]);

  // Draw preview composite
  useEffect(() => {
    if (!frameLoaded || !canvasRef.current || !frameImgRef.current) return;

    const photoList = photos.map((p) => ({
      slotId: p.slotId,
      image: photoImages[p.slotId] || null,
      transform: p.transform,
      adjustments: p.adjustments,
    }));

    compositeFrame(canvasRef.current, frameImgRef.current, frame.slots, photoList);
  }, [frameLoaded, photos, photoImages, frame]);

  // Load photo images for preview
  useEffect(() => {
    for (const photo of photos) {
      if (!photoImages[photo.slotId] && photo.imageUrl) {
        const img = new Image();
        img.onload = () => {
          setPhotoImages((prev) => ({ ...prev, [photo.slotId]: img }));
        };
        img.src = photo.imageUrl;
      }
    }
  }, [photos]);

  // Redirect to adjust when all filled
  useEffect(() => {
    if (allFilled) {
      const timer = setTimeout(() => navigate('/adjust'), 800);
      return () => clearTimeout(timer);
    }
  }, [allFilled, navigate]);

  const doCapture = useCallback(async () => {
    if (!nextSlot || isCapturing) return;
    setIsCapturing(true);
    setCaptureError(null);

    try {
      let result;
      if (isWebcam) {
        const base64 = captureFrame();
        if (!base64) throw new Error('Failed to capture from webcam.');
        result = await saveWebcamCapture(base64);
      } else {
        result = await captureDSLR();
      }

      setPhoto({
        slotId: nextSlot.id,
        draftFile: result.filename,
        imageUrl: result.url || result.path,
      });
    } catch (err) {
      setCaptureError(err.message);
    } finally {
      setIsCapturing(false);
    }
  }, [nextSlot, isCapturing, isWebcam, captureFrame, saveWebcamCapture, captureDSLR, setPhoto]);

  const handleCapture = useCallback(() => {
    if (captureMode === 'manual' || captureDelay === 0) {
      doCapture();
    } else {
      startCountdown(captureDelay, doCapture);
    }
  }, [captureMode, captureDelay, doCapture, startCountdown]);

  if (!frame) return null;

  return (
    <div className="app-layout">
      {/* Header */}
      <div className="app-header">
        <div className="app-header__title">CAPTURE</div>
        <div className="app-header__actions">
          <select
            id="camera-source-select"
            className="camera-select"
            value={cameraStatus?.type || 'webcam'}
            onChange={handleCameraSwitch}
            disabled={isCapturing || isRunning || isSwitching}
          >
            {availableProviders.includes('dslr') && (
              <option value="dslr">DSLR</option>
            )}
            <option value="webcam">WEBCAM</option>
          </select>
          <StatusIndicator cameraStatus={cameraStatus} />
          <span className="text-mono" style={{ fontSize: '13px' }}>
            {filledSlotIds.length}/{frame.slots.length}
          </span>
          <Button variant="ghost" onClick={() => navigate('/frames')}>BACK</Button>
        </div>
      </div>

      <div className="app-main" style={{
        display: 'flex',
        gap: 'var(--sp-4)',
        maxWidth: '1200px',
        margin: '0 auto',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {/* Live camera feed */}
        <div style={{
          flex: '1 1 400px',
          maxWidth: '640px',
          border: '5px solid var(--color-black)',
          position: 'relative',
          background: '#000',
          aspectRatio: '4/3',
        }}>
          {isWebcam && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // Mirror for selfie
              }}
            />
          )}
          {!isWebcam && (
            <div className="flex-col-center" style={{ height: '100%', color: 'var(--color-white)' }}>
              <Icon name="photo_camera" size={64} style={{ color: 'var(--color-white)' }} />
              <p className="text-mono" style={{ color: 'var(--color-white)', marginTop: 'var(--sp-2)' }}>
                DSLR VIEWFINDER
              </p>
            </div>
          )}
          {webcamError && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--sp-3)',
            }}>
              <p style={{ color: 'var(--color-error)', fontFamily: 'var(--font-mono)', fontSize: '14px', textAlign: 'center' }}>
                {webcamError}
              </p>
            </div>
          )}

          {/* Slot indicator */}
          {nextSlot && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--color-black)',
              color: 'var(--color-white)',
              padding: '8px 12px',
              fontFamily: 'var(--font-headline)',
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              textAlign: 'center',
            }}>
              FILLING {nextSlot.id.toUpperCase()}
            </div>
          )}
        </div>

        {/* Preview composite */}
        <div style={{
          flex: '0 0 250px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-3)',
          alignItems: 'center',
        }}>
          <p className="input-label">PREVIEW</p>
          <div style={{ border: '3px solid var(--color-black)', background: '#F0F0F0' }}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>

          {/* Capture controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', width: '100%' }}>
            {!allFilled && (
              <Button
                variant="primary"
                size="lg"
                icon="photo_camera"
                onClick={handleCapture}
                disabled={isCapturing || isRunning || !nextSlot}
                style={{ width: '100%' }}
              >
                {isRunning ? `WAIT ${seconds}s` : captureMode === 'manual' ? 'CAPTURE' : `CAPTURE (${captureDelay}s)`}
              </Button>
            )}

            {allFilled && (
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/adjust')}
                style={{ width: '100%' }}
              >
                ADJUST & REVIEW
              </Button>
            )}
          </div>

          {/* Error */}
          {captureError && (
            <div style={{
              border: '3px solid var(--color-error)',
              padding: 'var(--sp-2)',
              width: '100%',
            }}>
              <p className="text-tiny" style={{ color: 'var(--color-error)' }}>{captureError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Countdown Overlay */}
      {isRunning && <Countdown seconds={seconds} />}
    </div>
  );
}
