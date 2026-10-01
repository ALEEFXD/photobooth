import React from 'react';
import Icon from './Icon';

/**
 * RawBlock Button.
 * Variants: primary, secondary, ghost, destructive, icon
 * Sizes: sm, md, lg
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconSize,
  children,
  disabled = false,
  className = '',
  ...props
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    variant !== 'icon' && variant !== 'ghost' ? `btn--${size}` : '',
    disabled ? 'btn--disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} disabled={disabled} {...props}>
      {icon && <Icon name={icon} size={iconSize || (size === 'sm' ? 16 : size === 'lg' ? 24 : 20)} />}
      {children}
    </button>
  );
}
