import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { compositeFrame, drawSlotPreview } from '../canvas/compositor';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Modal from '../components/Modal';

export default function AdjustPage() {
  const navigate = useNavigate();
  const {
    frame, photos, updateTransform, updateAdjustments,
    removePhoto, setPhoto, setFrame,
  } = useSession();
  const canvasRef = useRef(null);
  const frameImgRef = useRef(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [photoImages, setPhotoImages] = useState({});
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showFrameSwap, setShowFrameSwap] = useState(false);
  const [availableFrames, setAvailableFrames] = useState([]);
  const slotCanvasRef = useRef(null);

  // Load frame image
  useEffect(() => {
    if (!frame) { navigate('/frames'); return; }
    const img = new Image();
    img.onload = () => { frameImgRef.current = img; setFrameLoaded(true); };
    img.src = frame.imageSrc;
  }, [frame, navigate]);

  // Load photo images
  useEffect(() => {
    for (const photo of photos) {
      if (!photoImages[photo.slotId] && photo.imageUrl) {
        const img = new Image();
        img.onload = () => setPhotoImages((prev) => ({ ...prev, [photo.slotId]: img }));
        img.src = photo.imageUrl;
      }
    }
  }, [photos]);

  // Draw main preview
  useEffect(() => {
    if (!frameLoaded || !canvasRef.current || !frameImgRef.current) return;
    const photoList = photos.map((p) => ({
      slotId: p.slotId, image: photoImages[p.slotId] || null,
      transform: p.transform, adjustments: p.adjustments,
    }));
    compositeFrame(canvasRef.current, frameImgRef.current, frame.slots, photoList);
  }, [frameLoaded, photos, photoImages, frame]);

  // Draw slot preview
  useEffect(() => {
    if (!selectedSlot || !slotCanvasRef.current) return;
    const photo = photos.find((p) => p.slotId === selectedSlot);
    const slot = frame?.slots.find((s) => s.id === selectedSlot);
    if (!photo || !slot) return;
    drawSlotPreview(slotCanvasRef.current, photoImages[selectedSlot], slot, photo.transform, photo.adjustments);
  }, [selectedSlot, photos, photoImages, frame]);

  const selectedPhoto = photos.find((p) => p.slotId === selectedSlot);
  const selectedSlotDef = frame?.slots.find((s) => s.id === selectedSlot);

  const handleRetake = () => {
    if (!selectedSlot) return;
    removePhoto(selectedSlot);
    navigate('/capture');
  };

  const handleSlider = (field, value, isTransform = true) => {
    if (!selectedSlot) return;
    if (isTransform) {
      updateTransform(selectedSlot, { [field]: parseFloat(value) });
    } else {
      updateAdjustments(selectedSlot, { [field]: field === 'grayscale' ? value : parseFloat(value) });
    }
  };

  const handleFrameSwap = async () => {
    try {
      const res = await fetch('/api/frames');
      setAvailableFrames(await res.json());
      setShowFrameSwap(true);
    } catch {}
  };

  const selectNewFrame = (newFrame) => {
    setFrame({ ...newFrame, imageSrc: `/api/frames/${newFrame.id}/image` });
    setShowFrameSwap(false);
    // Force reload frame image
    setFrameLoaded(false);
    const img = new Image();
    img.onload = () => { frameImgRef.current = img; setFrameLoaded(true); };
    img.src = `/api/frames/${newFrame.id}/image`;
  };

  if (!frame) return null;

  return (
    <div className="app-layout">
      <div className="app-header">
        <div className="app-header__title">ADJUST</div>
        <div className="app-header__actions">
          <Button variant="ghost" onClick={() => navigate('/capture')}>BACK</Button>
          <Button variant="secondary" size="sm" onClick={handleFrameSwap} icon="swap_horiz">SWAP FRAME</Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/result')} icon="check">DONE</Button>
        </div>
      </div>

      <div className="app-main" style={{
        display: 'flex', gap: 'var(--sp-4)', maxWidth: '1400px',
        margin: '0 auto', flexWrap: 'wrap',
      }}>
        {/* Main preview */}
        <div style={{ flex: '1 1 400px', maxWidth: '500px' }}>
          <p className="input-label">COMPOSITE PREVIEW</p>
          <div style={{ border: '5px solid var(--color-black)', background: '#F0F0F0' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        </div>

        {/* Slot grid + controls */}
        <div style={{ flex: '1 1 300px' }}>
          {/* Slot thumbnails */}
          <p className="input-label" style={{ marginBottom: 'var(--sp-2)' }}>PHOTOS</p>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)',
          }}>
            {frame.slots.map((slot) => {
              const photo = photos.find((p) => p.slotId === slot.id);
              const isSelected = selectedSlot === slot.id;
              return (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot.id)}
                  style={{
                    border: isSelected ? '5px solid var(--color-black)' : '3px solid var(--color-black)',
                    cursor: 'pointer',
                    aspectRatio: `${slot.width}/${slot.height}`,
                    background: isSelected ? '#000' : '#F0F0F0',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {photo ? (
                    <img src={photo.imageUrl} alt={slot.id} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="flex-center" style={{ height: '100%' }}>
                      <span className="text-tiny">EMPTY</span>
                    </div>
                  )}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'var(--color-black)', color: 'var(--color-white)',
                    padding: '2px 6px', fontSize: '10px', fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                  }}>
                    {slot.id}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-slot controls */}
          {selectedSlot && selectedPhoto && (
            <div style={{
              border: '3px solid var(--color-black)', padding: 'var(--sp-3)',
              display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="input-label" style={{ margin: 0 }}>
                  {selectedSlot.toUpperCase()} ADJUSTMENTS
                </p>
                <Button variant="destructive" size="sm" onClick={handleRetake}>
                  <Icon name="replay" size={14} /> RETAKE
                </Button>
              </div>

              {/* Slot preview */}
              {selectedSlotDef && (
                <div style={{ border: '1px solid #CCC', background: '#F0F0F0' }}>
                  <canvas ref={slotCanvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
                </div>
              )}

              {/* Transform controls */}
              <div className="slider-group">
                <div className="slider-group__header">
                  <span className="slider-group__label">ZOOM</span>
                  <span className="slider-group__value">{(selectedPhoto.transform.scale || 1).toFixed(1)}×</span>
                </div>
                <input type="range" className="slider" min="1" max="3" step="0.1"
                  value={selectedPhoto.transform.scale || 1}
                  onChange={(e) => handleSlider('scale', e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <div className="slider-group" style={{ flex: 1 }}>
                  <div className="slider-group__header">
                    <span className="slider-group__label">PAN X</span>
                    <span className="slider-group__value">{selectedPhoto.transform.x || 0}</span>
                  </div>
                  <input type="range" className="slider" min="-200" max="200" step="1"
                    value={selectedPhoto.transform.x || 0}
                    onChange={(e) => handleSlider('x', e.target.value)} />
                </div>
                <div className="slider-group" style={{ flex: 1 }}>
                  <div className="slider-group__header">
                    <span className="slider-group__label">PAN Y</span>
                    <span className="slider-group__value">{selectedPhoto.transform.y || 0}</span>
                  </div>
                  <input type="range" className="slider" min="-200" max="200" step="1"
                    value={selectedPhoto.transform.y || 0}
                    onChange={(e) => handleSlider('y', e.target.value)} />
                </div>
              </div>

              {/* Photo adjustments */}
              <div className="slider-group">
                <div className="slider-group__header">
                  <span className="slider-group__label">BRIGHTNESS</span>
                  <span className="slider-group__value">{selectedPhoto.adjustments.brightness}%</span>
                </div>
                <input type="range" className="slider" min="20" max="200" step="1"
                  value={selectedPhoto.adjustments.brightness}
                  onChange={(e) => handleSlider('brightness', e.target.value, false)} />
              </div>

              <div className="slider-group">
                <div className="slider-group__header">
                  <span className="slider-group__label">CONTRAST</span>
                  <span className="slider-group__value">{selectedPhoto.adjustments.contrast}%</span>
                </div>
                <input type="range" className="slider" min="20" max="200" step="1"
                  value={selectedPhoto.adjustments.contrast}
                  onChange={(e) => handleSlider('contrast', e.target.value, false)} />
              </div>

              {/* Toggle buttons row */}
              <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                <Button variant={selectedPhoto.adjustments.grayscale ? 'primary' : 'secondary'} size="sm"
                  onClick={() => handleSlider('grayscale', !selectedPhoto.adjustments.grayscale, false)}>
                  B&W
                </Button>
                <Button variant="secondary" size="sm"
                  onClick={() => handleSlider('rotation', ((selectedPhoto.transform.rotation || 0) + 90) % 360)}>
                  <Icon name="rotate_right" size={14} /> ROTATE
                </Button>
                <Button variant={selectedPhoto.transform.flipH ? 'primary' : 'secondary'} size="sm"
                  onClick={() => handleSlider('flipH', !selectedPhoto.transform.flipH)}>
                  <Icon name="flip" size={14} /> FLIP H
                </Button>
                <Button variant={selectedPhoto.transform.flipV ? 'primary' : 'secondary'} size="sm"
                  onClick={() => handleSlider('flipV', !selectedPhoto.transform.flipV)}>
                  FLIP V
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Frame swap modal */}
      <Modal open={showFrameSwap} onClose={() => setShowFrameSwap(false)} title="SWAP FRAME"
        footer={<Button variant="secondary" onClick={() => setShowFrameSwap(false)}>CANCEL</Button>}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 'var(--sp-2)',
        }}>
          {availableFrames.map((f) => (
            <div key={f.id}
              className={`card card--interactive ${f.id === frame.id ? 'card--selected' : ''}`}
              onClick={() => selectNewFrame(f)}
              style={{ padding: 'var(--sp-2)', textAlign: 'center' }}>
              <img src={`/api/frames/${f.id}/image`} alt={f.name}
                style={{ width: '100%', aspectRatio: `${f.width}/${f.height}`, objectFit: 'contain', background: '#F0F0F0' }} />
              <p style={{ fontFamily: 'var(--font-headline)', fontSize: '11px', marginTop: '4px', textTransform: 'uppercase' }}>
                {f.name}
              </p>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
