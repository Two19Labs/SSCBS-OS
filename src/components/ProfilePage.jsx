import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isAdminEmail, isTimeWarpEnabled, setTimeWarpEnabled } from '../lib/admin';
import { ChevronRight } from './icons';
import './ProfilePage.css';

const COURSES = ['BMS', 'BBA FIA', 'Bsc Comp Sci'];
const SEMESTERS = [
  { value: '1', label: 'Sem 1 (1st Yr)' },
  { value: '2', label: 'Sem 2 (1st Yr)' },
  { value: '3', label: 'Sem 3 (2nd Yr)' },
  { value: '4', label: 'Sem 4 (2nd Yr)' },
  { value: '5', label: 'Sem 5 (3rd Yr)' },
  { value: '6', label: 'Sem 6 (3rd Yr)' },
  { value: '7', label: 'Sem 7 (4th Yr)' },
  { value: '8', label: 'Sem 8 (4th Yr)' },
];

const sectionOptionsFor = (course) => {
  if (course === 'BMS') return ['A', 'B', 'C', 'D'];
  if (course === 'BBA FIA') return ['A', 'B'];
  return ['A'];
};

export default function ProfilePage({ onNavigate }) {
  const { user, updateProfile, signOut } = useAuth();
  const { preference, setPreference } = useTheme();

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [course, setCourse] = useState(user?.user_metadata?.course || 'BMS');
  const [semester, setSemester] = useState(user?.user_metadata?.semester || '2');
  const [section, setSection] = useState(user?.user_metadata?.section || 'A');
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [timeWarp, setTimeWarp] = useState(isTimeWarpEnabled());
  const saveTimer = useRef(null);
  const dirty = useRef(false);

  const email = user?.email || '';
  const isAdmin = isAdminEmail(email);
  const displayName = fullName || email.split('@')[0] || 'Student';

  // Keep section valid when course changes
  useEffect(() => {
    const options = sectionOptionsFor(course);
    if (!options.includes(section)) setSection(options[0]);
  }, [course]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save whenever profile fields change
  useEffect(() => {
    if (!dirty.current) return;
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await updateProfile({ full_name: fullName, course, semester, section });
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch {
        setSaveState('error');
      }
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [fullName, course, semester, section]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = (setter) => (value) => {
    dirty.current = true;
    setter(value);
  };

  const handleSignOut = async () => {
    if (!window.confirm('Sign out of SSCBS Campus OS?')) return;
    try {
      await signOut();
    } catch (err) {
      alert(err.message || 'Failed to sign out.');
    }
  };

  const toggleTimeWarp = () => {
    const next = !timeWarp;
    setTimeWarp(next);
    setTimeWarpEnabled(next);
  };

  return (
    <div className="profile-page">
      <div className="profile-identity-card">
        <div className="profile-avatar">{displayName.charAt(0).toUpperCase()}</div>
        <div className="profile-identity-text">
          <input
            className="profile-name-input"
            value={fullName}
            placeholder="Your name"
            onChange={(e) => markDirty(setFullName)(e.target.value)}
            aria-label="Full name"
          />
          <span className="profile-email">{email}</span>
        </div>
        <span className={`profile-save-state ${saveState}`}>
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && '✓ Saved'}
          {saveState === 'error' && 'Save failed'}
        </span>
      </div>

      <div className="profile-group-label">MY CLASS</div>
      <div className="profile-group">
        <label className="profile-row">
          <span className="profile-row-label">Course</span>
          <span className="profile-row-value">
            <select value={course} onChange={(e) => markDirty(setCourse)(e.target.value)}>
              {COURSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronRight />
          </span>
        </label>
        <label className="profile-row">
          <span className="profile-row-label">Semester</span>
          <span className="profile-row-value">
            <select value={semester} onChange={(e) => markDirty(setSemester)(e.target.value)}>
              {SEMESTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronRight />
          </span>
        </label>
        <label className="profile-row">
          <span className="profile-row-label">Section</span>
          <span className="profile-row-value">
            <select
              value={section}
              onChange={(e) => markDirty(setSection)(e.target.value)}
              disabled={sectionOptionsFor(course).length <= 1}
            >
              {sectionOptionsFor(course).map((s) => (
                <option key={s} value={s}>Section {s}</option>
              ))}
            </select>
            <ChevronRight />
          </span>
        </label>
      </div>

      <div className="profile-group-label">APPEARANCE</div>
      <div className="profile-group">
        <div className="profile-row no-chevron">
          <span className="profile-row-label">Theme</span>
          <div className="theme-segment" role="radiogroup" aria-label="Theme">
            {['light', 'dark', 'system'].map((mode) => (
              <button
                key={mode}
                role="radio"
                aria-checked={preference === mode}
                className={`theme-segment-btn ${preference === mode ? 'active' : ''}`}
                onClick={() => setPreference(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isAdmin && (
        <>
          <div className="profile-group-label">ADMIN</div>
          <div className="profile-group">
            <button className="profile-row profile-row-btn" onClick={() => onNavigate('admin')}>
              <span className="profile-row-label">Admin console</span>
              <span className="profile-row-value"><ChevronRight /></span>
            </button>
            <div className="profile-row no-chevron">
              <div className="profile-row-stack">
                <span className="profile-row-label">Time-warp simulator</span>
                <span className="profile-row-hint">Show time simulation controls in trackers</span>
              </div>
              <button
                className={`switch ${timeWarp ? 'on' : ''}`}
                role="switch"
                aria-checked={timeWarp}
                onClick={toggleTimeWarp}
              >
                <span className="switch-knob" />
              </button>
            </div>
          </div>
        </>
      )}

      <button className="profile-signout" onClick={handleSignOut}>Sign out</button>
    </div>
  );
}
