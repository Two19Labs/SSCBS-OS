import React, { useState, useEffect, useCallback } from 'react';
import { CATEGORIES, DEMO_SOCIETIES, getDeadlineInfo } from '../data/societies';
import {
  SearchIcon,
  InstagramIcon,
  LinktreeIcon,
  LinkedinIcon,
  ExternalLinkIcon,
  SparklesIcon,
  ClockIcon,
  BriefcaseIcon,
  HeartIcon,
  CheckIcon,
  BackIcon,
} from './icons';
import { useAuth } from '../context/AuthContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import './SocietyTrackerPage.css';

const LOCAL_STORAGE_KEY = 'sscbs_bookmarked_societies';
const FILLED_FORMS_KEY = 'sscbs_filled_form_societies';
const OFFICIAL_COLLEGE_SOCIETIES_URL = 'https://sscbs.du.ac.in/societies/';

export default function SocietyTrackerPage({ onBack }) {
  const { user } = useAuth();
  const userKeySuffix = user?.email ? `_${user.email.toLowerCase()}` : '';
  const bookmarksKey = `${LOCAL_STORAGE_KEY}${userKeySuffix}`;
  const filledKey = `${FILLED_FORMS_KEY}${userKeySuffix}`;

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'preferred'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [selectedSociety, setSelectedSociety] = useState(null);

  // Bookmarks (Heart) state with user-scoped key and fallback
  const [bookmarkedIds, setBookmarkedIds] = useState(() => {
    try {
      const userKey = user?.email ? `${LOCAL_STORAGE_KEY}_${user.email.toLowerCase()}` : LOCAL_STORAGE_KEY;
      const saved = localStorage.getItem(userKey) || localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.error('Error reading saved bookmarks:', err);
    }
    return DEMO_SOCIETIES.filter((s) => s.defaultBookmarked).map((s) => s.id);
  });

  // Form Filled checkmark state with user-scoped key and fallback
  const [filledIds, setFilledIds] = useState(() => {
    try {
      const userKey = user?.email ? `${FILLED_FORMS_KEY}_${user.email.toLowerCase()}` : FILLED_FORMS_KEY;
      const saved = localStorage.getItem(userKey) || localStorage.getItem(FILLED_FORMS_KEY);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.error('Error reading filled form societies:', err);
    }
    return [];
  });

  // Helper for background cloud sync across devices
  const syncProgressToCloud = useCallback(async (newBookmarks, newFilled) => {
    if (!user || !hasValidCredentials) return;
    try {
      // 1. Save to Supabase auth user metadata (syncs across devices on login)
      const { data, error } = await supabase.auth.updateUser({
        data: {
          society_bookmarks: newBookmarks,
          society_filled_forms: newFilled,
        },
      });

      // 2. Save to user_progress settings table for cloud backup
      if (!error && data?.user?.id) {
        const { data: progressData } = await supabase
          .from('user_progress')
          .select('settings')
          .eq('user_id', data.user.id)
          .maybeSingle();

        const existingSettings = progressData?.settings || {};
        const newSettings = {
          ...existingSettings,
          society_bookmarks: newBookmarks,
          society_filled_forms: newFilled,
          email: data.user.email,
        };

        await supabase
          .from('user_progress')
          .update({ settings: newSettings })
          .eq('user_id', data.user.id);
      }
    } catch (err) {
      console.warn('Cross-device cloud sync warning:', err);
    }
  }, [user]);

  // Load cloud data from Supabase user_metadata on mount / user load
  useEffect(() => {
    if (!user) return;
    const cloudBookmarks = user.user_metadata?.society_bookmarks;
    const cloudFilled = user.user_metadata?.society_filled_forms;

    if (Array.isArray(cloudBookmarks)) {
      setBookmarkedIds(cloudBookmarks);
      try {
        localStorage.setItem(bookmarksKey, JSON.stringify(cloudBookmarks));
      } catch (e) {}
    }

    if (Array.isArray(cloudFilled)) {
      setFilledIds(cloudFilled);
      try {
        localStorage.setItem(filledKey, JSON.stringify(cloudFilled));
      } catch (e) {}
    }
  }, [user, bookmarksKey, filledKey]);

  // Sync bookmarks with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(bookmarksKey, JSON.stringify(bookmarkedIds));
    } catch (err) {
      console.error('Error saving bookmarks:', err);
    }
  }, [bookmarkedIds, bookmarksKey]);

  // Sync filled forms with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(filledKey, JSON.stringify(filledIds));
    } catch (err) {
      console.error('Error saving filled form societies:', err);
    }
  }, [filledIds, filledKey]);

  const toggleFormFilled = (id) => {
    setFilledIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      syncProgressToCloud(bookmarkedIds, next);
      return next;
    });
  };

  const toggleBookmark = (id) => {
    setBookmarkedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      syncProgressToCloud(next, filledIds);
      return next;
    });
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
    if (sortBy === 'name' || sortBy === 'name-asc') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'name-desc') {
      return b.name.localeCompare(a.name);
    }
    return 0;
  });

  const totalCount = DEMO_SOCIETIES.length;
  const bookmarkedCount = bookmarkedIds.length;
  const filledCount = filledIds.length;

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
              Recruitments will start soon, forms and info will come here soon! Filter all 43 official SSCBS societies by domain.
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
          <div className="st-metric-icon">❤️</div>
          <div>
            <div className="st-metric-val">{bookmarkedCount}</div>
            <div className="st-metric-lbl">My Preferred</div>
          </div>
        </div>
        <div className="st-metric-card">
          <div className="st-metric-icon">✅</div>
          <div>
            <div className="st-metric-val">{filledCount}</div>
            <div className="st-metric-lbl">Forms Filled</div>
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
            <option value="name-desc">Sort by: Name (Z-A)</option>
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
            const isFilled = filledIds.includes(society.id);
            const categoryList = society.categoryLabels || [society.categoryLabel];
            const primaryLabel = categoryList[0];
            const extraCount = categoryList.length - 1;

            return (
              <div
                key={society.id}
                className={`st-card ${isFilled ? 'is-filled' : ''}`}
                onClick={() => setSelectedSociety(society)}
              >
                {/* Header & Title */}
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
                      {isFilled && (
                        <span className="st-filled-badge">
                          <CheckIcon size={11} /> Filled
                        </span>
                      )}
                    </div>
                    <div className="st-action-btns">
                      <button
                        className={`st-check-btn ${isFilled ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFormFilled(society.id);
                        }}
                        title={isFilled ? 'Mark form as unfilled' : 'Mark form as filled'}
                      >
                        <CheckIcon size={14} />
                      </button>
                      <button
                        className={`st-heart-btn ${isSaved ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBookmark(society.id);
                        }}
                        title={isSaved ? 'Remove from preferred' : 'Save to preferred'}
                      >
                        <HeartIcon filled={isSaved} size={15} />
                      </button>
                    </div>
                  </div>

                  <h3 className="st-society-title">{society.name}</h3>
                </div>

                {/* Card Bottom / Action Row */}
                <div className="st-card-bottom">
                  {(() => {
                    const dl = getDeadlineInfo(society.deadline);
                    const countdown = getCountdown(society.deadline);
                    const hasForm = !!society.recruitmentFormUrl;
                    return (
                      <>
                        <div className="st-deadline-box">
                          <span className="st-deadline-lbl">
                            <ClockIcon size={14} /> Status
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '0.8rem' }} className={dl.status === 'urgent' ? 'st-status-urgent' : dl.isExpired ? 'st-status-expired' : ''}>
                            {society.statusText || dl.text}
                          </span>
                        </div>

                        {countdown && !countdown.expired && (
                          <div className={`st-countdown-strip ${countdown.tier}`}>
                            <ClockIcon size={12} />
                            <span className="st-countdown-label">Closes in</span>
                            <span className="st-countdown-timer">{countdown.label}</span>
                          </div>
                        )}

                        {/* Buttons Row */}
                        <div className="st-card-actions">
                          {hasForm && !dl.isExpired ? (
                            <a
                              href={society.recruitmentFormUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="st-apply-btn live"
                              title="Open recruitment form"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Apply Now ↗
                            </a>
                          ) : dl.isExpired ? (
                            <span className="st-apply-btn disabled expired">
                              Applications Closed
                            </span>
                          ) : (
                            <span
                              className="st-apply-btn disabled"
                              title="Recruitment forms will drop here soon"
                            >
                              Forms Opening Soon
                            </span>
                          )}
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
                        {society.id === 'literary-society' ? <LinktreeIcon size={18} /> : <InstagramIcon size={18} />}
                      </a>
                      <a
                        href={society.linkedinUrl || 'https://linkedin.com'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="st-social-btn linkedin"
                        title="LinkedIn Profile"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <LinkedinIcon size={18} />
                      </a>
                    </div>
                  </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="st-empty-box">
          <div className="st-empty-icon">
            <HeartIcon size={24} />
          </div>
          <h3 className="st-empty-title">
            {activeTab === 'preferred'
              ? 'No Preferred Societies Saved Yet'
              : 'No Societies Found'}
          </h3>
          <p className="st-empty-sub">
            {activeTab === 'preferred'
              ? 'Click the heart icon on any society card in "All Societies" to track them here!'
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
                  className={`st-check-btn ${
                    filledIds.includes(selectedSociety.id) ? 'active' : ''
                  }`}
                  onClick={() => toggleFormFilled(selectedSociety.id)}
                  title={
                    filledIds.includes(selectedSociety.id)
                      ? 'Mark form as unfilled'
                      : 'Mark form as filled'
                  }
                >
                  <CheckIcon size={15} />
                </button>
                <button
                  className={`st-heart-btn ${
                    bookmarkedIds.includes(selectedSociety.id) ? 'active' : ''
                  }`}
                  onClick={() => toggleBookmark(selectedSociety.id)}
                  title="Bookmark"
                >
                  <HeartIcon
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
                {(() => {
                  const dl = getDeadlineInfo(selectedSociety.deadline);
                  const countdown = getCountdown(selectedSociety.deadline);
                  const hasForm = !!selectedSociety.recruitmentFormUrl;
                  return (
                    <>
                      <div className={`st-modal-status-box ${hasForm && !dl.isExpired ? 'live' : ''}`}>
                        <ClockIcon size={18} />
                        <div>
                          <strong>{selectedSociety.statusText || dl.text}</strong>
                          {countdown && !countdown.expired && (
                            <div className={`st-modal-countdown ${countdown.tier}`}>
                              ⏱️ <span className="st-countdown-timer">{countdown.label}</span> remaining
                            </div>
                          )}
                          {!hasForm && (
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.83rem', opacity: 0.88 }}>
                              Official application forms, orientation details, and interview schedules will drop here soon!
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
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
                {(() => {
                  const dl = getDeadlineInfo(selectedSociety.deadline);
                  const hasForm = !!selectedSociety.recruitmentFormUrl;
                  if (hasForm && !dl.isExpired) {
                    return (
                      <a
                        href={selectedSociety.recruitmentFormUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="st-apply-btn live modal-apply"
                      >
                        Apply Now ↗
                      </a>
                    );
                  }
                  if (dl.isExpired) {
                    return <span className="st-modal-form-disabled">Applications Closed</span>;
                  }
                  return <span className="st-modal-form-disabled">Forms Opening Soon</span>;
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
                  {selectedSociety.id === 'literary-society' ? <LinktreeIcon size={20} /> : <InstagramIcon size={20} />}
                </a>
                <a
                  href={selectedSociety.linkedinUrl || 'https://linkedin.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="st-social-btn linkedin"
                  title="LinkedIn Profile"
                >
                  <LinkedinIcon size={20} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
