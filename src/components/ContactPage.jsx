import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { WhatsAppIcon, MailIcon, CopyIcon, CheckIcon, BackIcon } from './icons';
import './ContactPage.css';

const DEFAULT_WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '917007679485';
const DISPLAY_NUMBER = '+91 70076 79485';

const TOPICS = [
  { id: 'timetable', label: '📅 Timetable Error', text: 'Hi! I noticed an issue with my timetable on SSCBS OS.' },
  { id: 'feature', label: '💡 Feature Request', text: 'Hi team! I have an idea/feature request for SSCBS OS:' },
  { id: 'bug', label: '🐛 Report a Bug', text: 'Hi! I ran into a bug on SSCBS OS.' },
  { id: 'general', label: '💬 General Inquiry', text: 'Hi! I have a query regarding SSCBS OS.' },
];

export default function ContactPage({ onBack }) {
  const { user } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState('general');
  const [customNote, setCustomNote] = useState('');
  const [copied, setCopied] = useState(false);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student';
  const course = user?.user_metadata?.course || 'Not set';
  const sem = user?.user_metadata?.semester ? `Sem ${user.user_metadata.semester}` : '';
  const section = user?.user_metadata?.section ? `Sec ${user.section || user.user_metadata.section}` : '';
  const studentMeta = [course, sem, section].filter(Boolean).join(' · ');

  const currentTopicObj = TOPICS.find((t) => t.id === selectedTopic);

  const getFullMessage = () => {
    let baseText = currentTopicObj?.text || TOPICS[3].text;
    if (customNote.trim()) {
      baseText += `\n\nNote: ${customNote.trim()}`;
    }
    baseText += `\n\n— Sent from SSCBS OS\nStudent: ${displayName} (${user?.email || 'N/A'})\nDetails: ${studentMeta}`;
    return baseText;
  };

  const handleOpenWhatsApp = () => {
    const rawNum = DEFAULT_WHATSAPP_NUMBER.replace(/[^0-9]/g, '');
    const encodedText = encodeURIComponent(getFullMessage());
    const waUrl = `https://wa.me/${rawNum}?text=${encodedText}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(DISPLAY_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="contact-page">
      <header className="contact-header">
        {onBack && (
          <button className="btn-back" onClick={onBack} aria-label="Back">
            <BackIcon />
          </button>
        )}
        <div>
          <h2>Contact Us</h2>
          <p className="contact-subtitle">Direct support & feedback for SSCBS OS</p>
        </div>
      </header>

      {/* Main WhatsApp Card */}
      <div className="contact-card whatsapp-hero-card">
        <div className="whatsapp-card-badge">
          Instant DM
        </div>
        <div className="whatsapp-card-content">
          <div className="whatsapp-icon-wrap">
            <WhatsAppIcon size={28} />
          </div>
          <div className="whatsapp-card-text">
            <h3>Chat with us on WhatsApp</h3>
            <p>Directly reach out to our core developer team. We usually respond within a few hours!</p>
          </div>
        </div>

        {/* Topic Selector */}
        <div className="topic-selector-label">SELECT TOPIC</div>
        <div className="topic-grid">
          {TOPICS.map((topic) => (
            <button
              key={topic.id}
              className={`topic-chip ${selectedTopic === topic.id ? 'active' : ''}`}
              onClick={() => setSelectedTopic(topic.id)}
            >
              {topic.label}
            </button>
          ))}
        </div>

        {/* Custom note textarea */}
        <div className="custom-note-wrap">
          <label htmlFor="customNoteInput" className="custom-note-label">Message Details (Optional)</label>
          <textarea
            id="customNoteInput"
            className="custom-note-input"
            rows={3}
            placeholder="Type your message or details here..."
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
          />
        </div>

        {/* Action Button */}
        <button className="btn-whatsapp-dm" onClick={handleOpenWhatsApp}>
          <WhatsAppIcon size={20} />
          <span>Open WhatsApp DM</span>
        </button>
      </div>

      {/* Contact Details & Info Grid */}
      <div className="contact-grid">
        <div className="contact-card info-card">
          <div className="info-card-header">
            <div className="info-icon"><WhatsAppIcon size={20} /></div>
            <div>
              <h4>WhatsApp Support</h4>
              <p className="info-val">{DISPLAY_NUMBER}</p>
            </div>
          </div>
          <button className="btn-copy-num" onClick={handleCopyNumber}>
            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            <span>{copied ? 'Copied!' : 'Copy Number'}</span>
          </button>
        </div>

        <div className="contact-card info-card">
          <div className="info-card-header">
            <div className="info-icon"><MailIcon size={20} /></div>
            <div>
              <h4>House of Two19 Labs</h4>
              <p className="info-val">two19labs@gmail.com</p>
            </div>
          </div>
          <a
            href="mailto:two19labs@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-copy-num link-btn"
          >
            Send Email
          </a>
        </div>
      </div>

      {/* Developer Note Card */}
      <div className="contact-card dev-credit-card">
        <h4>Built for SSCBS Students</h4>
        <p>
          SSCBS OS is actively maintained by <strong>Aditya Singhani</strong> &amp; <strong>Manthan Kabra</strong> from <strong>Two19 Labs</strong>.
          Your feedback directly helps us ship new features and fix timetable updates faster.
        </p>
      </div>
    </div>
  );
}
