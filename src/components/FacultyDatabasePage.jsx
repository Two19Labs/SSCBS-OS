import React, { useState, useMemo, useEffect } from 'react';
import facultyDataRaw from '../data/faculty_directory.json';
import {
  BackIcon,
  SearchIcon,
  DoorIcon,
  UserIcon,
  CloseIcon,
} from './icons';
import { trackFacultyEvent } from '../lib/analytics';
import { MOBILE_V2 } from '../lib/uiFlags';
import { useIsMobile } from '../hooks/useIsMobile';
import './FacultyDatabasePage.css';

export default function FacultyDatabasePage({ onBack, initialProfId, onClearPrefill, headerAction }) {
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState('permanent'); // 'permanent' | 'guest'
  const [expandedProfId, setExpandedProfId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [designationFilter, setDesignationFilter] = useState('all');
  const [selectedProf, setSelectedProf] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Debounced search query telemetry
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return;
    const timer = setTimeout(() => {
      trackFacultyEvent('search', {
        query: searchQuery.trim(),
        length: searchQuery.trim().length,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const facultyList = useMemo(() => {
    return Array.isArray(facultyDataRaw) ? facultyDataRaw : [];
  }, []);

  // Handle deep-linked professor selection from Society Tracker
  useEffect(() => {
    if (initialProfId && facultyList.length > 0) {
      const targetId = String(initialProfId).toLowerCase();
      const match = facultyList.find(
        (f) =>
          f.id === targetId ||
          f.name.toLowerCase() === targetId ||
          f.name.toLowerCase().includes(targetId)
      );
      if (match) {
        setSelectedProf(match);
      }
      if (typeof onClearPrefill === 'function') {
        onClearPrefill();
      }
    }
  }, [initialProfId, facultyList, onClearPrefill]);

  // Compute designation counts for filter chips
  const designationCounts = useMemo(() => {
    const counts = { all: facultyList.length };
    facultyList.forEach((f) => {
      const d = f.designation || 'Faculty Member';
      counts[d] = (counts[d] || 0) + 1;
    });
    return counts;
  }, [facultyList]);

  const filterKeys = useMemo(() => {
    return Object.keys(designationCounts);
  }, [designationCounts]);

  // Filter faculty based on search query and designation
  const filteredFaculty = useMemo(() => {
    return facultyList.filter((f) => {
      const matchesSearch =
        !searchQuery ||
        f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.qualification?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.room?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.expertise?.some((e) => e.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDesignation =
        designationFilter === 'all' || f.designation === designationFilter;

      return matchesSearch && matchesDesignation;
    });
  }, [facultyList, searchQuery, designationFilter]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleCopyEmail = (e, email) => {
    e.stopPropagation();
    if (!email || email === 'cbs@sscbsdu.ac.in') {
      showToast('General college email');
      return;
    }
    navigator.clipboard.writeText(email);
    showToast(`Copied ${email}!`);
  };

  const getInitials = (name) => {
    if (!name) return 'FC';
    const clean = name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '');
    const parts = clean.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const getDesignationClass = (desig) => {
    if (!desig) return 'badge-default';
    const lower = desig.toLowerCase();
    if (lower.includes('principal')) return 'badge-principal';
    if (lower.includes('associate')) return 'badge-associate';
    if (lower.includes('assistant')) return 'badge-assistant';
    if (lower.includes('guest')) return 'badge-guest';
    if (lower.includes('professor')) return 'badge-professor';
    return 'badge-default';
  };

  useEffect(() => {
    if (selectedProf) {
      setExpandedProfId(selectedProf.id);
      const isGuest = (selectedProf.designation || '').toLowerCase().includes('guest');
      setMobileTab(isGuest ? 'guest' : 'permanent');
    }
  }, [selectedProf]);

  const getCleanLetter = (name) => {
    const clean = (name || '').replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').trim();
    return clean ? clean[0].toUpperCase() : '#';
  };

  const mobileFaculty = useMemo(() => {
    return facultyList.filter(f => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          f.name?.toLowerCase().includes(q) ||
          f.qualification?.toLowerCase().includes(q) ||
          f.room?.toLowerCase().includes(q) ||
          f.email?.toLowerCase().includes(q) ||
          f.expertise?.some(e => e.toLowerCase().includes(q));
        if (!match) return false;
      }
      const isGuest = (f.designation || '').toLowerCase().includes('guest');
      if (mobileTab === 'guest' && !isGuest) return false;
      if (mobileTab === 'permanent' && isGuest) return false;
      return true;
    }).sort((a, b) => {
      const nameA = a.name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').trim();
      const nameB = b.name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').trim();
      return nameA.localeCompare(nameB);
    });
  }, [facultyList, searchQuery, mobileTab]);

  const groupedFaculty = useMemo(() => {
    const groups = {};
    mobileFaculty.forEach(prof => {
      const letter = getCleanLetter(prof.name);
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(prof);
    });
    return groups;
  }, [mobileFaculty]);

  const sortedLetters = useMemo(() => {
    return Object.keys(groupedFaculty).sort();
  }, [groupedFaculty]);

  if (MOBILE_V2 && isMobile) {
    return (
      <div className="m-fac-root">
        {/* Top App Bar (56px) */}
        <header className="m-fac-topbar">
          <button className="m-fac-icon-btn" onClick={onBack} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <h2 className="m-fac-title">Faculty Directory</h2>
        </header>

        {/* Scrollable Container */}
        <div className="m-fac-scroll-area">
          {/* Search Box */}
          <div className="m-fac-search-bar">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7A6D5F" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
            </svg>
            <input
              type="text"
              className="m-fac-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, room, email or subject"
            />
            {searchQuery && (
              <button className="m-fac-clear-btn" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>

          {/* Permanent / Guest Segmented Toggle */}
          <div className="m-fac-segmented">
            <button
              type="button"
              className={`m-fac-segment ${mobileTab === 'permanent' ? 'active' : ''}`}
              onClick={() => setMobileTab('permanent')}
            >
              Permanent
            </button>
            <button
              type="button"
              className={`m-fac-segment ${mobileTab === 'guest' ? 'active' : ''}`}
              onClick={() => setMobileTab('guest')}
            >
              Guest
            </button>
          </div>

          {/* Grouped Alphabetical List */}
          {sortedLetters.length === 0 ? (
            <div className="m-fac-empty">
              <h4>No professors found</h4>
              <p>Try searching with another name, room number, or subject keyword.</p>
              <button
                type="button"
                className="m-fac-btn-reset"
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </button>
            </div>
          ) : (
            sortedLetters.map(letter => (
              <div key={letter} className="m-fac-letter-section">
                <span className="m-fac-letter-label">{letter}</span>
                <div className="m-fac-group-items">
                  {groupedFaculty[letter].map((prof) => {
                    const isExpanded = expandedProfId === prof.id;
                    const cleanInit = getInitials(prof.name);
                    const metaText = prof.room
                      ? `${prof.qualification || prof.designation} · ${prof.room}`
                      : prof.qualification || prof.designation;

                    if (isExpanded) {
                      return (
                        <div
                          key={prof.id}
                          className="m-fac-card-expanded"
                          onClick={() => setExpandedProfId(null)}
                        >
                          <div className="m-fac-expanded-head">
                            <div className="m-fac-avatar-lg">
                              {cleanInit}
                            </div>
                            <div className="m-fac-expanded-info">
                              <span className="m-fac-expanded-name">{prof.name}</span>
                              <span className="m-fac-expanded-meta">{metaText}</span>
                            </div>
                          </div>
                          {/* strictly 2 buttons: Email and Copy */}
                          <div className="m-fac-actions-grid">
                            <a
                              href={`mailto:${prof.email}`}
                              className="m-fac-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                trackFacultyEvent('email_clicked', { name: prof.name, email: prof.email });
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                              </svg>
                              <span>Email</span>
                            </a>
                            <button
                              type="button"
                              className="m-fac-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyEmail(e, prof.email);
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                              </svg>
                              <span>Copy</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={prof.id}
                        className="m-fac-row"
                        onClick={() => setExpandedProfId(prof.id)}
                      >
                        <div className="m-fac-avatar-sm">
                          {cleanInit}
                        </div>
                        <div className="m-fac-row-info">
                          <span className="m-fac-row-name">{prof.name}</span>
                          <span className="m-fac-row-meta">{prof.qualification || prof.designation}</span>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A89A90" strokeWidth="2" strokeLinecap="round">
                          <polyline points="9 6 15 12 9 18"></polyline>
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <div style={{ height: 40 }} />
        </div>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="m-fac-toast">
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="faculty-db-page">
      {/* Header Section */}
      <div className="faculty-db-header">
        <div className="faculty-db-header-top">
          <button onClick={onBack} className="faculty-db-back-btn" aria-label="Go Back to Dashboard">
            <BackIcon size={16} />
            <span>Back to Dashboard</span>
          </button>
          {headerAction && (
            <div className="faculty-db-header-action desktop-only-notif">
              {headerAction}
            </div>
          )}
        </div>

        <div className="faculty-db-title-section">
          <div className="faculty-db-title-row">
            <div className="faculty-header-icon">
              <UserIcon size={20} />
            </div>
            <h2>SSCBS Faculty Directory</h2>
          </div>
          <p className="faculty-db-subtitle">
            Official directory of SSCBS professors, office room numbers, contact details, subject expertise, and research publications.
          </p>
        </div>
      </div>

      {/* Control Bar (Search & Filter Chips) */}
      <div className="faculty-controls-card">
        <div className="faculty-search-box">
          <span className="faculty-search-icon">
            <SearchIcon size={18} />
          </span>
          <input
            type="text"
            className="faculty-search-input"
            placeholder="Search by professor name, room no., email, or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="faculty-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear Search">
              ✕
            </button>
          )}
        </div>

        <div className="faculty-filter-chips">
          {filterKeys.map((desig) => (
            <button
              key={desig}
              className={`faculty-filter-chip ${
                designationFilter === desig ? 'active' : ''
              }`}
              onClick={() => setDesignationFilter(desig)}
            >
              <span>{desig === 'all' ? 'All Professors' : desig}</span>
              <span className="chip-count-badge">{designationCounts[desig]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Faculty Cards Grid */}
      {filteredFaculty.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--ink-dim)' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 0.25rem 0', color: 'var(--ink)' }}>No matching professors found</p>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>Try clearing your search query or switching filters.</p>
        </div>
      ) : (
        <div className="faculty-grid">
          {filteredFaculty.map((prof) => (
            <div
              key={prof.id || prof.name}
              className="faculty-card"
              onClick={() => {
                trackFacultyEvent('profile_link_clicked', { name: prof.name, room: prof.room });
                window.open(prof.profileUrl || 'https://sscbs.du.ac.in/faculty/', '_blank');
              }}
              style={{ cursor: 'pointer' }}
            >
                <div className="faculty-card-top">
                  <div className="faculty-avatar-container">
                    {prof.photoUrl ? (
                      <img
                        src={prof.photoUrl}
                        alt={prof.name}
                        className="faculty-avatar-img"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                          if (e.target.nextSibling) {
                            e.target.nextSibling.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className="faculty-avatar-placeholder"
                      style={{ display: prof.photoUrl ? 'none' : 'flex' }}
                    >
                      {getInitials(prof.name)}
                    </div>
                  </div>

                  <div className="faculty-info-header">
                    <h3 className="faculty-name" title={prof.name}>
                      {prof.name}
                    </h3>
                    {prof.qualification && (
                      <p className="faculty-degree">{prof.qualification}</p>
                    )}
                    <span className={`faculty-designation-badge ${getDesignationClass(prof.designation)}`}>
                      {prof.designation}
                    </span>
                  </div>
                </div>

                <div className="faculty-details-row">
                  <div className="faculty-room-pill" title="Office / Room Location">
                    <DoorIcon size={14} />
                    <span>{prof.room}</span>
                  </div>

                  <div className="faculty-email-row">
                    <a
                      href={`mailto:${prof.email}`}
                      className="faculty-email-link"
                      onClick={(e) => e.stopPropagation()}
                      title={`Send email to ${prof.email}`}
                    >
                      ✉️ {prof.email}
                    </a>
                    <button
                      className="copy-email-btn"
                      onClick={(e) => handleCopyEmail(e, prof.email)}
                      title="Copy Email Address"
                    >
                      📋
                    </button>
                  </div>

                  {prof.phone && (
                    <div className="faculty-email-row" style={{ marginTop: '4px' }}>
                      <a
                        href={`tel:${prof.phone.replace(/[\s-]/g, '')}`}
                        className="faculty-email-link"
                        style={{ color: 'var(--success)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        📞 {prof.phone}
                      </a>
                      <button
                        className="copy-email-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(prof.phone);
                          showToast(`Copied ${prof.phone}!`);
                        }}
                        title="Copy Phone Number"
                      >
                        📋
                      </button>
                    </div>
                  )}
                </div>

              <div className="faculty-card-actions">
                <a
                  href={prof.profileUrl || 'https://sscbs.du.ac.in/faculty/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="faculty-btn-primary"
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: '100%', textDecoration: 'none' }}
                >
                  View Profile ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Professor Detail Modal */}
      {selectedProf && (
        <div className="faculty-modal-overlay" onClick={() => setSelectedProf(null)}>
          <div className="faculty-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="faculty-modal-close"
              onClick={() => setSelectedProf(null)}
              aria-label="Close modal"
            >
              <CloseIcon size={18} />
            </button>

            <div className="faculty-modal-header">
              <div className="faculty-modal-avatar">
                {selectedProf.photoUrl ? (
                  <img
                    src={selectedProf.photoUrl}
                    alt={selectedProf.name}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="faculty-avatar-placeholder"
                  style={{ display: selectedProf.photoUrl ? 'none' : 'flex' }}
                >
                  {getInitials(selectedProf.name)}
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', color: 'var(--ink)', fontWeight: '800' }}>
                  {selectedProf.name}
                </h3>
                <p style={{ margin: '0 0 8px 0', color: 'var(--ink-dim)', fontSize: '0.85rem', fontWeight: '500' }}>
                  {selectedProf.qualification}
                </p>
                <span className={`faculty-designation-badge ${getDesignationClass(selectedProf.designation)}`}>
                  {selectedProf.designation}
                </span>

                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="faculty-room-pill">
                    <DoorIcon size={14} /> {selectedProf.room}
                  </span>
                  <a
                    href={`mailto:${selectedProf.email}`}
                    className="faculty-room-pill"
                    style={{ textDecoration: 'none', color: 'var(--accent)' }}
                  >
                    ✉️ {selectedProf.email}
                  </a>
                  {selectedProf.phone && (
                    <a
                      href={`tel:${selectedProf.phone.replace(/[\s-]/g, '')}`}
                      className="faculty-room-pill"
                      style={{ textDecoration: 'none', color: 'var(--success)' }}
                    >
                      📞 {selectedProf.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Expertise */}
            {selectedProf.expertise && selectedProf.expertise.length > 0 && (
              <div>
                <h4 className="faculty-modal-section-title">
                  <UserIcon size={16} /> Areas of Expertise
                </h4>
                <div className="faculty-expertise-wrap">
                  {selectedProf.expertise.map((exp, i) => (
                    <span key={i} className="expertise-tag">
                      {exp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Biography */}
            {selectedProf.biography && (
              <div>
                <h4 className="faculty-modal-section-title">Biography</h4>
                <p className="faculty-modal-text">{selectedProf.biography}</p>
              </div>
            )}

            {/* Education */}
            {selectedProf.education && selectedProf.education.length > 0 && (
              <div>
                <h4 className="faculty-modal-section-title">Education & Credentials</h4>
                <ul className="faculty-modal-list">
                  {selectedProf.education.map((edu, idx) => (
                    <li key={idx} className="faculty-modal-list-item">
                      🎓 {edu}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Publications */}
            {selectedProf.publications && selectedProf.publications.length > 0 && (
              <div>
                <h4 className="faculty-modal-section-title">Research & Publications</h4>
                <ul className="faculty-modal-list">
                  {selectedProf.publications.map((pub, idx) => (
                    <li key={idx} className="faculty-modal-list-item">
                      📄 {pub}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <a
                href={selectedProf.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="faculty-btn-primary"
                style={{ display: 'inline-flex', width: 'auto', padding: '10px 18px' }}
              >
                View Official DU Profile ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div className="faculty-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
