import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
const ADITYA_EMAIL = 'aditya.25015@sscbs.du.ac.in';

export default function SocietyTrackerPage() {
  const { user } = useAuth();
  const userEmail = user?.email?.toLowerCase() || '';
  const isAditya = userEmail === ADITYA_EMAIL;

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

  // 🔒 If user is NOT Aditya, show Coming Soon lock view
  if (!isAditya) {
    return (
      <div className="society-tracker-container">
        <div className="tracker-hero-banner" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div className="hero-banner-glow" />
          <div className="hero-tag" style={{ margin: '0 auto 16px' }}>
            <SparklesIcon size={14} /> RECRUITMENT SEASON 2026
          </div>
          <h1 className="hero-title" style={{ fontSize: '2.4rem', marginBottom: '14px' }}>
            Society Recruitment Tracker — Coming Soon! ⚡
          </h1>
          <p className="hero-subtitle" style={{ margin: '0 auto 28px', maxWidth: '640px' }}>
            We're building this to make tracking society recruitments so much easier for you. Stay tuned — 50+ society registration forms, Instagram orientation videos, domain categories (Consulting, Finance, E-Cells &amp; more), and deadline reminders will be live here very soon!
          </p>

          {/* Feature Highlights Grid */}
          <div className="tracker-metrics-grid" style={{ marginTop: '36px', textAlign: 'left' }}>
            <div className="metric-card">
              <div className="metric-icon-box">🏛️</div>
              <div>
                <div className="metric-val">50+ Societies</div>
                <div className="metric-lbl">Consulting, Finance, Tech, E-Cell &amp; Cultural</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon-box">❤️</div>
              <div>
                <div className="metric-val">Track Deadlines</div>
                <div className="metric-lbl">Bookmark &amp; never miss form deadlines</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon-box">📹</div>
              <div>
                <div className="metric-val">Direct Links</div>
                <div className="metric-lbl">Forms, Instagram Videos &amp; LinkedIn</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🔓 For Aditya: Show full working demo view
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
      {/* Teaser & Admin Preview Banner */}
      <div className="tracker-hero-banner">
        <div className="hero-banner-glow" />
        <div className="hero-tag">
          <SparklesIcon size={14} /> ADMIN DEMO PREVIEW (ADITYA)
        </div>
        <h1 className="hero-title">Society Recruitment Tracker</h1>
        <p className="hero-subtitle">
          ✨ <strong>Previewing Demo Cards:</strong> This demo view is currently visible to you (<code>aditya.25015@sscbs.du.ac.in</code>). Other users see the coming soon screen until data launch!
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
          💡 <strong>Ready to load the real data?</strong> Simply dump the 50+ society details in chat and we'll publish them for everyone!
        </span>
      </div>
    </div>
  );
}
