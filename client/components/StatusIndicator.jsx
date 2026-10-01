import React from 'react';

/**
 * Camera status indicator chip.
 */
export default function StatusIndicator({ cameraStatus }) {
  if (!cameraStatus) {
    return (
      <span className="chip chip--status chip--status-default">
        DETECTING...
      </span>
    );
  }

  const { type, model, warnings } = cameraStatus;

  if (type === 'dslr') {
    return (
      <span className="chip chip--status chip--status-active" title={model}>
        DSLR
      </span>
    );
  }

  return (
    <span
      className={`chip chip--status ${warnings?.length ? 'chip--status-warning' : 'chip--status-default'}`}
      title={warnings?.join('\n') || model}
    >
      WEBCAM
    </span>
  );
}
