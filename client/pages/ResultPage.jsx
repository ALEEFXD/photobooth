import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { compositeFrame } from '../canvas/compositor';
import { usePhotoImages } from '../hooks/usePhotoImages';
import Button from '../components/Button';
import Icon from '../components/Icon';

export default function ResultPage() {
  const navigate = useNavigate();
  const { frame, photos, setResult, resultUrl, reset } = useSession();
  const canvasRef = useRef(null);
  const frameImgRef = useRef(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const photoImages = usePhotoImages(photos);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Load frame image
  useEffect(() => {
    if (!frame) { navigate('/frames'); return; }
    const img = new Image();
    img.onload = () => { frameImgRef.current = img; setFrameLoaded(true); };
    img.src = frame.imageSrc;
  }, [frame, navigate]);

  // Draw final composite
  useEffect(() => {
    if (!frameLoaded || !canvasRef.current || !frameImgRef.current) return;
    const photoList = photos.map((p) => ({
      slotId: p.slotId, image: photoImages[p.imageUrl] || null,
      transform: p.transform, adjustments: p.adjustments,
    }));
    compositeFrame(canvasRef.current, frameImgRef.current, frame.slots, photoList);
  }, [frameLoaded, photos, photoImages, frame]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        frameId: frame.id,
        photos: photos.map((p) => ({
          slotId: p.slotId,
          draftFile: p.draftFile,
          transform: p.transform,
          adjustments: p.adjustments,
        })),
      };
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed.');
      }
      const data = await res.json();
      setResult({ url: data.url, filename: data.filename });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleNewSession = () => {
    reset();
    navigate('/');
  };

  if (!frame) return null;

  return (
    <div className="app-layout">
      <div className="app-header">
        <div className="app-header__title">RESULT</div>
        <div className="app-header__actions">
          <Button variant="ghost" onClick={() => navigate('/adjust')}>BACK TO ADJUST</Button>
        </div>
      </div>

      <div className="app-main" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 'var(--sp-4)', maxWidth: '800px', margin: '0 auto',
      }}>
        {/* Final composite */}
        <div id="print-target" style={{
          border: '5px solid var(--color-black)',
          background: '#F0F0F0',
          maxWidth: '500px',
          width: '100%',
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button variant="primary" size="lg" icon="save" onClick={handleSave} disabled={saving || saved}>
            {saved ? 'SAVED' : saving ? 'SAVING...' : 'SAVE JPEG'}
          </Button>
          <Button variant="secondary" size="lg" icon="print" onClick={handlePrint}>
            PRINT
          </Button>
        </div>

        {/* Save result info */}
        {saved && resultUrl && (
          <div style={{
            border: '3px solid var(--color-success)',
            padding: 'var(--sp-3)',
            width: '100%',
            maxWidth: '500px',
          }}>
            <p className="text-mono" style={{ color: 'var(--color-success)', fontSize: '13px' }}>
              <Icon name="check_circle" size={16} style={{ color: 'var(--color-success)', marginRight: '8px' }} />
              SAVED TO {resultUrl}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            border: '3px solid var(--color-error)',
            padding: 'var(--sp-3)',
            width: '100%',
            maxWidth: '500px',
          }}>
            <p className="text-mono" style={{ color: 'var(--color-error)', fontSize: '13px' }}>
              {error}
            </p>
          </div>
        )}

        {/* New session */}
        <Button variant="ghost" onClick={handleNewSession}>
          START NEW SESSION
        </Button>
      </div>
    </div>
  );
}
