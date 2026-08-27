import React from 'react';

export default function StatusBadge({ tone, className = '', children, ...props }) {
  const classes = ['badge', `badge-${tone}`, className].filter(Boolean).join(' ');
  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
