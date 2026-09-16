import React, { useState, useEffect, useMemo } from 'react';
import { CATEGORIES, DEMO_SOCIETIES, OFFICIAL_COLLEGE_SOCIETIES_URL } from '../data/societies';
import {
  SearchIcon,
  InstagramIcon,
  LinktreeIcon,
  LinkedinIcon,
  BackIcon,
  WhatsAppIcon,
} from './icons';
import { trackSocietyEvent } from '../lib/analytics';
import './SocietyTrackerPage.css';

// Fisher-Yates shuffle algorithm helper
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Map clean teacher names to faculty_directory.json IDs for seamless navigation
const FACULTY_NAME_TO_ID = {
  'anamika gupta': 'dr-anamika-gupta-ph-d',
  'shikha gupta': 'dr-shikha-gupta-ph-d',
  'anuja mathur': 'dr-anuja-mathur-ph-d',
  'tushar marwaha': 'tushar-marwaha-mba',
  'tushar marwah': 'tushar-marwaha-mba',
  'rashid shamim': 'md-rashid-shamim-mba',
  'md rashid shamim': 'md-rashid-shamim-mba',
  'mohd. rashid shamim': 'md-rashid-shamim-mba',
  'raj kumar': 'raj-kumar-ma',
  'satish kumar goel': 'dr-satish-kumar-goel-ph-d',
  'neeraj sehrawat': 'neeraj-sehrawat-ph-d',
  'neeraj kumar sehrawat': 'neeraj-sehrawat-ph-d',
  'neeraj k sehrawat': 'neeraj-sehrawat-ph-d',
  'amit kumar': 'amit-kumar-m-com',
  'ramesh kumar': 'ramesh-kumar-ph-d',
  'ramesh barpa': 'ramesh-kumar-ph-d',
  'ramesh kumar barpa': 'ramesh-kumar-ph-d',
  'amrina kausar': 'dr-amrina-kausar-ph-d',
  'mona verma': 'dr-mona-verma-ph-d',
  'madhu totla': 'ca-madhu-totla-maheshwari',
  'shalini prakash': 'shalini-prakash-m-phil',
  'kavita rastogi': 'kavita-rastogi-msc',
  'rishi rajan sahay': 'dr-rishi-rajan-sahay-ph-d',
  'paridhi': 'paridhi-mba',
  'kumar bijoy': 'kumar-bijoy-ma-eco-ph-d-cfa',
  'tarannum ahmad': 'dr-tarannum-ahmad-ph-d',
  'sonika thakral': 'dr-sonika-thakral-ph-d',
  'sushmita': 'dr-sushmita-ph-d',
  'onkar singh': 'onkar-singh-m-phil-m-sc',
  'saumya jain': 'saumya-jain-m-com',
  'nidhi kesari': 'dr-nidhi-kesari-ph-d',
  'poonam verma': 'poonam-verma',
};

export function getFacultyIdForName(rawName) {
  if (!rawName || typeof rawName !== 'string') return null;
  const clean = rawName
    .toLowerCase()
    .replace(/^(dr\.|prof\.|mr\.|ms\.|md\.|mohd\.)\s+/i, '')
    .replace(/\(convenor\)/i, '')
    .trim();
  return FACULTY_NAME_TO_ID[clean] || null;
}

export default function SocietyTrackerPage({ onBack, onNavigate, headerAction }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  // Randomized shuffled order generated once per load/refresh
  const [shuffledIds, setShuffledIds] = useState(() => shuffleArray(DEMO_SOCIETIES.map((s) => s.id)));
  const [sortBy, setSortBy] = useState('shuffled');
  const [selectedSociety, setSelectedSociety] = useState(null);

  // Debounced search query telemetry
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return;
    const timer = setTimeout(() => {
      trackSocietyEvent('search', {
        query: searchQuery.trim(),
        length: searchQuery.trim().length,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredSocieties = useMemo(() => {
    return DEMO_SOCIETIES.filter((society) => {
      const rawQuery = searchQuery.trim();
      if (rawQuery) {
        const query = rawQuery.toLowerCase();
        const cleanQ = query.replace(/[^a-z0-9]/g, '');

        const nameStr = (society.name || '').toLowerCase();
        const shortNameStr = (society.shortName || '').toLowerCase();
        const idStr = (society.id || '').toLowerCase();
        const descStr = (society.description || '').toLowerCase();
        const catLabelStr = (society.categoryLabel || '').toLowerCase();

        const cleanName = nameStr.replace(/[^a-z0-9]/g, '');
        const cleanShortName = shortNameStr.replace(/[^a-z0-9]/g, '');
        const cleanId = idStr.replace(/[^a-z0-9]/g, '');

        const matchName = nameStr.includes(query) || (cleanQ && cleanName.includes(cleanQ));
        const matchShortName = shortNameStr.includes(query) || (cleanQ && cleanShortName.includes(cleanQ));
        const matchId = idStr.includes(query) || (cleanQ && cleanId.includes(cleanQ));
        const matchDesc = descStr.includes(query);
        const matchCat = catLabelStr.includes(query);
        const matchSubCats =
          Array.isArray(society.categoryLabels) &&
          society.categoryLabels.some((lbl) => lbl.toLowerCase().includes(query));
        const matchPocs =
          Array.isArray(society.pocs) &&
          society.pocs.some(
            (poc) =>
              poc.name.toLowerCase().includes(query) ||
              (cleanQ && poc.phone.replace(/[^0-9]/g, '').includes(cleanQ))
          );
        const matchTics =
          Array.isArray(society.tics) &&
          society.tics.some((tic) => {
            const tLower = tic.toLowerCase();
            const cleanT = tLower.replace(/[^a-z0-9]/g, '');
            return tLower.includes(query) || (cleanQ && cleanT.includes(cleanQ));
          });

        const isMatch = matchName || matchShortName || matchId || matchDesc || matchCat || matchSubCats || matchPocs || matchTics;
        if (!isMatch) return false;
      } else if (selectedCategory !== 'all') {
        const hasCat =
          society.category === selectedCategory ||
          (Array.isArray(society.categories) && society.categories.includes(selectedCategory));
        if (!hasCat) return false;
      }

      return true;
    });
  }, [searchQuery, selectedCategory]);

  const shuffledIndexMap = useMemo(() => {
    const map = new Map();
    shuffledIds.forEach((id, index) => map.set(id, index));
    return map;
  }, [shuffledIds]);

  const sortedSocieties = useMemo(() => {
    return [...filteredSocieties].sort((a, b) => {
      if (sortBy === 'shuffled') {
        const idxA = shuffledIndexMap.get(a.id) ?? 0;
        const idxB = shuffledIndexMap.get(b.id) ?? 0;
        return idxA - idxB;
      }
      if (sortBy === 'name' || sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      return 0;
    });
  }, [filteredSocieties, sortBy, shuffledIndexMap]);

  const totalCount = DEMO_SOCIETIES.length;
  const totalDomainsCount = CATEGORIES.length - 1;
  const totalPocsCount = useMemo(
    () => DEMO_SOCIETIES.reduce((acc, s) => acc + (Array.isArray(s.pocs) ? s.pocs.length : 0), 0),
    []
  );

  return (
    <div className="society-tracker-container">
      {/* OS Standard Header Bar */}
      <div className="st-header">
        <div className="st-header-left">
          {onBack && (
            <button className="st-back-btn" onClick={onBack} aria-label="Go Back">
              <BackIcon size={16} />
            </button>
          )}
          <div className="st-header-text">
            <h1 className="st-title">Societies Database</h1>
            <p className="st-subtitle">
              Comprehensive directory of all {totalCount} official societies, cells &amp; student initiatives at SSCBS.
            </p>
          </div>
        </div>
        {headerAction && (
          <div className="st-header-right desktop-only-notif">
            {headerAction}
          </div>
        )}
      </div>

      {/* Directory Welcome Banner (Desktop only) */}
      <div className="st-directory-hero">
        <div className="st-hero-icon">🏛️</div>
        <div className="st-hero-content">
          <div className="st-hero-title">SSCBS Central Societies Database</div>
          <p className="st-hero-desc">
            Explore SSCBS's ecosystem of student-run societies and cells across {totalDomainsCount} distinct domains.
            Browse full society dossiers, connect directly with student Points of Contact (PoRs) on WhatsApp, and follow official portals.
          </p>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="st-metrics-grid">
        <div className="st-metric-card">
          <div className="st-metric-icon">🏛️</div>
          <div className="st-metric-info">
            <div className="st-metric-val">{totalCount}</div>
            <div className="st-metric-lbl">Official Societies</div>
          </div>
        </div>
        <div className="st-metric-card">
          <div className="st-metric-icon">🏷️</div>
          <div className="st-metric-info">
            <div className="st-metric-val">{totalDomainsCount}</div>
            <div className="st-metric-lbl">Active Domains</div>
          </div>
        </div>
        <div className="st-metric-card">
          <div className="st-metric-icon">💬</div>
          <div className="st-metric-info">
            <div className="st-metric-val">{totalPocsCount}+</div>
            <div className="st-metric-lbl">Student PoRs</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="st-filter-bar">
        <div className="st-filter-row">
          <div className="st-search-wrapper">
            <SearchIcon className="st-search-icon" size={16} />
            <input
              type="text"
              className="st-search-input"
              placeholder="Search by name, acronym, domain, TIC, or PoR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="st-search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                type="button"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="st-filter-subbar">
            <div className="st-results-counter">
              <span className="st-results-dot" />
              <span className="st-results-text">
                Showing <strong>{sortedSocieties.length}</strong> of {totalCount} societies
              </span>
            </div>

            <div className="st-sort-wrapper">
              <label htmlFor="st-sort-select" className="st-sort-label">Sort:</label>
              <select
                id="st-sort-select"
                className="st-sort-select"
                value={sortBy}
                aria-label="Sort societies"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'shuffled' && sortBy === 'shuffled') {
                    setShuffledIds(shuffleArray(DEMO_SOCIETIES.map((s) => s.id)));
                  }
                  setSortBy(val);
                }}
              >
                <option value="shuffled">Shuffled (Default)</option>
                <option value="name">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Pills with Accurate Counts */}
        <div className="st-category-pills">
          {CATEGORIES.map((cat) => {
            const isAll = cat.id === 'all';
            const count = isAll
              ? totalCount
              : DEMO_SOCIETIES.filter(
                  (s) => s.category === cat.id || (Array.isArray(s.categories) && s.categories.includes(cat.id))
                ).length;
            const label = isAll ? `All Domains (${totalCount})` : cat.label;
            return (
              <button
                key={cat.id}
                className={`st-category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span className="st-cat-icon">{cat.icon}</span>
                <span>{label}</span>
                {!isAll && <span className="st-cat-count">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid View */}
      {sortedSocieties.length > 0 ? (
        <div className="st-societies-grid">
          {sortedSocieties.map((society) => {
            const categoryList = society.categoryLabels || [society.categoryLabel];
            const primaryLabel = categoryList[0];
            const extraCount = categoryList.length - 1;
            const primaryPoc = Array.isArray(society.pocs) && society.pocs.length > 0 ? society.pocs[0] : null;

            return (
              <div
                key={society.id}
                className="st-card"
                onClick={() => {
                  trackSocietyEvent('card_clicked', { society_name: society.name, category: primaryLabel });
                  setSelectedSociety(society);
                }}
                title={`Click to view full dossier for ${society.name}`}
              >
                {/* Header & Title */}
                <div className="st-card-main">
                  <div className="st-card-top">
                    <div className="st-card-badges">
                      <span className="st-domain-badge" title={primaryLabel}>
                        {primaryLabel.toUpperCase()}
                      </span>
                      {extraCount > 0 && (
                        <span
                          className="st-domain-badge st-more-badge"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSociety(society);
                          }}
                          title={`+${extraCount} more domain(s): ${categoryList.slice(1).join(', ')}`}
                        >
                          +{extraCount} MORE
                        </span>
                      )}
                    </div>
                    <span className="st-card-dossier-pill">
                      Dossier ↗
                    </span>
                  </div>

                  <h3 className="st-society-title" title={society.name}>
                    {society.name}
                  </h3>
                  <p className="st-card-desc" title={society.description}>
                    {society.description || '\u00A0'}
                  </p>

                  {/* Compact Single-Line TIC Strip */}
                  {(() => {
                    const hasTics = Array.isArray(society.tics) && society.tics.length > 0;
                    const tooltipText = hasTics
                      ? `Teacher(s)-in-Charge: ${society.tics.join(', ')}`
                      : 'Teacher-in-Charge details to be updated';
                    return (
                      <div className="st-card-tic-row" title={tooltipText}>
                        <span className="st-card-tic-icon" aria-hidden="true">🧑‍🏫</span>
                        <span className="st-card-tic-label">TIC:</span>
                        <span className={`st-card-tic-names ${!hasTics ? 'is-unspecified' : ''}`}>
                          {hasTics ? society.tics.join(', ') : 'To be updated'}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Card Bottom / Action Row - ALL OPTIONS VISIBLE & AVAILABLE */}
                <div className="st-card-bottom">
                  {/* Left: Official Social Handles */}
                  <div className="st-social-row">
                    <a
                      href={society.officialPageUrl || OFFICIAL_COLLEGE_SOCIETIES_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="st-social-btn sscbs"
                      title="Visit Official SSCBS Page"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img src="/sscbs_college_logo.png" alt="SSCBS" className="st-sscbs-logo" />
                    </a>
                    <a
                      href={society.instagramVideoUrl || 'https://instagram.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`st-social-btn ${society.id === 'literary-society' ? 'linktree' : 'insta'}`}
                      title={society.id === 'literary-society' ? 'Linktree' : 'Instagram Updates'}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {society.id === 'literary-society' ? <LinktreeIcon size={16} /> : <InstagramIcon size={16} />}
                    </a>
                    {society.whatsappGroupUrl && !society.linkedinUrl ? (
                      <a
                        href={society.whatsappGroupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="st-social-btn whatsapp"
                        title="Official WhatsApp Community"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <WhatsAppIcon size={16} />
                      </a>
                    ) : (
                      <a
                        href={society.linkedinUrl || 'https://linkedin.com'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="st-social-btn linkedin"
                        title="LinkedIn Profile"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <LinkedinIcon size={16} />
                      </a>
                    )}
                  </div>

                  {/* Right: Actions (PoR Contact on WhatsApp & View Dossier) */}
                  <div className="st-card-actions-group">
                    {primaryPoc ? (() => {
                      const cleanPhone = primaryPoc.phone.replace(/[^0-9]/g, '').slice(-10);
                      const textMsg = encodeURIComponent(
                        `Hi ${primaryPoc.name}! I'm an SSCBS student reaching out regarding ${society.shortName || society.name}.`
                      );
                      return (
                        <a
                          href={`https://wa.me/91${cleanPhone}?text=${textMsg}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="st-card-por-btn"
                          title={`Chat with ${primaryPoc.name} (Student PoR) on WhatsApp`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <WhatsAppIcon size={14} />
                          <span>PoR</span>
                        </a>
                      );
                    })() : null}
                    <button
                      type="button"
                      className="st-card-view-btn"
                      title="View full dossier, faculty TIC &amp; PoR directory"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSociety(society);
                      }}
                    >
                      <span>Dossier</span>
                      <span className="st-btn-arrow">↗</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="st-empty-box">
          <div className="st-empty-icon">
            <SearchIcon size={24} />
          </div>
          <h3 className="st-empty-title">No Societies Found</h3>
          <p className="st-empty-sub">
            Try clearing your search query or selecting a different domain category.
          </p>
          <button
            className="st-clear-filter-btn"
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
            }}
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Full Society Detail Modal / Dossier */}
      {selectedSociety && (
        <div
          className="st-modal-overlay"
          onClick={() => setSelectedSociety(null)}
        >
          <div
            className="st-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="st-modal-header">
              <div className="st-modal-header-info">
                <div className="st-modal-badges">
                  {(selectedSociety.categoryLabels || [selectedSociety.categoryLabel]).map(
                    (lbl, idx) => (
                      <span key={idx} className="st-domain-badge">
                        {lbl.toUpperCase()}
                      </span>
                    )
                  )}
                </div>
                <h2 className="st-modal-title">{selectedSociety.name}</h2>
              </div>
              <button
                className="st-modal-close-btn"
                onClick={() => setSelectedSociety(null)}
                title="Close"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="st-modal-body">
              <div className="st-modal-section">
                <h4 className="st-modal-sec-title">About the Society &amp; Mission</h4>
                <p className="st-modal-desc">{selectedSociety.description}</p>
              </div>

              <div className="st-modal-section">
                <h4 className="st-modal-sec-title">Domains &amp; Specializations</h4>
                <div className="st-modal-tags">
                  {(selectedSociety.categoryLabels || [selectedSociety.categoryLabel]).map(
                    (tag, i) => (
                      <span key={i} className="st-modal-tag-pill">
                        🏷️ {tag}
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Teacher(s)-in-Charge & Faculty Advisors Section */}
              <div className="st-modal-section">
                <h4 className="st-modal-sec-title">🧑‍🏫 Teacher(s)-in-Charge &amp; Faculty Advisors</h4>
                {Array.isArray(selectedSociety.tics) && selectedSociety.tics.length > 0 ? (
                  <div className="st-tic-grid">
                    {selectedSociety.tics.map((ticStr, idx) => {
                      const isConvenor = ticStr.includes('(Convenor)');
                      const cleanName = ticStr.replace(/\(Convenor\)/i, '').trim();
                      const facultyId = getFacultyIdForName(cleanName);
                      const isPlacementOfficer = cleanName.toLowerCase().includes('deepak tiwari');

                      return (
                        <div key={idx} className={`st-tic-card ${isConvenor ? 'is-convenor' : ''}`}>
                          <div className="st-tic-card-left">
                            <span className="st-tic-avatar">🎓</span>
                            <div className="st-tic-info">
                              <span className="st-tic-name">{cleanName}</span>
                              <span className="st-tic-role">
                                {isPlacementOfficer
                                  ? 'Placement Officer / Advisor'
                                  : isConvenor
                                  ? 'Convenor'
                                  : 'Faculty Advisor / TIC'}
                              </span>
                            </div>
                          </div>
                          {facultyId && onNavigate ? (
                            <button
                              type="button"
                              className="st-tic-details-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSociety(null);
                                onNavigate('faculty-db', { profId: facultyId });
                              }}
                              title={`View room, contacts & portfolio for ${cleanName} in Faculty Directory`}
                            >
                              <span>View Profile</span>
                              <span className="st-btn-arrow">→</span>
                            </button>
                          ) : (
                            isPlacementOfficer && (
                              <span className="st-tic-note-badge">CDC Head</span>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="st-tic-empty-notice">
                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>ℹ️</span>
                    <div>
                      <strong style={{ color: 'var(--ink)' }}>Official TIC To Be Updated</strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--ink-dim)' }}>
                        Teacher-in-Charge details have not yet been officially updated in current college records for this initiative. Please check with society PoRs below for details.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Student PoR Contacts */}
              {Array.isArray(selectedSociety.pocs) && selectedSociety.pocs.length > 0 && (
                <div className="st-modal-section">
                  <h4 className="st-modal-sec-title">💬 Student Leadership &amp; PoR Contacts</h4>
                  <div className="st-poc-grid">
                    {selectedSociety.pocs.map((poc, idx) => {
                      const cleanPhone = poc.phone.replace(/[^0-9]/g, '');
                      const formattedPhone =
                        cleanPhone.length === 10
                          ? `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`
                          : poc.phone;
                      const textMsg = encodeURIComponent(
                        `Hi ${poc.name}! I'm an SSCBS student reaching out regarding ${selectedSociety.shortName || selectedSociety.name}.`
                      );
                      return (
                        <div key={idx} className="st-poc-card">
                          <div className="st-poc-details">
                            <span className="st-poc-name">{poc.name}</span>
                            <span className="st-poc-phone">{formattedPhone}</span>
                          </div>
                          <div className="st-poc-actions">
                            <a
                              href={`https://wa.me/91${cleanPhone.slice(-10)}?text=${textMsg}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="st-poc-action-btn whatsapp"
                              title={`Chat with ${poc.name} on WhatsApp`}
                            >
                              <WhatsAppIcon size={14} />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer with handles & quick connect */}
            <div className="st-modal-footer">
              <div className="st-modal-footer-por">
                {Array.isArray(selectedSociety.pocs) && selectedSociety.pocs.length > 0 && (() => {
                  const primaryPoc = selectedSociety.pocs[0];
                  const cleanPhone = primaryPoc.phone.replace(/[^0-9]/g, '').slice(-10);
                  const textMsg = encodeURIComponent(
                    `Hi ${primaryPoc.name}! I'm an SSCBS student reaching out regarding ${selectedSociety.shortName || selectedSociety.name}.`
                  );
                  return (
                    <a
                      href={`https://wa.me/91${cleanPhone}?text=${textMsg}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="st-modal-por-btn"
                      title={`Message ${primaryPoc.name} on WhatsApp`}
                    >
                      <WhatsAppIcon size={16} />
                      <span>WhatsApp PoR ({primaryPoc.name})</span>
                    </a>
                  );
                })()}
              </div>
              <div className="st-social-row">
                <a
                  href={selectedSociety.officialPageUrl || OFFICIAL_COLLEGE_SOCIETIES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="st-social-btn sscbs"
                  title="Visit Official SSCBS Page"
                >
                  <img src="/sscbs_college_logo.png" alt="SSCBS" className="st-sscbs-logo" />
                </a>
                <a
                  href={selectedSociety.instagramVideoUrl || 'https://instagram.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`st-social-btn ${selectedSociety.id === 'literary-society' ? 'linktree' : 'insta'}`}
                  title={selectedSociety.id === 'literary-society' ? 'Linktree' : 'Instagram Updates'}
                >
                  {selectedSociety.id === 'literary-society' ? <LinktreeIcon size={18} /> : <InstagramIcon size={18} />}
                </a>
                {selectedSociety.whatsappGroupUrl && !selectedSociety.linkedinUrl ? (
                  <a
                    href={selectedSociety.whatsappGroupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="st-social-btn whatsapp"
                    title="Official WhatsApp Group"
                  >
                    <WhatsAppIcon size={18} />
                  </a>
                ) : (
                  <a
                    href={selectedSociety.linkedinUrl || 'https://linkedin.com'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="st-social-btn linkedin"
                    title="LinkedIn Profile"
                  >
                    <LinkedinIcon size={18} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
