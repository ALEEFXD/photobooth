import React from 'react';

/**
 * Full-screen countdown overlay.
 */
export default function Countdown({ seconds }) {
  if (seconds === null || seconds === undefined) return null;

  return (
    <div className="countdown-overlay">
      <div key={seconds} className="countdown-number">
        {seconds}
      </div>
    </div>
  );
}
