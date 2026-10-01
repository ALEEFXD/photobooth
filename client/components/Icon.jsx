import React from 'react';

/**
 * RawBlock Icon component.
 * Renders a Material Icons ligature. Square, black, no decoration.
 */
export default function Icon({ name, size = 24, className = '', style = {}, ...props }) {
  return (
    <span
      className={`material-icons ${className}`}
      style={{ fontSize: size, ...style }}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  );
}
