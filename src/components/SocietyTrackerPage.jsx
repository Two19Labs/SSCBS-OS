import React, { useState, useEffect } from 'react';
import { CATEGORIES, DEMO_SOCIETIES, getDeadlineInfo } from '../data/societies';
import {
  SearchIcon,
  BookmarkIcon,
  InstagramIcon,
  LinkedinIcon,
  ExternalLinkIcon,
  SparklesIcon,
  ClockIcon,
  BriefcaseIcon,
  HeartIcon,
  BackIcon,
} from './icons';
import './SocietyTrackerPage.css';

const LOCAL_STORAGE_KEY = 'sscbs_bookmarked_societies';
const OFFICIAL_COLLEGE_SOCIETIES_URL = 'https://sscbs.du.ac.in/societies/';

export default function SocietyTrackerPage({ onBack }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'preferred'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [selectedSociety, setSelectedSociety] = useState(null);

  // Bookmarks state with fallback to pre-bookmarked demo items
  const [bookmarkedIds, setBookmarkedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.error('Error reading saved bookmarks:', err);
    }
    return DEMO_SOCIETIES.filter((s) => s.defaultBookmarked).map((s) => s.id);
  });

  // Sync bookmarks with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bookmarkedIds));
    } catch (err) {
      console.error('Error saving bookmarks:', err);
    }
  }, [bookmarkedIds]);

  const toggleBookmark = (id) => {
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredSocieties = DEMO_SOCIETIES.filter((society) => {
    if (activeTab === 'preferred' && !bookmarkedIds.includes(society.id)) {
      return false;
    }
    if (selectedCategory !== 'all') {
      const hasCat =
        society.category === selectedCategory ||
        (Array.isArray(society.categories) && society.categories.includes(selectedCategory));
      if (!hasCat) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = society.name.toLowerCase().includes(q);
      const matchCategory = society.categoryLabel.toLowerCase().includes(q);
      const matchSubCats =
        Array.isArray(society.categoryLabels) &&
        society.categoryLabels.some((lbl) => lbl.toLowerCase().includes(q));
      return matchName || matchCategory || matchSubCats;
    }
    return true;
  });

  const sortedSocieties = [...filteredSocieties].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  const totalCount = DEMO_SOCIETIES.length;
  const bookmarkedCount = bookmarkedIds.length;

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
          <div>
            <span className="st-badge">
              <SparklesIcon size={12} /> RECRUITMENT SEASON 2026
            </span>
            <h1 className="st-title">Society Recruitment Tracker</h1>
            <p className="st-subtitle">
              Recruitments will start soon, forms and info will come here soon! Filter all 47 official SSCBS societies by domain.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="st-metrics-grid">
        <div className="st-metric-card">
          <div className="st-metric-icon">🏛️</div>
          <div>
            <div className="st-metric-val">{totalCount}</div>
            <div className="st-metric-lbl">Official Societies</div>
          </div>
        </div>
        <div className="st-metric-card">
          <div className="st-metric-icon">⚡</div>
          <div>
            <div className="st-metric-val">Upcoming</div>
            <div className="st-metric-lbl">Recruitments Opening</div>
          </div>
        </div>
        <div className="st-metric-card">
          <div className="st-metric-icon">❤️</div>
          <div>
            <div className="st-metric-val">{bookmarkedCount}</div>
            <div className="st-metric-lbl">My Preferred</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Header */}
      <div className="st-tabs-header">
        <div className="st-tabs-nav">
          <button
            className={`st-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <BriefcaseIcon size={16} /> All Societies
          </button>
          <button
            className={`st-tab-btn ${activeTab === 'preferred' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferred')}
          >
            <HeartIcon filled={activeTab === 'preferred'} size={16} /> My Preferred Societies
            {bookmarkedCount > 0 && (
              <span className="st-tab-count">{bookmarkedCount}</span>
            )}
          </button>
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
              placeholder="Search society name or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="st-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name">Sort by: Name (A-Z)</option>
          </select>
        </div>

        {/* Category Filter Pills */}
        <div className="st-category-pills">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`st-category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span>{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid View */}
      {sortedSocieties.length > 0 ? (
        <div className="st-societies-grid">
          {sortedSocieties.map((society) => {
            const isSaved = bookmarkedIds.includes(society.id);
            const categoryList = society.categoryLabels || [society.categoryLabel];
            const primaryLabel = categoryList[0];
            const extraCount = categoryList.length - 1;

            return (
              <div
                key={society.id}
                className="st-card"
                onClick={() => setSelectedSociety(society)}
              >
                {/* Header & Title (Clean, No Description) */}
                <div>
                  <div className="st-card-top">
                    <div className="st-card-badges">
                      <span className="st-domain-badge">
                        {primaryLabel.toUpperCase()}
                      </span>
                      {extraCount > 0 && (
                        <span
                          className="st-domain-badge st-more-badge"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSociety(society);
                          }}
                          title="Click to view all categories & details"
                        >
                          +{extraCount} MORE
                        </span>
                      )}
                    </div>
                    <button
                      className={`st-bookmark-btn ${isSaved ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(society.id);
                      }}
                      title={isSaved ? 'Remove from preferred' : 'Save to preferred'}
                    >
                      <BookmarkIcon filled={isSaved} size={15} />
                    </button>
                  </div>

                  <h3 className="st-society-title">{society.name}</h3>
                </div>

                {/* Card Bottom / Action Row */}
                <div className="st-card-bottom">
                  <div className="st-deadline-box">
                    <span className="st-deadline-lbl">
                      <ClockIcon size={14} /> Status
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Recruitments Starting Soon</span>
                  </div>

                  {/* Buttons Row */}
                  <div className="st-card-actions">
                    <span
                      className="st-apply-btn disabled"
                      title="Recruitment forms will drop here soon"
                    >
                      Forms Opening Soon
                    </span>
                    <a
                      href={OFFICIAL_COLLEGE_SOCIETIES_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="st-college-btn"
                      title="Visit Official SSCBS Web Page"
                      onClick={(e) => e.stopPropagation()}
                    >
                      College Page <ExternalLinkIcon size={12} />
                    </a>
                    <a
                      href={society.instagramVideoUrl || 'https://instagram.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="st-social-btn insta"
                      title="Watch Instagram Updates"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <InstagramIcon size={16} />
                    </a>
                    <a
                      href={society.linkedinUrl || 'https://linkedin.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="st-social-btn linkedin"
                      title="View LinkedIn Profile"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <LinkedinIcon size={16} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="st-empty-box">
          <div className="st-empty-icon">
            <BookmarkIcon size={24} />
          </div>
          <h3 className="st-empty-title">
            {activeTab === 'preferred'
              ? 'No Preferred Societies Saved Yet'
              : 'No Societies Found'}
          </h3>
          <p className="st-empty-sub">
            {activeTab === 'preferred'
              ? 'Click the bookmark icon on any society card in "All Societies" to track them here!'
              : 'Try clearing your search query or selecting a different category filter.'}
          </p>
          {activeTab === 'preferred' && (
            <button
              className="st-college-btn"
              style={{ display: 'inline-flex', width: 'auto', padding: '9px 18px' }}
              onClick={() => {
                setActiveTab('all');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
            >
              Browse All Societies
            </button>
          )}
        </div>
      )}

      {/* Full Society Detail Modal */}
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
              <div>
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
              <div className="st-modal-header-actions">
                <button
                  className={`st-bookmark-btn ${
                    bookmarkedIds.includes(selectedSociety.id) ? 'active' : ''
                  }`}
                  onClick={() => toggleBookmark(selectedSociety.id)}
                  title="Bookmark"
                >
                  <BookmarkIcon
                    filled={bookmarkedIds.includes(selectedSociety.id)}
                    size={16}
                  />
                </button>
                <button
                  className="st-modal-close-btn"
                  onClick={() => setSelectedSociety(null)}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="st-modal-body">
              <div className="st-modal-section">
                <h4 className="st-modal-sec-title">About the Society</h4>
                <p className="st-modal-desc">{selectedSociety.description}</p>
              </div>

              <div className="st-modal-section">
                <h4 className="st-modal-sec-title">Recruitment Announcement</h4>
                <div className="st-modal-status-box">
                  <ClockIcon size={18} />
                  <div>
                    <strong>Recruitments Starting Soon</strong>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.83rem', opacity: 0.88 }}>
                      Official application forms, orientation details, and interview schedules will drop here soon!
                    </p>
                  </div>
                </div>
              </div>

              <div className="st-modal-section">
                <h4 className="st-modal-sec-title">Domains &amp; Categories</h4>
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
            </div>

            <div className="st-modal-footer">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="st-modal-form-disabled">
                  Forms Opening Soon
                </span>
                <a
                  href={OFFICIAL_COLLEGE_SOCIETIES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="st-college-btn"
                >
                  Visit Official SSCBS Web Page <ExternalLinkIcon size={12} />
                </a>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={selectedSociety.instagramVideoUrl || 'https://instagram.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="st-social-btn insta"
                  title="Instagram Updates"
                >
                  <InstagramIcon size={18} />
                </a>
                <a
                  href={selectedSociety.linkedinUrl || 'https://linkedin.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="st-social-btn linkedin"
                  title="LinkedIn Profile"
                >
                  <LinkedinIcon size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Helper Footer */}
      <div className="st-footer-banner">
        💡 <strong>Got society recruitment details to add?</strong> Simply paste the society list &amp; links here and we'll update the dataset instantly!
      </div>
    </div>
  );
}
