import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { detectSlots } from '../canvas/slotDetector';

export default function FrameSelectPage() {
  const navigate = useNavigate();
  const { setFrame } = useSession();
  const [frames, setFrames] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importName, setImportName] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importSlots, setImportSlots] = useState([]);
  const [editingSlots, setEditingSlots] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFrames();
  }, []);

  const fetchFrames = async () => {
    try {
      const res = await fetch('/api/frames');
      const data = await res.json();
      setFrames(data);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleSelect = (frame) => {
    setSelectedId(frame.id);
  };

  const handleContinue = () => {
    const frame = frames.find((f) => f.id === selectedId);
    if (!frame) return;
    setFrame({
      ...frame,
      imageSrc: `/api/frames/${frame.id}/image`,
    });
    navigate('/capture');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);

    // Preview
    const url = URL.createObjectURL(file);
    setImportPreview(url);

    // Detect slots
    const img = new Image();
    img.onload = () => {
      const slots = detectSlots(img);
      setImportSlots(slots);
    };
    img.src = url;
  };

  const handleImport = async () => {
    if (!importFile) return;
    const formData = new FormData();
    formData.append('frame', importFile);
    formData.append('name', importName || 'Custom Frame');

    try {
      const res = await fetch('/api/frames', { method: 'POST', body: formData });
      const data = await res.json();

      // If user edited slots, update them
      if (editingSlots && importSlots.length > 0) {
        await fetch(`/api/frames/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slots: importSlots }),
        });
        data.slots = importSlots;
      }

      setFrames((prev) => [...prev, data]);
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview(null);
      setImportSlots([]);
      setImportName('');
      setEditingSlots(false);
    } catch {}
  };

  const addSlot = () => {
    setImportSlots((prev) => [
      ...prev,
      {
        id: `slot-${prev.length + 1}`,
        x: 50,
        y: 50 + prev.length * 200,
        width: 300,
        height: 200,
      },
    ]);
    setEditingSlots(true);
  };

  const removeSlot = (idx) => {
    setImportSlots((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      next.forEach((s, i) => { s.id = `slot-${i + 1}`; });
      return next;
    });
    setEditingSlots(true);
  };

  const updateSlotField = (idx, field, value) => {
    setImportSlots((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: parseInt(value) || 0 };
      return next;
    });
    setEditingSlots(true);
  };

  return (
    <div className="app-layout">
      {/* Header */}
      <div className="app-header">
        <div className="app-header__title">SELECT FRAME</div>
        <div className="app-header__actions">
          <Button variant="ghost" onClick={() => navigate('/')}>
            BACK
          </Button>
        </div>
      </div>

      <div className="app-main" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {loading ? (
          <p className="text-mono">LOADING FRAMES...</p>
        ) : (
          <>
            {/* Frame Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 'var(--sp-3)',
              marginBottom: 'var(--sp-4)',
            }}>
              {frames.map((frame) => (
                <div
                  key={frame.id}
                  className={`card card--interactive ${selectedId === frame.id ? 'card--selected' : ''}`}
                  onClick={() => handleSelect(frame)}
                  style={{ textAlign: 'center', padding: 'var(--sp-3)' }}
                >
                  <div style={{
                    width: '100%',
                    aspectRatio: `${frame.width}/${frame.height}`,
                    background: '#F0F0F0',
                    border: '1px solid #CCC',
                    marginBottom: 'var(--sp-2)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <img
                      src={`/api/frames/${frame.id}/image`}
                      alt={frame.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                      loading="lazy"
                    />
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-headline)',
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  }}>
                    {frame.name}
                  </p>
                  <p className="text-tiny" style={{ marginTop: '4px' }}>
                    {frame.slots.length} SLOT{frame.slots.length !== 1 ? 'S' : ''} · {frame.printWidth} × {frame.printHeight}
                  </p>
                </div>
              ))}

              {/* Add Custom Frame Card */}
              <div
                className="card card--interactive"
                onClick={() => setShowImportModal(true)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '280px',
                  gap: 'var(--sp-2)',
                }}
              >
                <Icon name="add" size={48} />
                <p style={{
                  fontFamily: 'var(--font-headline)',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}>
                  IMPORT FRAME
                </p>
              </div>
            </div>

            {/* Continue button */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="primary"
                size="lg"
                icon="photo_camera"
                disabled={!selectedId}
                onClick={handleContinue}
              >
                CONTINUE TO CAPTURE
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Import Frame Modal */}
      <Modal
        open={showImportModal}
        onClose={() => { setShowImportModal(false); setImportFile(null); setImportPreview(null); setImportSlots([]); }}
        title="IMPORT CUSTOM FRAME"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowImportModal(false)}>
              CANCEL
            </Button>
            <Button variant="primary" disabled={!importFile} onClick={handleImport}>
              IMPORT
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {/* File upload */}
          <div className="input-group">
            <label className="input-label">FRAME PNG</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              {importFile ? importFile.name : 'CHOOSE PNG FILE'}
            </Button>
            <span className="input-helper">
              PNG with transparent regions for photo slots.
            </span>
          </div>

          {/* Name */}
          <div className="input-group">
            <label className="input-label">FRAME NAME</label>
            <input
              className="input-field"
              type="text"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              placeholder="e.g. My Custom Frame"
            />
          </div>

          {/* Preview + Slots */}
          {importPreview && (
            <div>
              <p className="input-label" style={{ marginBottom: 'var(--sp-2)' }}>
                DETECTED SLOTS ({importSlots.length})
              </p>
              <div style={{
                position: 'relative',
                background: '#E8E8E8',
                border: '3px solid var(--color-black)',
                maxHeight: '400px',
                overflow: 'auto',
              }}>
                <img
                  src={importPreview}
                  alt="Frame preview"
                  style={{ width: '100%', display: 'block' }}
                />
                {/* Slot overlays */}
                {importSlots.map((slot, idx) => (
                  <div
                    key={slot.id}
                    style={{
                      position: 'absolute',
                      left: `${(slot.x / (frames[0]?.width || 1200)) * 100}%`,
                      top: `${(slot.y / (frames[0]?.height || 1800)) * 100}%`,
                      width: `${(slot.width / (frames[0]?.width || 1200)) * 100}%`,
                      height: `${(slot.height / (frames[0]?.height || 1800)) * 100}%`,
                      border: '2px dashed var(--color-error)',
                      background: 'rgba(255,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-error)',
                    }}
                  >
                    {slot.id}
                  </div>
                ))}
              </div>

              {/* Slot editor */}
              <div style={{ marginTop: 'var(--sp-3)' }}>
                {importSlots.map((slot, idx) => (
                  <div
                    key={slot.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--sp-2)',
                      marginBottom: 'var(--sp-1)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <span style={{ width: '50px' }}>{slot.id}</span>
                    {['x', 'y', 'width', 'height'].map((field) => (
                      <input
                        key={field}
                        className="input-field"
                        type="number"
                        value={slot[field]}
                        onChange={(e) => updateSlotField(idx, field, e.target.value)}
                        style={{ width: '70px', padding: '4px 6px', fontSize: '12px' }}
                        title={field}
                      />
                    ))}
                    <button
                      className="btn btn--icon"
                      onClick={() => removeSlot(idx)}
                      style={{ padding: '2px' }}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={addSlot} style={{ marginTop: 'var(--sp-2)' }}>
                  <Icon name="add" size={14} /> ADD SLOT
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
