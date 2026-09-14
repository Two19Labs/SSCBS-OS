import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CATEGORIES, DEMO_SOCIETIES, OFFICIAL_COLLEGE_SOCIETIES_URL } from '../data/societies';
import {
  SearchIcon,
  InstagramIcon,
  LinktreeIcon,
  LinkedinIcon,
  BriefcaseIcon,
  HeartIcon,
  BackIcon,
  WhatsAppIcon,
} from './icons';
import { useAuth } from '../context/AuthContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import './SocietyTrackerPage.css';

const LOCAL_STORAGE_KEY = 'sscbs_bookmarked_societies';

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

export default function SocietyTrackerPage({ onBack, onNavigate }) {
  const { user } = useAuth();
  const userKeySuffix = user?.email ? `_${user.email.toLowerCase()}` : '';
  const bookmarksKey = `${LOCAL_STORAGE_KEY}${userKeySuffix}`;

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'preferred'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  // Randomized shuffled order generated once per load/refresh
  const [shuffledIds, setShuffledIds] = useState(() => shuffleArray(DEMO_SOCIETIES.map((s) => s.id)));
  const [sortBy, setSortBy] = useState('shuffled');
  const [selectedSociety, setSelectedSociety] = useState(null);

  // Bookmarks (Heart / Star) state with user-scoped key
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

  // Helper for background cloud sync across devices
  const syncProgressToCloud = useCallback(async (newBookmarks) => {
    if (!user || !hasValidCredentials) return;
    try {
      // 1. Save to Supabase auth user metadata (syncs across devices on login)
      const { data, error } = await supabase.auth.updateUser({
        data: {
          society_bookmarks: newBookmarks,
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

      // If user_metadata does not have society_bookmarks yet, attempt lookup in user_progress settings table
      if (!Array.isArray(cloudBookmarks) && hasValidCredentials) {
        try {
          const { data: progressData } = await supabase
            .from('user_progress')
            .select('settings')
            .eq('user_id', user.id)
            .maybeSingle();

          if (progressData?.settings && Array.isArray(progressData.settings.society_bookmarks)) {
            cloudBookmarks = progressData.settings.society_bookmarks;
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
    };

    loadCloudData();

    return () => {
      isMounted = false;
    };
  }, [user, bookmarksKey]);

  // Sync bookmarks with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(bookmarksKey, JSON.stringify(bookmarkedIds));
    } catch (err) {
      console.error('Error saving bookmarks:', err);
    }
  }, [bookmarkedIds, bookmarksKey]);

  const toggleBookmark = (id) => {
    setBookmarkedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      syncProgressToCloud(next);
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
      syncProgressToCloud(next);
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

  const shuffledIndexMap = useMemo(() => {
    const map = new Map();
    shuffledIds.forEach((id, index) => map.set(id, index));
    return map;
  }, [shuffledIds]);

  const sortedSocieties = [...filteredSocieties].sort((a, b) => {
    // In "Starred" tab, default to preference rank order
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
  const validSocietyIds = useMemo(() => new Set(DEMO_SOCIETIES.map((s) => s.id)), []);
  const bookmarkedCount = bookmarkedIds.filter((id) => validSocietyIds.has(id)).length;
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
          <div>
            <h1 className="st-title">Central Societies Database</h1>
            <p className="st-subtitle">
              Comprehensive directory of all {totalCount} official societies, cells, and student initiatives at SSCBS.
            </p>
          </div>
        </div>
      </div>

      {/* Directory Welcome Banner */}
      <div className="st-directory-hero">
        <div className="st-hero-icon">🏛️</div>
        <div className="st-hero-content">
          <div className="st-hero-title">SSCBS Central Societies Database</div>
          <p className="st-hero-desc">
            Explore SSCBS's ecosystem of student-run societies and cells across {totalDomainsCount} distinct domains.
            Browse full society dossiers, connect directly with student Points of Responsibility (PoRs) on WhatsApp, and follow official portals.
          </p>
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
          <div className="st-metric-icon">🏷️</div>
          <div>
            <div className="st-metric-val">{totalDomainsCount}</div>
            <div className="st-metric-lbl">Active Domains</div>
          </div>
        </div>
        <div className="st-metric-card">
          <div className="st-metric-icon">💬</div>
          <div>
            <div className="st-metric-val">{totalPocsCount}+</div>
            <div className="st-metric-lbl">Student PoRs</div>
          </div>
        </div>
        <div className="st-metric-card">
          <div className="st-metric-icon">⭐</div>
          <div>
            <div className="st-metric-val">{bookmarkedCount}</div>
            <div className="st-metric-lbl">Starred Societies</div>
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
            <span className="st-tab-count">{totalCount}</span>
          </button>
          <button
            className={`st-tab-btn ${activeTab === 'preferred' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferred')}
          >
            <HeartIcon filled={activeTab === 'preferred'} size={16} /> Starred Societies
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
              placeholder="Search by name, acronym (e.g. ACM, FinX), domain, TIC, or PoR..."
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
                <option value="rank">Sort by: Saved Rank Order</option>
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
            const categoryList = society.categoryLabels || [society.categoryLabel];
            const primaryLabel = categoryList[0];
            const extraCount = categoryList.length - 1;

            return (
              <div
                key={society.id}
                className={`st-card ${rank === 1 ? 'is-top-choice' : ''}`}
                onClick={() => setSelectedSociety(society)}
                title={`Click card to view dossier for ${society.name}`}
              >
                {/* Header & Title */}
                <div className="st-card-main">
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
                          title={`Starred #${rank}`}
                        >
                          ⭐ #{rank} {rank === 1 ? 'Top Pick' : 'Starred'}
                        </span>
                      )}
                    </div>
                    <div className="st-action-btns">
                      {isSaved && rankIndex !== -1 && activeTab === 'preferred' && (
                        <div className="st-rank-reorder-group" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="st-reorder-btn"
                            disabled={rankIndex === 0}
                            onClick={() => moveBookmarkRank(society.id, 'up')}
                            title="Move up"
                          >
                            ▲
                          </button>
                          <button
                            className="st-reorder-btn"
                            disabled={rankIndex === bookmarkedIds.length - 1}
                            onClick={() => moveBookmarkRank(society.id, 'down')}
                            title="Move down"
                          >
                            ▼
                          </button>
                        </div>
                      )}
                      <button
                        className={`st-heart-btn ${isSaved ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBookmark(society.id);
                        }}
                        title={isSaved ? 'Remove from starred' : 'Add to starred societies'}
                      >
                        <HeartIcon filled={isSaved} size={15} />
                      </button>
                    </div>
                  </div>

                  <h3 className="st-society-title">{society.name}</h3>
                  <p className="st-card-desc">{society.description || '\u00A0'}</p>

                  {/* Compact Single-Line TIC Strip */}
                  {(() => {
                    const hasTics = Array.isArray(society.tics) && society.tics.length > 0;
                    const tooltipText = hasTics
                      ? `Teacher(s)-in-Charge: ${society.tics.join(', ')} (Click card for full profiles)`
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

                {/* Card Bottom / Action Row */}
                <div className="st-card-bottom">
                  <div className="st-card-social-strip">
                    <span className="st-social-strip-label">Official Handles</span>
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
                      {society.whatsappGroupUrl && !society.linkedinUrl ? (
                        <a
                          href={society.whatsappGroupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="st-social-btn whatsapp"
                          title="Official WhatsApp Group"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <WhatsAppIcon size={18} />
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
                          <LinkedinIcon size={18} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Dedicated Card-Bottom 50/50 Action Footer Bar (Contact PoR + View Dossier) */}
                  <div className="st-card-por-footer">
                    {Array.isArray(society.pocs) && society.pocs.length > 0 && (() => {
                      const primaryPoc = society.pocs[0];
                      const cleanPhone = primaryPoc.phone.replace(/[^0-9]/g, '').slice(-10);
                      const textMsg = encodeURIComponent(
                        `Hi ${primaryPoc.name}! I'm an SSCBS student reaching out regarding ${society.shortName || society.name}.`
                      );
                      return (
                        <a
                          href={`https://wa.me/91${cleanPhone}?text=${textMsg}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="st-card-por-link"
                          title={`Contact PoR (${primaryPoc.name}) on WhatsApp`}
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
                      title="Expand for full dossier, contacts & domains"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSociety(society);
                      }}
                    >
                      <span>View Dossier</span>
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
            <HeartIcon size={24} />
          </div>
          <h3 className="st-empty-title">
            {activeTab === 'preferred'
              ? 'No Starred Societies Saved Yet'
              : 'No Societies Found'}
          </h3>
          <p className="st-empty-sub">
            {activeTab === 'preferred'
              ? 'Click the heart or star icon on any society card in "All Societies" to save them to your favorites roster!'
              : 'Try clearing your search query or selecting a different domain filter.'}
          </p>
          {activeTab === 'preferred' && (
            <button
              className="st-college-btn"
              style={{ display: 'inline-flex', width: 'auto', padding: '9px 18px', marginTop: '12px' }}
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
                      ⭐ #{bookmarkedIds.indexOf(selectedSociety.id) + 1} Starred Pick
                    </span>
                  )}
                </div>
                <h2 className="st-modal-title">{selectedSociety.name}</h2>
              </div>
              <div className="st-modal-header-actions">
                <button
                  className={`st-heart-btn ${
                    bookmarkedIds.includes(selectedSociety.id) ? 'active' : ''
                  }`}
                  onClick={() => toggleBookmark(selectedSociety.id)}
                  title={bookmarkedIds.includes(selectedSociety.id) ? 'Remove from starred' : 'Add to starred'}
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
                              <span>View Details</span>
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
                        Teacher-in-Charge details have not yet been officially updated in current college records for this initiative. Please check with society PoRs above for details.
                      </p>
                    </div>
                  </div>
                )}
              </div>

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

            <div className="st-modal-footer">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                      className="st-card-por-link"
                      style={{ padding: '8px 14px', height: '36px' }}
                      title={`Message ${primaryPoc.name} on WhatsApp`}
                    >
                      <WhatsAppIcon size={15} />
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
                  {selectedSociety.id === 'literary-society' ? <LinktreeIcon size={20} /> : <InstagramIcon size={20} />}
                </a>
                {selectedSociety.whatsappGroupUrl && !selectedSociety.linkedinUrl ? (
                  <a
                    href={selectedSociety.whatsappGroupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="st-social-btn whatsapp"
                    title="Official WhatsApp Group"
                  >
                    <WhatsAppIcon size={20} />
                  </a>
                ) : (
                  <a
                    href={selectedSociety.linkedinUrl || 'https://linkedin.com'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="st-social-btn linkedin"
                    title="LinkedIn Profile"
                  >
                    <LinkedinIcon size={20} />
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
