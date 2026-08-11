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

function DeadlineCountdown({ deadlineStr }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!deadlineStr) return <span>No Deadline</span>;

  const deadlineDate = new Date(deadlineStr).getTime();
  const diffMs = deadlineDate - now;

  if (diffMs <= 0) {
    return <span className="st-timer-expired">Closed</span>;
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (days >= 1) {
    return <span>{days} {days === 1 ? 'day' : 'days'} left</span>;
  }

  return (
    <span className="st-timer-counting">
      {String(hours).padStart(2, '0')}h {String(minutes).padStart(2, '0')}m {String(seconds).padStart(2, '0')}s left
    </span>
  );
}

export default function SocietyTrackerPage({ onBack }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'preferred'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('urgent');

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
      const hasCat = society.category === selectedCategory ||
        (Array.isArray(society.categories) && society.categories.includes(selectedCategory));
      if (!hasCat) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = society.name.toLowerCase().includes(q);
      const matchCategory = society.categoryLabel.toLowerCase().includes(q);
      const matchSubCats = Array.isArray(society.categoryLabels) &&
        society.categoryLabels.some((lbl) => lbl.toLowerCase().includes(q));
      return matchName || matchCategory || matchSubCats;
    }
    return true;
  });

  const sortedSocieties = [...filteredSocieties].sort((a, b) => {
    const deadlineA = getDeadlineInfo(a.deadline);
    const deadlineB = getDeadlineInfo(b.deadline);

    if (sortBy === 'urgent') {
      return deadlineA.daysLeft - deadlineB.daysLeft;
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  const totalCount = DEMO_SOCIETIES.length;
  const activeRecruitmentCount = DEMO_SOCIETIES.filter(
    (s) => !getDeadlineInfo(s.deadline).isExpired
  ).length;
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
            <option value="urgent">Sort by: Closing Soonest</option>
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
            const deadlineInfo = getDeadlineInfo(society.deadline);

            return (
              <div key={society.id} className="st-card">
                <div>
                  <div className="st-card-top">
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {Array.isArray(society.categoryLabels) ? (
                        society.categoryLabels.map((lbl, idx) => (
                          <span key={idx} className="st-domain-badge">
                            {lbl.toUpperCase()}
                          </span>
                        ))
                      ) : (
                        <span className="st-domain-badge">
                          {society.categoryLabel.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <button
                      className={`st-bookmark-btn ${isSaved ? 'active' : ''}`}
                      onClick={() => toggleBookmark(society.id)}
                      title={isSaved ? 'Remove from preferred' : 'Save to preferred'}
                    >
                      <BookmarkIcon filled={isSaved} size={15} />
                    </button>
                  </div>

                  <h3 className="st-society-title">{society.name}</h3>
                  <p className="st-society-desc" style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '8px', lineHeight: 1.45 }}>
                    {society.description}
                  </p>
                </div>

                <div className="st-card-bottom" style={{ marginTop: '14px' }}>
                  {/* Status Banner */}
                  <div className="st-deadline-box normal" style={{ background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa' }}>
                    <span className="st-deadline-lbl">
                      <ClockIcon size={14} /> Status
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>Recruitments Starting Soon</span>
                  </div>

                  {/* Actions */}
                  <div className="st-card-actions" style={{ marginTop: '10px' }}>
                    {society.recruitmentFormUrl ? (
                      <a
                        href={society.recruitmentFormUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="st-apply-btn"
                      >
                        Apply Form <ExternalLinkIcon size={14} />
                      </a>
                    ) : (
                      <span
                        className="st-apply-btn"
                        style={{
                          opacity: 0.7,
                          cursor: 'default',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                          color: '#94a3b8',
                          justifyContent: 'center',
                          fontSize: '0.8rem'
                        }}
                      >
                        Forms &amp; Info Coming Soon
                      </span>
                    )}
                    <a
                      href={society.instagramVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="st-social-btn"
                      title="Watch Instagram Updates"
                    >
                      <InstagramIcon size={16} />
                    </a>
                    <a
                      href={society.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="st-social-btn"
                      title="View LinkedIn Profile"
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
              ? 'Click the bookmark icon on any society card in "All Societies" to track their deadlines here!'
              : 'Try clearing your search query or selecting a different category filter.'}
          </p>
          {activeTab === 'preferred' && (
            <button
              className="st-apply-btn"
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

      {/* Helper Footer for Data Dumping */}
      <div className="st-footer-banner">
        💡 <strong>Got society recruitment details to add?</strong> Simply paste the society list &amp; links here and we'll update the dataset instantly!
      </div>
    </div>
  );
}
