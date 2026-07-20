import React from 'react';
import './FooterCredit.css';

export default function FooterCredit({ className = '' }) {
  return (
    <footer className={`global-footer-credit ${className}`}>
      <span>
        Made with <span className="heart-icon">♥</span> by{' '}
        <a
          href="https://www.linkedin.com/in/aditya-singhani-69294a27a/"
          target="_blank"
          rel="noopener noreferrer"
          className="developer-name linkedin-link"
        >
          Aditya Singhani
        </a>{' '}
        &amp;{' '}
        <a
          href="https://www.linkedin.com/in/manthan-kabra/"
          target="_blank"
          rel="noopener noreferrer"
          className="developer-name linkedin-link"
        >
          Manthan Kabra
        </a>
      </span>
    </footer>
  );
}
