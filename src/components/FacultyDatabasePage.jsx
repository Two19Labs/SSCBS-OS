import React, { useState, useMemo } from 'react';
import facultyDataRaw from '../data/faculty_directory.json';
import {
  BackIcon,
  SearchIcon,
  DoorIcon,
  UserIcon,
  CloseIcon,
} from './icons';
import './FacultyDatabasePage.css';

export default function FacultyDatabasePage({ onBack }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [designationFilter, setDesignationFilter] = useState('all');
  const [selectedProf, setSelectedProf] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const facultyList = useMemo(() => {
    return Array.isArray(facultyDataRaw) ? facultyDataRaw : [];
  }, []);

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

  return (
    <div className="faculty-db-page">
      {/* Header Section */}
      <div className="faculty-db-header">
        <button onClick={onBack} className="faculty-db-back-btn" aria-label="Go Back to Dashboard">
          <BackIcon size={16} />
          <span>Back to Dashboard</span>
        </button>

        <div className="faculty-db-title-section">
          <div className="faculty-db-title-row">
            <div className="faculty-header-icon">
              <UserIcon size={20} />
            </div>
            <h2>SSCBS Faculty Directory</h2>
            <span className="micro-label success">● OFFICIAL</span>
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
              onClick={() => window.open(prof.profileUrl || 'https://sscbs.du.ac.in/faculty/', '_blank')}
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
