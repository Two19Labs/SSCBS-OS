import React, { useEffect, useRef, useState } from 'react';
import './OneStopTeaserModal.css';

const LinkedInIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.8v8.37h-2.8V10.9M7.86 6.54a1.63 1.63 0 1 0 0 3.26 1.63 1.63 0 0 0 0-3.26z" />
  </svg>
);

const CloseIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function OneStopTeaserModal({ isOpen, onClose, anchorRef }) {
  const cardRef = useRef(null);
  const [coords, setCoords] = useState(null);

  // Position relative to the sidebar anchor item on desktop
  useEffect(() => {
    if (!isOpen) return;

    const computePosition = () => {
      if (typeof window !== 'undefined' && window.innerWidth >= 900 && anchorRef?.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        // The pointer arrow sits at top: 38px inside the card (center is at 38px + 7.5px = ~45.5px)
        const targetCenterY = rect.top + rect.height / 2;
        const targetTop = Math.max(16, targetCenterY - 45.5);
        const targetLeft = rect.right + 12;
        setCoords({ top: targetTop, left: targetLeft });
      } else {
        setCoords(null);
      }
    };

    computePosition();
    window.addEventListener('resize', computePosition);
    window.addEventListener('scroll', computePosition);

    return () => {
      window.removeEventListener('resize', computePosition);
      window.removeEventListener('scroll', computePosition);
    };
  }, [isOpen, anchorRef]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        if (anchorRef?.current && anchorRef.current.contains(e.target)) {
          return;
        }
        onClose();
      }
    };

    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div className="onestop-popover-portal">
      {/* Semi-transparent backdrop for click-away dismissal */}
      <div className="onestop-popover-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Flyout Card */}
      <div 
        ref={cardRef} 
        className="onestop-popover-card" 
        role="dialog" 
        aria-modal="true"
        aria-labelledby="onestop-popover-title"
        style={coords ? { top: `${coords.top}px`, left: `${coords.left}px` } : undefined}
      >
        {/* Left pointer triangle for desktop flyout */}
        <div className="onestop-popover-pointer" aria-hidden="true" />

        {/* Top bar: Coming very soon & Close button */}
        <div className="onestop-popover-top">
          <div className="onestop-popover-badge">
            <span className="onestop-popover-dot" />
            <span>COMING VERY SOON</span>
          </div>
          <button 
            type="button" 
            className="onestop-popover-close" 
            onClick={onClose} 
            aria-label="Close dialog"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Heading */}
        <h2 id="onestop-popover-title" className="onestop-popover-title">
          Competitions is getting a huge upgrade.
        </h2>

        {/* Subtitle */}
        <p className="onestop-popover-desc">
          We’re working on something new for competitions at CBS. It’s coming very soon.
        </p>

        {/* Brand identity box */}
        <div className="onestop-popover-brand-box">
          <img 
            src="/onestop-logo.png" 
            alt="OneStop" 
            className="onestop-popover-logo" 
          />
          <div className="onestop-popover-divider" />
          <span className="onestop-popover-credit">by Two19 Labs</span>
        </div>

        {/* Action button */}
        <a
          href="https://lnkd.in/p/g3xH3enr"
          target="_blank"
          rel="noopener noreferrer"
          className="onestop-popover-cta"
        >
          <span className="onestop-linkedin-icon-box">
            <LinkedInIcon size={15} />
          </span>
          <span>Read the LinkedIn post</span>
          <span className="onestop-popover-arrow">↗</span>
        </a>

        {/* Early access comment notice */}
        <p className="onestop-popover-note">
          Want early access? Drop your email in the post's comments.
        </p>
      </div>
    </div>
  );
}
