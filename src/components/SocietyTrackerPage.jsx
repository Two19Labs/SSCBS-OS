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
  WhatsAppIcon,
} from './icons';
import { useAuth } from '../context/AuthContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import './SocietyTrackerPage.css';

const LOCAL_STORAGE_KEY = 'sscbs_bookmarked_societies';
const FILLED_FORMS_KEY = 'sscbs_filled_form_societies';
const OFFICIAL_COLLEGE_SOCIETIES_URL = 'https://sscbs.du.ac.in/societies/';

// Fisher-Yates shuffle algorithm helper
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function SocietyTrackerPage({ onBack }) {
  const { user } = useAuth();
  const userKeySuffix = user?.email ? `_${user.email.toLowerCase()}` : '';
  const bookmarksKey = `${LOCAL_STORAGE_KEY}${userKeySuffix}`;
  const filledKey = `${FILLED_FORMS_KEY}${userKeySuffix}`;

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'preferred'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  // Randomized shuffled order generated once per load/refresh
  const [shuffledIds, setShuffledIds] = useState(() => shuffleArray(DEMO_SOCIETIES.map((s) => s.id)));
  const [sortBy, setSortBy] = useState('shuffled');
  const [selectedSociety, setSelectedSociety] = useState(null);

  // Bookmarks (Heart) state with user-scoped key
  const [bookmarkedIds, setBookmarkedIds] = useState(() => {
    try {
      if (user?.email) {
        const userKey = `${LOCAL_STORAGE_KEY}_${user.email.toLowerCase()}`;
        const saved = localStorage.getItem(userKey);
        if (saved !== null) {
          return JSON.parse(saved);
        }
        return [];
      } else {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved !== null) {
          return JSON.parse(saved);
        }
      }
    } catch (err) {
      console.error('Error reading saved bookmarks:', err);
    }
    return DEMO_SOCIETIES.filter((s) => s.defaultBookmarked).map((s) => s.id);
  });

  // Form Filled checkmark state with user-scoped key
  const [filledIds, setFilledIds] = useState(() => {
    try {
      if (user?.email) {
        const userKey = `${FILLED_FORMS_KEY}_${user.email.toLowerCase()}`;
        const saved = localStorage.getItem(userKey);
        if (saved !== null) {
          return JSON.parse(saved);
        }
        return [];
      } else {
        const saved = localStorage.getItem(FILLED_FORMS_KEY);
        if (saved !== null) {
          return JSON.parse(saved);
        }
      }
    } catch (err) {
      console.error('Error reading filled form societies:', err);
    }
    return [];
  });

  // Live countdown timer — ticks every second
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getCountdown = useCallback((deadlineStr) => {
    if (!deadlineStr) return null;
    const diff = new Date(deadlineStr) - now;
    if (diff <= 0) return { label: 'Closed', expired: true, tier: 'expired' };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const pad = (n) => String(n).padStart(2, '0');
    // Tier: green > 48h, warning ≤ 48h, urgent ≤ 12h
    const tier = h < 12 ? 'urgent' : h < 48 ? 'warning' : 'green';
    return { label: `${pad(h)}:${pad(m)}:${pad(s)}`, expired: false, hours: h, tier };
  }, [now]);

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

  // Load cloud data from Supabase user_metadata / user_progress on mount / user load
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const loadCloudData = async () => {
      let cloudBookmarks = user.user_metadata?.society_bookmarks;
      let cloudFilled = user.user_metadata?.society_filled_forms;

      // If user_metadata does not have society_bookmarks yet, attempt lookup in user_progress settings table
      if ((!Array.isArray(cloudBookmarks) || !Array.isArray(cloudFilled)) && hasValidCredentials) {
        try {
          const { data: progressData } = await supabase
            .from('user_progress')
            .select('settings')
            .eq('user_id', user.id)
            .maybeSingle();

          if (progressData?.settings) {
            if (!Array.isArray(cloudBookmarks) && Array.isArray(progressData.settings.society_bookmarks)) {
              cloudBookmarks = progressData.settings.society_bookmarks;
            }
            if (!Array.isArray(cloudFilled) && Array.isArray(progressData.settings.society_filled_forms)) {
              cloudFilled = progressData.settings.society_filled_forms;
            }
          }
        } catch (err) {
          console.warn('Notice loading user_progress backup:', err);
        }
      }

      if (!isMounted) return;

      if (Array.isArray(cloudBookmarks)) {
        setBookmarkedIds(cloudBookmarks);
        try {
          localStorage.setItem(bookmarksKey, JSON.stringify(cloudBookmarks));
        } catch (e) {}
      } else {
        setBookmarkedIds([]);
      }

      if (Array.isArray(cloudFilled)) {
        setFilledIds(cloudFilled);
        try {
          localStorage.setItem(filledKey, JSON.stringify(cloudFilled));
        } catch (e) {}
      } else {
        setFilledIds([]);
      }
    };

    loadCloudData();

    return () => {
      isMounted = false;
    };
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

  const moveBookmarkRank = (id, direction) => {
    setBookmarkedIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      syncProgressToCloud(next, filledIds);
      return next;
    });
  };

  const filteredSocieties = DEMO_SOCIETIES.filter((society) => {
    if (activeTab === 'preferred' && !bookmarkedIds.includes(society.id)) {
      return false;
    }

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

      const isMatch = matchName || matchShortName || matchId || matchDesc || matchCat || matchSubCats || matchPocs;
      if (!isMatch) return false;
    } else if (selectedCategory !== 'all') {
      const hasCat =
        society.category === selectedCategory ||
        (Array.isArray(society.categories) && society.categories.includes(selectedCategory));
      if (!hasCat) return false;
    }

    return true;
  });

  const shuffledIndexMap = React.useMemo(() => {
    const map = new Map();
    shuffledIds.forEach((id, index) => map.set(id, index));
    return map;
  }, [shuffledIds]);

  const sortedSocieties = [...filteredSocieties].sort((a, b) => {
    // In "My Preferred Societies" tab, default to preference rank order (#1 Choice first)
    if (activeTab === 'preferred') {
      if (sortBy === 'name' || sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      // Rank order (shuffled / rank)
      const rankA = bookmarkedIds.indexOf(a.id);
      const rankB = bookmarkedIds.indexOf(b.id);
      if (rankA !== -1 && rankB !== -1) return rankA - rankB;
      if (rankA !== -1) return -1;
      if (rankB !== -1) return 1;
      return a.name.localeCompare(b.name);
    }

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

  const totalCount = DEMO_SOCIETIES.length;
  const validSocietyIds = React.useMemo(() => new Set(DEMO_SOCIETIES.map((s) => s.id)), []);
  const bookmarkedCount = bookmarkedIds.filter((id) => validSocietyIds.has(id)).length;
  const filledCount = filledIds.filter((id) => validSocietyIds.has(id)).length;

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
              placeholder="Search by name, shortname, domain, or POR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="st-search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                type="button"
              >
                ✕
              </button>
            )}
          </div>
          <select
            className="st-sort-select"
            value={sortBy}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'shuffled' && sortBy === 'shuffled') {
                // Re-trigger a fresh shuffle if user re-selects shuffled option
                setShuffledIds(shuffleArray(DEMO_SOCIETIES.map((s) => s.id)));
              }
              setSortBy(val);
            }}
          >
            {activeTab === 'preferred' ? (
              <>
                <option value="rank">Sort by: Preference Rank (#1 First)</option>
                <option value="name">Sort by: Name (A-Z)</option>
                <option value="name-desc">Sort by: Name (Z-A)</option>
              </>
            ) : (
              <>
                <option value="shuffled">Sort by: Shuffled (Default)</option>
                <option value="name">Sort by: Name (A-Z)</option>
                <option value="name-desc">Sort by: Name (Z-A)</option>
              </>
            )}
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
            const rankIndex = bookmarkedIds.indexOf(society.id);
            const rank = rankIndex !== -1 ? rankIndex + 1 : null;
            const isFilled = filledIds.includes(society.id);
            const categoryList = society.categoryLabels || [society.categoryLabel];
            const primaryLabel = categoryList[0];
            const extraCount = categoryList.length - 1;

            return (
              <div
                key={society.id}
                className={`st-card ${isFilled ? 'is-filled' : ''} ${rank === 1 ? 'is-top-choice' : ''}`}
                onClick={() => setSelectedSociety(society)}
                title={`Click card to expand details for ${society.name}`}
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
                      {isSaved && rank !== null && (
                        <span
                          className={`st-rank-badge ${rank === 1 ? 'rank-top' : ''}`}
                          title={`Preference Rank #${rank}`}
                        >
                          ❤️ #{rank} {rank === 1 ? 'Top Choice' : 'Preference'}
                        </span>
                      )}
                      {isFilled && (
                        <span className="st-filled-badge">
                          <CheckIcon size={11} /> Filled
                        </span>
                      )}
                      <span className="st-expand-pill">
                        Details ↗
                      </span>
                    </div>
                    <div className="st-action-btns">
                      {isSaved && rankIndex !== -1 && (
                        <div className="st-rank-reorder-group" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="st-reorder-btn"
                            disabled={rankIndex === 0}
                            onClick={() => moveBookmarkRank(society.id, 'up')}
                            title="Move up (increase preference rank)"
                          >
                            ▲
                          </button>
                          <button
                            className="st-reorder-btn"
                            disabled={rankIndex === bookmarkedIds.length - 1}
                            onClick={() => moveBookmarkRank(society.id, 'down')}
                            title="Move down (lower preference rank)"
                          >
                            ▼
                          </button>
                        </div>
                      )}
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

                        {/* Dedicated Card-Bottom 50/50 Action Footer Bar (Contact PoR + Expand Details) */}
                        <div className="st-card-por-footer">
                          {Array.isArray(society.pocs) && society.pocs.length > 0 && (() => {
                            const primaryPoc = society.pocs[0];
                            const cleanPhone = primaryPoc.phone.replace(/[^0-9]/g, '').slice(-10);
                            const textMsg = encodeURIComponent(`Hi! I'm an SSCBS student inquiring about recruitment for ${society.shortName || society.name}.`);
                            return (
                              <a
                                href={`https://wa.me/91${cleanPhone}?text=${textMsg}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="st-card-por-link"
                                title={`Contact POR (${primaryPoc.name}) on WhatsApp`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <WhatsAppIcon size={14} />
                                <span>Contact PoR</span>
                              </a>
                            );
                          })()}
                          <button
                            type="button"
                            className="st-card-expand-btn"
                            title="Expand for full details & descriptions"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSociety(society);
                            }}
                          >
                            <span>Expand Details</span>
                            <span className="st-btn-arrow">↗</span>
                          </button>
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
                  {bookmarkedIds.includes(selectedSociety.id) && (
                    <span
                      className={`st-rank-badge ${bookmarkedIds.indexOf(selectedSociety.id) === 0 ? 'rank-top' : ''}`}
                    >
                      ❤️ #{bookmarkedIds.indexOf(selectedSociety.id) + 1} {bookmarkedIds.indexOf(selectedSociety.id) === 0 ? 'Top Choice' : 'Preference'}
                    </span>
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
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.83rem', opacity: 0.88 }}>
                              Official initial application forms and submission deadlines will drop here as soon as recruitments open!
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

              {Array.isArray(selectedSociety.pocs) && selectedSociety.pocs.length > 0 && (
                <div className="st-modal-section">
                  <h4 className="st-modal-sec-title">💬 Points of Responsibility (PORs) Contact</h4>
                  <div className="st-poc-grid">
                    {selectedSociety.pocs.map((poc, idx) => {
                      const cleanPhone = poc.phone.replace(/[^0-9]/g, '');
                      const formattedPhone =
                        cleanPhone.length === 10
                          ? `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`
                          : poc.phone;
                      const textMsg = encodeURIComponent(`Hi! I'm an SSCBS student inquiring about recruitment for ${selectedSociety.shortName || selectedSociety.name}.`);
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
