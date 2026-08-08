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

  const facultyList = useMemo(() => {
    return Array.isArray(facultyDataRaw) ? facultyDataRaw : [];
  }, []);

  // Compute unique designations for filter chips
  const designations = useMemo(() => {
    const set = new Set();
    facultyList.forEach((f) => {
      if (f.designation) set.add(f.designation);
    });
    return ['all', ...Array.from(set)];
  }, [facultyList]);

  // Filter faculty based on search and designation
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

  const getInitials = (name) => {
    if (!name) return 'FC';
    const clean = name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '');
    const parts = clean.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  return (
    <div className="faculty-db-container">
      {/* Header Section */}
      <div className="faculty-db-header">
        <button onClick={onBack} className="faculty-db-back-btn" aria-label="Go Back">
          <BackIcon /> Back to Dashboard
        </button>

        <div className="faculty-title-row">
          <div>
            <h1 className="faculty-main-heading">
              <UserIcon /> SSCBS Faculty Directory
            </h1>
            <p className="faculty-subheading">
              Official database of professors, room numbers, contact info, expertise, and research publications.
            </p>
          </div>

          <span className="exclusive-preview-badge">
            ⚡ Admin Exclusive Preview
          </span>
        </div>
      </div>

      {/* Control Bar (Search & Filters) */}
      <div className="faculty-controls-card">
        <div className="faculty-search-box">
          <SearchIcon className="faculty-search-icon" />
          <input
            type="text"
            className="faculty-search-input"
            placeholder="Search by Professor Name, Room No., Email, or Subject Expertise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="faculty-filter-chips">
          {designations.map((desig) => (
            <button
              key={desig}
              className={`faculty-filter-chip ${
                designationFilter === desig ? 'active' : ''
              }`}
              onClick={() => setDesignationFilter(desig)}
            >
              {desig === 'all' ? 'All Faculty' : desig}
            </button>
          ))}
        </div>
      </div>

      {/* Faculty Cards Grid */}
      {filteredFaculty.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: '600' }}>No faculty members found</p>
          <p style={{ fontSize: '0.9rem' }}>Try clearing your search query or changing filters.</p>
        </div>
      ) : (
        <div className="faculty-grid">
          {filteredFaculty.map((prof) => (
            <div key={prof.id || prof.name} className="faculty-card">
              <div>
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
                          e.target.nextSibling.style.display = 'flex';
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
                    <span className="faculty-designation-badge">{prof.designation}</span>
                  </div>
                </div>

                <div className="faculty-details-row">
                  <div className="faculty-room-pill" title="Office / Room Location">
                    <DoorIcon /> {prof.room}
                  </div>

                  <div className="faculty-detail-item">
                    <a
                      href={`mailto:${prof.email}`}
                      className="faculty-email-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ✉️ {prof.email}
                    </a>
                  </div>
                </div>

                {prof.expertise && prof.expertise.length > 0 && (
                  <div className="faculty-expertise-wrap">
                    {prof.expertise.slice(0, 3).map((exp, idx) => (
                      <span key={idx} className="expertise-tag">
                        {exp}
                      </span>
                    ))}
                    {prof.expertise.length > 3 && (
                      <span className="expertise-tag">+{prof.expertise.length - 3} more</span>
                    )}
                  </div>
                )}
              </div>

              <div className="faculty-card-actions">
                <a
                  href={`mailto:${prof.email}`}
                  className="faculty-btn-secondary"
                  onClick={(e) => e.stopPropagation()}
                >
                  Email
                </a>

                <button
                  className="faculty-btn-primary"
                  onClick={() => setSelectedProf(prof)}
                >
                  View Profile
                </button>
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
              <CloseIcon />
            </button>

            <div className="faculty-modal-header">
              <div className="faculty-modal-avatar">
                {selectedProf.photoUrl ? (
                  <img src={selectedProf.photoUrl} alt={selectedProf.name} />
                ) : (
                  <div className="faculty-avatar-placeholder">
                    {getInitials(selectedProf.name)}
                  </div>
                )}
              </div>

              <div>
                <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.4rem', color: '#0f172a' }}>
                  {selectedProf.name}
                </h2>
                <p style={{ margin: '0 0 0.5rem 0', color: '#64748b', fontSize: '0.9rem' }}>
                  {selectedProf.qualification}
                </p>
                <span className="faculty-designation-badge">
                  {selectedProf.designation}
                </span>

                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="faculty-room-pill">
                    <DoorIcon /> {selectedProf.room}
                  </span>
                  <a
                    href={`mailto:${selectedProf.email}`}
                    className="faculty-room-pill"
                    style={{ textDecoration: 'none', color: '#2563eb' }}
                  >
                    ✉️ {selectedProf.email}
                  </a>
                </div>
              </div>
            </div>

            {/* Expertise */}
            {selectedProf.expertise && selectedProf.expertise.length > 0 && (
              <div>
                <h4 className="faculty-modal-section-title">
                  <UserIcon /> Areas of Expertise
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
                      {edu}
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

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <a
                href={selectedProf.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="faculty-btn-primary"
                style={{ display: 'inline-flex', width: 'auto', padding: '0.65rem 1.25rem' }}
              >
                View Official DU Profile ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
