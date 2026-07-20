import React, { useState, useEffect } from 'react';
import './InstallPwaPrompt.css';

export default function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if app is already installed / standalone
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    
    if (inStandalone) {
      setIsStandalone(true);
      return;
    }

    // 2. Check dismissal state
    const dismissed = localStorage.getItem('sscbs-pwa-dismissed');
    if (dismissed) {
      setIsDismissed(true);
    }

    // 3. Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(iosDevice);

    // 4. Capture Android/Chrome install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsDismissed(true);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('sscbs-pwa-dismissed', 'true');
  };

  // Don't render if already in standalone mode or dismissed (unless user triggers iOS modal)
  if (isStandalone || (isDismissed && !showIOSModal)) {
    return null;
  }

  // If iOS install prompt trigger or modal is active
  if (!deferredPrompt && !isIOS) {
    return null;
  }

  return (
    <>
      <div className="pwa-prompt-banner" role="banner" aria-label="Add to Home Screen Prompt">
        <div className="pwa-prompt-content">
          <img src="/sscbs_logo.png" alt="SSCBS OS" className="pwa-prompt-icon" width="36" height="36" />
          <div className="pwa-prompt-text">
            <span className="pwa-prompt-title">Add SSCBS OS to Home Screen</span>
            <span className="pwa-prompt-desc">
              {isIOS ? 'Use on the go like a native app!' : 'Instant access to timetables & tools.'}
            </span>
          </div>
        </div>
        <div className="pwa-prompt-actions">
          <button className="pwa-prompt-btn-primary" onClick={handleInstallClick}>
            {isIOS ? 'How to Add' : 'Add to Home Screen'}
          </button>
          <button className="pwa-prompt-btn-dismiss" onClick={handleDismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>
      </div>

      {showIOSModal && (
        <div className="pwa-ios-overlay" onClick={() => setShowIOSModal(false)}>
          <div className="pwa-ios-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pwa-ios-header">
              <img src="/sscbs_logo.png" alt="" width="40" height="40" />
              <h3>Add SSCBS OS to Home Screen</h3>
              <button className="pwa-ios-close" onClick={() => setShowIOSModal(false)}>✕</button>
            </div>
            <p className="pwa-ios-subtitle">Follow these quick steps in Safari/Chrome on iOS:</p>
            <ol className="pwa-ios-steps">
              <li>
                <span className="step-num">1</span>
                <span className="step-text">Tap the <strong>Share</strong> button <span className="share-icon-glyph">⎋</span> at the bottom (or top) of your browser.</span>
              </li>
              <li>
                <span className="step-num">2</span>
                <span className="step-text">Scroll down the share sheet options.</span>
              </li>
              <li>
                <span className="step-num">3</span>
                <span className="step-text">Tap <strong>"Add to Home Screen"</strong> <span className="add-icon-glyph">➕</span>.</span>
              </li>
            </ol>
            <button className="pwa-ios-done" onClick={() => setShowIOSModal(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
