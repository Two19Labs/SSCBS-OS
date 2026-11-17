import React from 'react';
import './FtbBanner.css';

export default function FtbBanner() {
  return (
    <div className="ftb-banner-root recruitment-home-banner">
      <div className="ftb-banner-card">
        {/* Left Side: Content & Branding */}
        <div className="ftb-banner-content">
          <div className="ftb-banner-heading">
            <span>Your college companion,</span>
            <img 
              src="/ftb_logo.png" 
              alt="FTB Logo" 
              className="ftb-banner-logo" 
              loading="lazy"
            />
            <span className="ftb-banner-domain">ftbhustle.com</span>
          </div>

          <div className="ftb-banner-badges">
            <div className="ftb-badge-row">
              <span className="ftb-badge ftb-badge-accent">Internships</span>
              <span className="ftb-badge ftb-badge-dark">College top 1% guidance</span>
            </div>
            <div className="ftb-badge-row">
              <span className="ftb-badge ftb-badge-accent">National &amp; international opportunities</span>
              <span className="ftb-badge ftb-badge-dark">Guides</span>
            </div>
          </div>

          <div className="ftb-banner-tagline-wrap">
            <span className="ftb-banner-tagline">
              Turning your <span className="ftb-kalam">20’s ka suffer</span> into <span className="ftb-kalam">सफ़र</span>
            </span>
          </div>
        </div>

        {/* Desktop Actions (Inside card on desktop / tablet) */}
        <div className="ftb-banner-actions ftb-actions-desktop">
          <a
            href="https://chat.whatsapp.com/HS5p3n82TDJGVBG2pRSKyb"
            target="_blank"
            rel="noopener noreferrer"
            className="ftb-btn-whatsapp"
            aria-label="Join FTB Community on WhatsApp"
          >
            <svg 
              width="15" 
              height="15" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.75" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"></path>
              <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"></path>
            </svg>
            <span>Join Community</span>
          </a>
          <a
            href="https://www.ftbhustle.com/?utm_source=two19labs&utm_medium=referral&utm_campaign=partner-listing"
            target="_blank"
            rel="noopener noreferrer"
            className="ftb-btn-platform"
            aria-label="Visit FTB Platform"
          >
            <span>FTB Platform →</span>
          </a>
        </div>

        {/* Mascot Pingo */}
        <img
          src="/ftb_pingo.png"
          alt="FTB Mascot Pingo"
          aria-hidden="true"
          className="ftb-banner-mascot"
          loading="lazy"
        />
      </div>

      {/* Mobile Actions (Placed right below card on small screens for ideal touch ergonomics) */}
      <div className="ftb-banner-actions ftb-actions-mobile">
        <a
          href="https://chat.whatsapp.com/HS5p3n82TDJGVBG2pRSKyb"
          target="_blank"
          rel="noopener noreferrer"
          className="ftb-btn-whatsapp"
          aria-label="Join FTB Community on WhatsApp"
        >
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.75" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"></path>
            <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"></path>
          </svg>
          <span>Join Community</span>
        </a>
        <a
          href="https://www.ftbhustle.com/?utm_source=two19labs&utm_medium=referral&utm_campaign=partner-listing"
          target="_blank"
          rel="noopener noreferrer"
          className="ftb-btn-platform"
          aria-label="Visit FTB Platform"
        >
          <span>FTB Platform →</span>
        </a>
      </div>
    </div>
  );
}
