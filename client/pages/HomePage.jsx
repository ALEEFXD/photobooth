import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useCamera } from '../hooks/useCamera';
import Button from '../components/Button';
import StatusIndicator from '../components/StatusIndicator';
import Icon from '../components/Icon';
import Modal from '../components/Modal';

export default function HomePage() {
  const navigate = useNavigate();
  const { cameraStatus, setCameraStatus, setConfig, folder } = useSession();
  const { detectCamera } = useCamera();
  const [folders, setFolders] = useState([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [configData, setConfigData] = useState(null);

  useEffect(() => {
    // Load config
    fetch('/api/config').then(r => r.json()).then(data => {
      setConfigData(data);
      setConfig({
        folder: data.activeFolder,
        captureDelay: data.captureDelay,
        captureMode: data.captureMode,
      });
    }).catch(() => {});

    // Load folders
    fetch('/api/folders').then(r => r.json()).then(data => {
      setFolders(data.folders || []);
    }).catch(() => {});

    // Detect camera
    detectCamera();
  }, []);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfig({ folder: data.name });
        setFolders(prev => [...prev, { name: data.name, draftCount: 0, resultCount: 0 }]);
        setShowFolderModal(false);
        setNewFolderName('');
      }
    } catch {}
  };

  const handleSetActiveFolder = async (name) => {
    try {
      await fetch('/api/folders/active', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      setConfig({ folder: name });
    } catch {}
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--sp-5)',
      gap: 'var(--sp-6)',
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '80px', letterSpacing: '8px', marginBottom: 'var(--sp-2)' }}>
          PHOTOBOOTH
        </h1>
        <p className="text-mono" style={{ letterSpacing: '3px' }}>
          CAPTURE · FRAME · PRINT
        </p>
      </div>

      {/* Film Button */}
      <Button
        variant="primary"
        size="lg"
        icon="movie"
        iconSize={32}
        onClick={() => navigate('/frames')}
        style={{ padding: '24px 64px', fontSize: '22px', letterSpacing: '4px' }}
      >
        START SESSION
      </Button>

      {/* Status Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <StatusIndicator cameraStatus={cameraStatus} />

        <div className="chip chip--filter" style={{ cursor: 'default' }}>
          <Icon name="folder" size={14} style={{ marginRight: '4px' }} />
          {folder || 'default'}
        </div>

        <button
          className="btn btn--icon"
          onClick={() => setShowFolderModal(true)}
          title="Add folder"
          style={{ padding: '4px' }}
        >
          <Icon name="add" size={20} />
        </button>
      </div>

      {/* Camera warnings */}
      {cameraStatus?.warnings?.length > 0 && (
        <div style={{
          border: '3px solid var(--color-warning)',
          padding: 'var(--sp-3)',
          maxWidth: '500px',
          textAlign: 'center',
        }}>
          <p className="text-small" style={{ color: 'var(--color-warning)' }}>
            {cameraStatus.warnings[0]}
          </p>
        </div>
      )}

      {/* Folder list */}
      {folders.length > 0 && (
        <div style={{ maxWidth: '400px', width: '100%' }}>
          <p className="input-label" style={{ marginBottom: 'var(--sp-2)' }}>FOLDERS</p>
          {folders.map((f) => (
            <div
              key={f.name}
              onClick={() => handleSetActiveFolder(f.name)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '3px solid var(--color-black)',
                cursor: 'pointer',
                background: f.name === folder ? 'var(--color-black)' : 'transparent',
                color: f.name === folder ? 'var(--color-white)' : 'var(--color-black)',
                paddingLeft: '8px',
                paddingRight: '8px',
              }}
            >
              <span className="text-mono" style={{ fontSize: '14px' }}>{f.name}</span>
              <span className="text-tiny">
                {f.draftCount}D · {f.resultCount}R
              </span>
            </div>
          ))}
        </div>
      )}

      {/* New Folder Modal */}
      <Modal
        open={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        title="NEW FOLDER"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowFolderModal(false)}>
              CANCEL
            </Button>
            <Button variant="primary" onClick={handleCreateFolder}>
              CREATE
            </Button>
          </>
        }
      >
        <div className="input-group">
          <label className="input-label">FOLDER NAME</label>
          <input
            className="input-field"
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="e.g. wedding-oct"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            autoFocus
          />
          <span className="input-helper">
            Letters, numbers, hyphens, underscores only.
          </span>
        </div>
      </Modal>
    </div>
  );
}
