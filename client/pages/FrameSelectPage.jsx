import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { detectSlots } from '../canvas/slotDetector';

export default function FrameSelectPage() {
  const navigate = useNavigate();
  const { setFrame, swapFrame, reset, frame: sessionFrame } = useSession();
  const [frames, setFrames] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Unified modal state: null | { mode: 'create' } | { mode: 'edit', frameId }
  const [frameModal, setFrameModal] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importName, setImportName] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importSlots, setImportSlots] = useState([]);
  const [editingSlots, setEditingSlots] = useState(false);
  const [imageDims, setImageDims] = useState({ width: 1200, height: 1800 });
  const [modalError, setModalError] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState(null); // frame object or null
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
      imageSrc: `/api/frames/${frame.id}/image?v=${frame.updatedAt || ''}`,
    });
    navigate('/capture');
  };

  // ─── Unified modal helpers ─────────────────────

  const closeModal = () => {
    setFrameModal(null);
    setImportFile(null);
    setImportName('');
    setImportPreview(null);
    setImportSlots([]);
    setEditingSlots(false);
    setImageDims({ width: 1200, height: 1800 });
    setModalError(null);
    setModalSaving(false);
  };

  const openCreateModal = () => {
    closeModal();
    setFrameModal({ mode: 'create' });
  };

  const openEditModal = (frame) => {
    closeModal();
    setImportName(frame.name);
    setImportSlots(frame.slots.map((s) => ({ ...s })));
    setImportPreview(`/api/frames/${frame.id}/image?v=${frame.updatedAt || ''}`);
    setImageDims({ width: frame.width, height: frame.height });
    setFrameModal({ mode: 'edit', frameId: frame.id });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setModalError(null);

    // Preview
    const url = URL.createObjectURL(file);
    setImportPreview(url);

    // Detect slots and get image dimensions
    const img = new Image();
    img.onload = () => {
      setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
      const slots = detectSlots(img);
      setImportSlots(slots);
    };
    img.src = url;
  };

  const handleRedetect = () => {
    if (!importPreview) return;
    const img = new Image();
    img.onload = () => {
      setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
      const slots = detectSlots(img);
      setImportSlots(slots);
      setEditingSlots(true);
    };
    img.src = importPreview;
  };

  // ─── Slot validation (client-side) ─────────────

  const getSlotError = (slot, idx) => {
    const { x, y, width, height } = slot;
    if ([x, y, width, height].some((v) => !Number.isFinite(v))) return 'Values must be integers.';
    if (x < 0 || y < 0) return 'x and y must be >= 0.';
    if (width < 1 || height < 1) return 'Width and height must be >= 1.';
    if (x + width > imageDims.width) return `x + width exceeds frame width (${imageDims.width}).`;
    if (y + height > imageDims.height) return `y + height exceeds frame height (${imageDims.height}).`;
    return null;
  };

  const hasSlotErrors = importSlots.some((s, i) => getSlotError(s, i) !== null);
  const hasNameError = importName.trim().length < 1 || importName.trim().length > 40;

  // ─── Save handlers ────────────────────────────

  const handleImport = async () => {
    if (!importFile) return;
    setModalSaving(true);
    setModalError(null);
    try {
      const formData = new FormData();
      formData.append('frame', importFile);
      formData.append('name', importName || 'Custom Frame');

      const res = await fetch('/api/frames', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed.');
      }
      const data = await res.json();

      // If user edited slots, update them
      if (editingSlots && importSlots.length > 0) {
        const putRes = await fetch(`/api/frames/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slots: importSlots, name: importName.trim() || data.name }),
        });
        if (!putRes.ok) {
          const err = await putRes.json();
          throw new Error(err.error || 'Failed to update slots.');
        }
        const updated = await putRes.json();
        setFrames((prev) => [...prev, updated]);
      } else {
        setFrames((prev) => [...prev, data]);
      }

      closeModal();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!frameModal || frameModal.mode !== 'edit') return;
    setModalSaving(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/frames/${frameModal.frameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: importName.trim(), slots: importSlots }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed.');
      }
      const updated = await res.json();

      // Update frames list
      setFrames((prev) => prev.map((f) => f.id === updated.id ? updated : f));

      // Session safety: if edited frame is the active session frame, swap it
      if (sessionFrame && sessionFrame.id === updated.id) {
        swapFrame({ ...updated, imageSrc: `/api/frames/${updated.id}/image?v=${updated.updatedAt || ''}` });
      }

      closeModal();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalSaving(false);
    }
  };

  // ─── Delete ─────────────────────────────────────

  const openDeleteConfirm = (frame) => {
    setDeleteTarget(frame);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/frames/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Delete failed.');
      }

      setFrames((prev) => prev.filter((f) => f.id !== deleteTarget.id));

      // Clear selection if the deleted frame was selected
      if (selectedId === deleteTarget.id) setSelectedId(null);

      // Session safety: if deleted frame is the active session frame, reset session
      if (sessionFrame && sessionFrame.id === deleteTarget.id) {
        reset();
      }

      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Slot editor helpers ───────────────────────

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
      return next.map((s, i) => ({ ...s, id: `slot-${i + 1}` }));
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

  // ─── Computed state ────────────────────────────

  const isEditMode = frameModal?.mode === 'edit';
  const modalTitle = isEditMode ? 'EDIT FRAME' : 'IMPORT CUSTOM FRAME';
  const primaryLabel = isEditMode ? 'SAVE' : 'IMPORT';
  const primaryDisabled = isEditMode
    ? (hasSlotErrors || hasNameError || importSlots.length === 0 || modalSaving)
    : (!importFile || hasSlotErrors || modalSaving);

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
                  style={{ textAlign: 'center', padding: 'var(--sp-3)', position: 'relative' }}
                >
                  {/* Edit/Delete icons */}
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px',
                    display: 'flex', gap: '4px', zIndex: 1,
                  }}>
                    <button
                      className="btn btn--icon"
                      onClick={(e) => { e.stopPropagation(); openEditModal(frame); }}
                      title="Edit frame"
                      style={{ padding: '4px', minWidth: '36px', minHeight: '36px' }}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      className="btn btn--icon"
                      onClick={(e) => { e.stopPropagation(); openDeleteConfirm(frame); }}
                      title="Delete frame"
                      style={{ padding: '4px', minWidth: '36px', minHeight: '36px' }}
                    >
                      <Icon name="delete" size={16} />
                    </button>
                  </div>

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
                      src={`/api/frames/${frame.id}/image?v=${frame.updatedAt || ''}`}
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
                onClick={openCreateModal}
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

      {/* Create / Edit Frame Modal */}
      <Modal
        open={!!frameModal}
        onClose={closeModal}
        title={modalTitle}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              CANCEL
            </Button>
            <Button
              variant="primary"
              disabled={primaryDisabled}
              onClick={isEditMode ? handleEditSave : handleImport}
            >
              {modalSaving ? 'SAVING...' : primaryLabel}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {/* File upload — only in create mode */}
          {!isEditMode && (
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
          )}

          {/* Name */}
          <div className="input-group">
            <label className="input-label">FRAME NAME</label>
            <input
              className="input-field"
              type="text"
              value={importName}
              onChange={(e) => { setImportName(e.target.value); setModalError(null); }}
              placeholder="e.g. My Custom Frame"
              maxLength={40}
            />
            {hasNameError && importName.length > 0 && (
              <span className="input-helper" style={{ color: 'var(--color-error)' }}>
                Name must be 1-40 characters.
              </span>
            )}
          </div>

          {/* Preview + Slots */}
          {importPreview && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-2)' }}>
                <p className="input-label" style={{ margin: 0 }}>
                  DETECTED SLOTS ({importSlots.length})
                </p>
                <Button variant="secondary" size="sm" onClick={handleRedetect}>
                  RE-DETECT SLOTS
                </Button>
              </div>
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
                {/* Slot overlays — using imageDims for correct scaling */}
                {importSlots.map((slot, idx) => (
                  <div
                    key={slot.id}
                    style={{
                      position: 'absolute',
                      left: `${(slot.x / imageDims.width) * 100}%`,
                      top: `${(slot.y / imageDims.height) * 100}%`,
                      width: `${(slot.width / imageDims.width) * 100}%`,
                      height: `${(slot.height / imageDims.height) * 100}%`,
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
                {importSlots.map((slot, idx) => {
                  const error = getSlotError(slot, idx);
                  return (
                    <div key={slot.id}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--sp-2)',
                          marginBottom: error ? '2px' : 'var(--sp-1)',
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
                      {error && (
                        <span className="input-helper" style={{ color: 'var(--color-error)', fontSize: '11px', marginBottom: 'var(--sp-1)', display: 'block', paddingLeft: '50px' }}>
                          {error}
                        </span>
                      )}
                    </div>
                  );
                })}
                <Button variant="secondary" size="sm" onClick={addSlot} style={{ marginTop: 'var(--sp-2)' }}>
                  <Icon name="add" size={14} /> ADD SLOT
                </Button>
              </div>
            </div>
          )}

          {/* Modal-level error */}
          {modalError && (
            <div style={{ border: '3px solid var(--color-error)', padding: 'var(--sp-2)' }}>
              <p className="text-tiny" style={{ color: 'var(--color-error)' }}>{modalError}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
        title="DELETE FRAME"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDeleteTarget(null); setDeleteError(null); }}>
              CANCEL
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'DELETING...' : 'DELETE'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <p className="text-mono" style={{ fontSize: '14px' }}>
            DELETE &quot;{deleteTarget?.name}&quot;? THIS CANNOT BE UNDONE.
          </p>
          {deleteTarget && !deleteTarget.custom && (
            <p className="text-tiny" style={{ color: 'var(--content-secondary)' }}>
              BUILT-IN FRAMES ARE RESTORED ON THE NEXT <code>npm install</code>.
            </p>
          )}
          {deleteError && (
            <div style={{ border: '3px solid var(--color-error)', padding: 'var(--sp-2)' }}>
              <p className="text-tiny" style={{ color: 'var(--color-error)' }}>{deleteError}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
