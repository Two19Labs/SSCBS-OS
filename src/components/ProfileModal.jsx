import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './ProfileModal.css';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, updateProfile } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [course, setCourse] = useState('BMS');
  const [semester, setSemester] = useState('2');
  const [section, setSection] = useState('A');
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  // Load initial user details
  useEffect(() => {
    if (user?.user_metadata) {
      setFullName(user.user_metadata.full_name || '');
      setCourse(user.user_metadata.course || 'BMS');
      setSemester(user.user_metadata.semester || '2');
      setSection(user.user_metadata.section || 'A');
    }
  }, [user, isOpen]);

  // Adjust section when course changes to keep it valid
  useEffect(() => {
    if (course === 'Bsc Comp Sci') {
      setSection('A');
    } else if (course === 'BBA FIA' && (section === 'C' || section === 'D')) {
      setSection('A');
    }
  }, [course]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      await updateProfile({
        full_name: fullName,
        course,
        semester,
        section
      });
      setStatus({ type: 'success', message: 'Profile updated successfully!' });
      
      // Close after delay
      setTimeout(() => {
        setStatus({ type: '', message: '' });
        onClose();
      }, 1000);
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  // Section options generator
  const getSectionOptions = () => {
    if (course === 'BMS') return ['A', 'B', 'C', 'D'];
    if (course === 'BBA FIA') return ['A', 'B'];
    return ['A']; // BSc Computer Science has one section
  };

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="profile-modal-header">
          <h3>Configure Profile</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">×</button>
        </header>

        <form onSubmit={handleSubmit} className="profile-modal-form">
          {status.message && (
            <div className={`status-banner ${status.type}`}>
              {status.type === 'success' ? '✓ ' : '⚠️ '}
              {status.message}
            </div>
          )}

          <div className="form-item">
            <label htmlFor="fullName">Full Name</label>
            <input
              type="text"
              id="fullName"
              placeholder="Enter your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-item">
            <label>College Course</label>
            <div className="radio-card-grid">
              {['BMS', 'BBA FIA', 'Bsc Comp Sci'].map((c) => (
                <div
                  key={c}
                  className={`radio-card ${course === c ? 'active' : ''}`}
                  onClick={() => setCourse(c)}
                >
                  <span className="radio-card-title">{c}</span>
                  <span className="radio-card-desc">
                    {c === 'BMS' && 'Management Studies'}
                    {c === 'BBA FIA' && 'Finance & Investment'}
                    {c === 'Bsc Comp Sci' && 'Computer Science'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-item flex-1">
              <label htmlFor="semester">Semester</label>
              <select
                id="semester"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="select-field"
              >
                <option value="2">Sem 2 (1st Yr)</option>
                <option value="4">Sem 4 (2nd Yr)</option>
                <option value="6">Sem 6 (3rd Yr)</option>
                <option value="8">Sem 8 (4th Yr)</option>
              </select>
            </div>

            <div className="form-item flex-1">
              <label htmlFor="section">Section</label>
              <select
                id="section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="select-field"
                disabled={getSectionOptions().length <= 1}
              >
                {getSectionOptions().map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <footer className="profile-modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save"
              disabled={loading}
            >
              {loading ? <span className="profile-spinner"></span> : 'Save Profile'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
