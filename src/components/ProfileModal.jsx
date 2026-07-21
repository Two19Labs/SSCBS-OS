import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTimetable } from '../context/TimetableContext';
import './ProfileModal.css';

const ALL_SEMESTERS = [
  { value: '1', label: 'Sem 1 (1st Yr)' },
  { value: '2', label: 'Sem 2 (1st Yr)' },
  { value: '3', label: 'Sem 3 (2nd Yr)' },
  { value: '4', label: 'Sem 4 (2nd Yr)' },
  { value: '5', label: 'Sem 5 (3rd Yr)' },
  { value: '6', label: 'Sem 6 (3rd Yr)' },
  { value: '7', label: 'Sem 7 (4th Yr)' },
  { value: '8', label: 'Sem 8 (4th Yr)' },
];

export default function ProfileModal({ isOpen, onClose }) {
  const { user, updateProfile, signOut } = useAuth();
  const { getActiveSemesters } = useTimetable();
  
  const [fullName, setFullName] = useState('');
  const [course, setCourse] = useState('BMS');
  const [semester, setSemester] = useState('2');
  const [section, setSection] = useState('A');
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const activeSemKeys = getActiveSemesters(course);
  const availableSemesters = ALL_SEMESTERS.filter(s => activeSemKeys.includes(s.value));

  // Keep semester valid if active semesters change
  useEffect(() => {
    if (availableSemesters.length > 0 && !availableSemesters.some(s => s.value === semester)) {
      setSemester(availableSemesters[0].value);
    }
  }, [course, activeSemKeys.join(',')]);

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

  const handleSignOut = async () => {
    if (!window.confirm('Are you sure you want to sign out?')) return;
    setLoading(true);
    setStatus({ type: '', message: '' });
    try {
      await signOut();
      onClose();
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to sign out.' });
    } finally {
      setLoading(false);
    }
  };

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

  if (!isOpen) return null;

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
                {availableSemesters.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
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
              className="btn-signout-modal"
              onClick={handleSignOut}
              disabled={loading}
            >
              Sign Out
            </button>
            <div className="footer-actions-right">
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
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
