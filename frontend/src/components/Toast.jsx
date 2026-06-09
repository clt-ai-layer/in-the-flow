import React, { useEffect } from 'react';

export default function Toast({ message, onDismiss, durationMs = 4000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => onDismiss?.(), durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 200,
        padding: '12px 20px',
        borderRadius: '10px',
        background: 'var(--modal-surface)',
        border: '1px solid var(--glass-border)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: 'var(--shadow-glow)',
        maxWidth: '360px',
      }}
    >
      {message}
    </div>
  );
}
