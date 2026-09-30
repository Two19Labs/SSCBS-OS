import React, { useEffect, useRef } from 'react';
import './BottomSheet.css';

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  headerRight,
  fullHeight = false,
  children,
  className = '',
}) {
  const sheetRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="bottom-sheet-root">
      <div className="bottom-sheet-backdrop" onClick={onClose} />
      <div
        ref={sheetRef}
        className={`bottom-sheet-container ${fullHeight ? 'full-height' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="bottom-sheet-handle-bar" onClick={onClose}>
          <div className="bottom-sheet-grab-handle" />
        </div>

        {(title || headerRight) && (
          <div className="bottom-sheet-header">
            {typeof title === 'string' ? (
              <h2 className="bottom-sheet-title">{title}</h2>
            ) : (
              title
            )}
            {headerRight}
          </div>
        )}

        <div className="bottom-sheet-content">
          {children}
        </div>
      </div>
    </div>
  );
}
