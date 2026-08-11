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
} from './icons';
import './SocietyTrackerPage.css';

const LOCAL_STORAGE_KEY = 'sscbs_bookmarked_societies';

export default function SocietyTrackerPage() {
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
    if (selectedCategory !== 'all' && society.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = society.name.toLowerCase().includes(q);
      const matchCategory = society.categoryLabel.toLowerCase().includes(q);
      const matchDesc = society.description.toLowerCase().includes(q);
      return matchName || matchCategory || matchDesc;
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
      {/* Teaser & Hero Banner */}
      <div className="tracker-hero-banner">
        <div className="hero-banner-glow" />
        <div className="hero-tag">
          <SparklesIcon size={14} /> RECRUITMENT SEASON 2026
        </div>
        <h1 className="hero-title">Society Recruitment Tracker</h1>
        <p className="hero-subtitle">
          ✨ <strong>Coming soon!</strong> We're making recruitments so much easier to track for you. Explore societies below, filter by domain, save your preferred deadlines, and access orientation videos &amp; form links all in one place.
        </p>
      </div>

      {/* Metrics Strip */}
      <div className="tracker-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-box">🏛️</div>
          <div>
            <div className="metric-val">{totalCount}+</div>
            <div className="metric-lbl">Total Societies</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon-box">⚡</div>
          <div>
            <div className="metric-val">{activeRecruitmentCount}</div>
            <div className="metric-lbl">Active Recruitments</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon-box">❤️</div>
          <div>
            <div className="metric-val">{bookmarkedCount}</div>
            <div className="metric-lbl">My Preferred</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon-box">⏰</div>
          <div>
            <div className="metric-val">Aug 24</div>
            <div className="metric-lbl">Earliest Deadline</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Header */}
      <div className="tracker-tabs-header">
        <div className="tabs-nav">
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <BriefcaseIcon size={16} /> All Societies
          </button>
          <button
            className={`tab-btn ${activeTab === 'preferred' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferred')}
          >
            <HeartIcon filled={activeTab === 'preferred'} size={16} /> My Preferred Societies
            {bookmarkedCount > 0 && (
              <span className="tab-count-pill">{bookmarkedCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="tracker-filter-bar">
        <div className="filter-top-row">
          <div className="search-input-wrapper">
            <SearchIcon className="search-icon-pos" size={16} />
            <input
              type="text"
              placeholder="Search society name, domain, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="urgent">Sort by: Closing Soonest</option>
            <option value="name">Sort by: Name (A-Z)</option>
          </select>
        </div>

        {/* Category Filter Pills */}
        <div className="category-pills-scroll">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span>{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid View */}
      {sortedSocieties.length > 0 ? (
        <div className="societies-grid">
          {sortedSocieties.map((society) => {
            const isSaved = bookmarkedIds.includes(society.id);
            const deadlineInfo = getDeadlineInfo(society.deadline);

            return (
              <div key={society.id} className="society-card">
                <div>
                  <div className="society-card-header">
                    <span
                      className="card-category-badge"
                      style={{
                        backgroundColor: `${society.accentColor}18`,
                        color: society.accentColor,
                        border: `1px solid ${society.accentColor}40`,
                      }}
                    >
                      {society.categoryLabel}
                    </span>
                    <button
                      className={`bookmark-btn ${isSaved ? 'active' : ''}`}
                      onClick={() => toggleBookmark(society.id)}
                      title={isSaved ? 'Remove from preferred' : 'Save to preferred'}
                    >
                      <BookmarkIcon filled={isSaved} size={16} />
                    </button>
                  </div>

                  <h3 className="society-name">{society.name}</h3>
                  <p className="society-description">{society.description}</p>
                </div>

                <div>
                  {/* Deadline Box */}
                  <div className={`deadline-box ${deadlineInfo.status}`}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ClockIcon size={14} /> Deadline
                    </span>
                    <span>{deadlineInfo.text}</span>
                  </div>

                  {/* Actions */}
                  <div className="card-actions-row">
                    <a
                      href={society.recruitmentFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="apply-btn"
                    >
                      Apply Form <ExternalLinkIcon size={14} />
                    </a>
                    <a
                      href={society.instagramVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-icon-btn instagram"
                      title="Watch Instagram Orientation Video"
                    >
                      <InstagramIcon size={16} />
                    </a>
                    <a
                      href={society.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-icon-btn linkedin"
                      title="View LinkedIn Page"
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
        <div className="empty-bookmarks-box">
          <div className="empty-icon-circle">
            <BookmarkIcon size={24} />
          </div>
          <h3 className="empty-title">
            {activeTab === 'preferred'
              ? 'No Preferred Societies Saved Yet'
              : 'No Societies Found'}
          </h3>
          <p className="empty-sub">
            {activeTab === 'preferred'
              ? 'Click the bookmark icon on any society card in "All Societies" to track their deadlines here!'
              : 'Try clearing your search query or selecting a different category filter.'}
          </p>
          {activeTab === 'preferred' && (
            <button
              className="apply-btn"
              style={{ display: 'inline-flex', width: 'auto', padding: '10px 20px' }}
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
      <div className="data-dump-footer-banner">
        <span className="dump-text">
          💡 <strong>Got society recruitment details to add?</strong> Simply paste the society list &amp; links here and we'll update the dataset instantly!
        </span>
      </div>
    </div>
  );
}
