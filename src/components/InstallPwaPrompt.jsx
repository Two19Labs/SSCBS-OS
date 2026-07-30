import React, { useState, useEffect } from 'react';
import './InstallPwaPrompt.css';

export default function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if running as installed standalone app
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      (typeof document !== 'undefined' && document.referrer && document.referrer.includes('android-app://'));
    
    if (inStandalone) {
      setIsStandalone(true);
      return;
    }

    // 2. Mobile detection (iOS / Android / mobile devices or narrow screen)
    const ua = (window.navigator.userAgent || '').toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    const mobileDevice = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua) || window.innerWidth <= 768;
    
    setIsIOS(iosDevice);
    setIsMobile(mobileDevice);

    // 3. Listen for browser install prompt (Android / Chrome)
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
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
          setSessionDismissed(true);
        }
      } catch (err) {
        console.error('PWA install prompt error:', err);
        setShowGuideModal(true);
      }
    } else {
      // If deferredPrompt is not directly available (e.g. iOS or browser restriction), show step-by-step guide
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    setSessionDismissed(true);
  };

  // Do not prompt if inside installed standalone app or session dismissed
  if (isStandalone || sessionDismissed) {
    return null;
  }

  // Show on mobile browser every time (or desktop if install prompt available)
  if (!isMobile && !deferredPrompt) {
    return null;
  }

  return (
    <>
      <div className="pwa-prompt-banner" role="banner" aria-label="Add to Home Screen Prompt">
        <div className="pwa-prompt-content">
          <img src="/sscbs_logo.png" alt="SSCBS OS" className="pwa-prompt-icon" width="40" height="40" />
          <div className="pwa-prompt-text">
            <span className="pwa-prompt-title">Add to Home Screen</span>
            <span className="pwa-prompt-desc">Use like an app for quick access anytime!</span>
          </div>
        </div>
        <div className="pwa-prompt-actions">
          <button className="pwa-prompt-btn-primary" onClick={handleInstallClick}>
            Add to Home Screen
          </button>
          <button className="pwa-prompt-btn-dismiss" onClick={handleDismiss} aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      {showGuideModal && (
        <div className="pwa-ios-overlay" onClick={() => setShowGuideModal(false)}>
          <div className="pwa-ios-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pwa-ios-header">
              <img src="/sscbs_logo.png" alt="SSCBS OS" width="44" height="44" className="pwa-modal-logo" />
              <div className="pwa-modal-header-text">
                <h3>Add SSCBS OS to Home Screen</h3>
                <p className="pwa-ios-subtitle">Use like an app for quick 1-tap access!</p>
              </div>
              <button className="pwa-ios-close" onClick={() => setShowGuideModal(false)} aria-label="Close">✕</button>
            </div>

            {isIOS ? (
              <ol className="pwa-ios-steps">
                <li>
                  <span className="step-num">1</span>
                  <span className="step-text">Tap the <strong>Share</strong> button <span className="share-icon-glyph">⎋</span> in Safari or Chrome.</span>
                </li>
                <li>
                  <span className="step-num">2</span>
                  <span className="step-text">Scroll down the share menu options.</span>
                </li>
                <li>
                  <span className="step-num">3</span>
                  <span className="step-text">Tap <strong>"Add to Home Screen"</strong> <span className="add-icon-glyph">➕</span>.</span>
                </li>
              </ol>
            ) : (
              <ol className="pwa-ios-steps">
                <li>
                  <span className="step-num">1</span>
                  <span className="step-text">Tap the browser menu (<strong>⋮</strong> 3 dots in top right).</span>
                </li>
                <li>
                  <span className="step-num">2</span>
                  <span className="step-text">Select <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong>.</span>
                </li>
                <li>
                  <span className="step-num">3</span>
                  <span className="step-text">Confirm to add the SSCBS OS icon to your phone screen!</span>
                </li>
              </ol>
            )}

            <button className="pwa-ios-done" onClick={() => setShowGuideModal(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
