import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BackIcon,
  SearchIcon,
  RefreshIcon,
  ExternalLinkIcon,
  TrophyIcon,
  UsersIcon,
  FlameIcon,
  SparklesIcon,
  ClockIcon,
  CheckIcon,
  CopyIcon,
  GraduationCapIcon,
} from './icons';
import './CaseCompsPage.css';

// Resilient fallback opportunities in case Unstop API is temporarily unavailable
const FALLBACK_COMPETITIONS = [
  {
    id: 'fb-1',
    title: 'Tata Imagination Challenge 2026',
    orgName: 'Tata Group & IIM Bangalore',
    orgLogo: 'https://d8it4huxumps7.cloudfront.net/images/partners/partners75/5d08e336c6a1e_Indian_Institute_of_Management_Rohtak_logo.jpg',
    unstopUrl: 'https://unstop.com/competitions',
    deadline: '2026-09-25T23:59:00+05:30',
    remainDaysText: '14 days left',
    daysRemainingNum: 14,
    urgency: 'normal',
    minTeam: 1,
    maxTeam: 3,
    teamSizeDisplay: '1 - 3 Members',
    prizes: '₹2,00,000 Cash Pool & PPIs',
    isFree: true,
    isFlagship: true,
    isFirstYearFriendly: true,
    registeredCount: 3420,
  },
  {
    id: 'fb-2',
    title: 'Moneyball: The Strategy & Valuation Challenge',
    orgName: 'BITS Pilani · Interface 2026',
    orgLogo: 'https://d8it4huxumps7.cloudfront.net/images/partners/partners75/677e49accecfc_bits-management.png',
    unstopUrl: 'https://unstop.com/competitions',
    deadline: '2026-09-21T23:59:00+05:30',
    remainDaysText: '10 days left',
    daysRemainingNum: 10,
    urgency: 'normal',
    minTeam: 1,
    maxTeam: 4,
    teamSizeDisplay: '1 - 4 Members',
    prizes: '₹16,000 Cash Pool',
    isFree: true,
    isFlagship: true,
    isFirstYearFriendly: true,
    registeredCount: 1280,
  },
  {
    id: 'fb-3',
    title: 'The Product Graveyard & Resurrections',
    orgName: 'Indian Institute of Management (IIM), Rohtak',
    orgLogo: 'https://d8it4huxumps7.cloudfront.net/images/partners/partners75/5d08e336c6a1e_Indian_Institute_of_Management_Rohtak_logo.jpg',
    unstopUrl: 'https://unstop.com/competitions',
    deadline: '2026-09-12T23:59:00+05:30',
    remainDaysText: '1 days left',
    daysRemainingNum: 1,
    urgency: 'high',
    minTeam: 1,
    maxTeam: 2,
    teamSizeDisplay: '1 - 2 Members',
    prizes: 'Certificates & National Recognition',
    isFree: true,
    isFlagship: true,
    isFirstYearFriendly: true,
    registeredCount: 890,
  },
];

export default function CaseCompsPage({ onBack, onNavigate }) {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'first-year' | 'flagship' | 'closing-soon'
  const [teamFilter, setTeamFilter] = useState('all'); // 'all' | 'solo' | 'team'
  const [copiedId, setCopiedId] = useState(null);
  const [isPlaybookExpanded, setIsPlaybookExpanded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchOpportunities = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/competitions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setCompetitions(data.data);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else {
        setCompetitions(FALLBACK_COMPETITIONS);
      }
    } catch (err) {
      console.warn('Failed to fetch live Unstop competitions, using fallback list:', err);
      setCompetitions(FALLBACK_COMPETITIONS);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleShare = (comp, e) => {
    e.stopPropagation();
    const shareText = `Check out this case competition on Unstop: "${comp.title}" by ${comp.orgName}.\nApply: ${comp.unstopUrl}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setCopiedId(comp.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleFindTeammates = (comp, e) => {
    e.stopPropagation();
    if (onNavigate) {
      onNavigate('team-finder');
    }
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const total = competitions.length;
    const firstYear = competitions.filter((c) => c.isFirstYearFriendly).length;
    const flagship = competitions.filter((c) => c.isFlagship).length;
    const closingSoon = competitions.filter((c) => c.daysRemainingNum <= 3).length;
    return { total, firstYear, flagship, closingSoon };
  }, [competitions]);

  // Filtering
  const filteredCompetitions = useMemo(() => {
    return competitions.filter((comp) => {
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = comp.title?.toLowerCase().includes(q);
        const matchesOrg = comp.orgName?.toLowerCase().includes(q);
        const matchesPrize = comp.prizes?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesOrg && !matchesPrize) return false;
      }

      // Category filter
      if (activeFilter === 'first-year' && !comp.isFirstYearFriendly) return false;
      if (activeFilter === 'flagship' && !comp.isFlagship) return false;
      if (activeFilter === 'closing-soon' && comp.daysRemainingNum > 3) return false;

      // Team filter
      if (teamFilter === 'solo' && comp.maxTeam > 1) return false;
      if (teamFilter === 'team' && comp.maxTeam <= 1) return false;

      return true;
    });
  }, [competitions, searchQuery, activeFilter, teamFilter]);

  return (
    <div className="case-comps-container">
      {/* ── Top Header ── */}
      <header className="cc-header">
        <div className="cc-header-left">
          {onBack && (
            <button className="cc-back-btn" onClick={onBack} aria-label="Go back">
              <BackIcon size={18} />
            </button>
          )}
          <div>
            <div className="cc-badge">
              <SparklesIcon size={13} />
              <span>LIVE ALERTS · FIRST YEAR FOCUS</span>
            </div>
            <h1 className="cc-title">Case Competitions Alerts</h1>
            <p className="cc-subtitle">
              Live opportunities pulled automatically from Unstop, pre-filtered for undergraduate & first-year CBSites.
            </p>
          </div>
        </div>

        <div className="cc-header-actions">
          <button
            className={`cc-refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
            onClick={() => fetchOpportunities(true)}
            disabled={isRefreshing || loading}
            title="Refresh live Unstop feed"
          >
            <RefreshIcon size={15} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Unstop'}</span>
          </button>
        </div>
      </header>

      {/* ── Metrics Stat Bar ── */}
      <div className="cc-metrics-grid">
        <div
          className={`cc-metric-card ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          <div className="cc-metric-icon info">
            <TrophyIcon size={18} />
          </div>
          <div className="cc-metric-info">
            <span className="cc-metric-value">{metrics.total}</span>
            <span className="cc-metric-label">Live Opportunities</span>
          </div>
        </div>

        <div
          className={`cc-metric-card ${activeFilter === 'first-year' ? 'active' : ''}`}
          onClick={() => setActiveFilter('first-year')}
        >
          <div className="cc-metric-icon success">
            <GraduationCapIcon size={18} />
          </div>
          <div className="cc-metric-info">
            <span className="cc-metric-value">{metrics.firstYear}</span>
            <span className="cc-metric-label">First-Year Friendly</span>
          </div>
        </div>

        <div
          className={`cc-metric-card ${activeFilter === 'flagship' ? 'active' : ''}`}
          onClick={() => setActiveFilter('flagship')}
        >
          <div className="cc-metric-icon gold">
            <FlameIcon size={18} />
          </div>
          <div className="cc-metric-info">
            <span className="cc-metric-value">{metrics.flagship}</span>
            <span className="cc-metric-label">Tier-1 & Flagships</span>
          </div>
        </div>

        <div
          className={`cc-metric-card ${activeFilter === 'closing-soon' ? 'active' : ''}`}
          onClick={() => setActiveFilter('closing-soon')}
        >
          <div className="cc-metric-icon urgent">
            <ClockIcon size={18} />
          </div>
          <div className="cc-metric-info">
            <span className="cc-metric-value">{metrics.closingSoon}</span>
            <span className="cc-metric-label">Closing in 72h</span>
          </div>
        </div>
      </div>

      {/* ── Filter Bar & Search ── */}
      <div className="cc-filter-section">
        <div className="cc-search-wrapper">
          <SearchIcon size={16} className="cc-search-icon" />
          <input
            type="text"
            className="cc-search-input"
            placeholder="Search by name, IIM, BITS, SRCC, or prizes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="cc-clear-search" onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>

        <div className="cc-pill-filters">
          <div className="cc-tabs">
            <button
              className={`cc-tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All Comps
            </button>
            <button
              className={`cc-tab-btn ${activeFilter === 'first-year' ? 'active' : ''}`}
              onClick={() => setActiveFilter('first-year')}
            >
              🎓 First-Year Picks
            </button>
            <button
              className={`cc-tab-btn ${activeFilter === 'flagship' ? 'active' : ''}`}
              onClick={() => setActiveFilter('flagship')}
            >
              ⭐ Tier-1 Flagship
            </button>
            <button
              className={`cc-tab-btn ${activeFilter === 'closing-soon' ? 'active' : ''}`}
              onClick={() => setActiveFilter('closing-soon')}
            >
              ⏳ Closing Soon
            </button>
          </div>

          <div className="cc-team-pills">
            <button
              className={`cc-team-pill ${teamFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTeamFilter('all')}
            >
              All Formats
            </button>
            <button
              className={`cc-team-pill ${teamFilter === 'solo' ? 'active' : ''}`}
              onClick={() => setTeamFilter('solo')}
            >
              Solo
            </button>
            <button
              className={`cc-team-pill ${teamFilter === 'team' ? 'active' : ''}`}
              onClick={() => setTeamFilter('team')}
            >
              Teams (2+)
            </button>
          </div>
        </div>
      </div>

      {/* ── Notice / Status Banner ── */}
      <div className="cc-status-bar">
        <div className="cc-status-left">
          <span className="cc-pulse-dot"></span>
          <span>
            Showing <strong>{filteredCompetitions.length}</strong> active case competitions
            {lastUpdated && <span className="cc-last-sync"> · Last synced at {lastUpdated}</span>}
          </span>
        </div>
        <button
          className="cc-playbook-toggle"
          onClick={() => setIsPlaybookExpanded(!isPlaybookExpanded)}
        >
          <span>{isPlaybookExpanded ? 'Hide' : 'Show'} 1st Year Case Guide</span>
          <span className="cc-toggle-arrow">{isPlaybookExpanded ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* ── Expandable First-Year Case Playbook ── */}
      {isPlaybookExpanded && (
        <div className="cc-playbook-card">
          <div className="cc-playbook-header">
            <div className="cc-playbook-icon">
              <GraduationCapIcon size={20} />
            </div>
            <div>
              <h3 className="cc-playbook-title">The SSCBS 1st Year Case Comp Playbook</h3>
              <p className="cc-playbook-desc">
                How to participate, build a team, and make national podiums in your very first semester:
              </p>
            </div>
          </div>
          <div className="cc-playbook-grid">
            <div className="cc-playbook-step">
              <span className="cc-step-number">01</span>
              <h4>Pick the Right Comp</h4>
              <p>Look for the <strong>🎓 First-Year Pick</strong> badge. These typically have simple preliminary quiz or 3-slider executive summary rounds with zero prerequisite barriers.</p>
            </div>
            <div className="cc-playbook-step">
              <span className="cc-step-number">02</span>
              <h4>Form a Balanced Squad</h4>
              <p>The classic CBS winning formula: <strong>1 Secondary Researcher</strong> + <strong>1 Financial/Quant Analyst</strong> + <strong>1 Deck Designer & Presenter</strong>.</p>
            </div>
            <div className="cc-playbook-step">
              <span className="cc-step-number">03</span>
              <h4>Use the Team Finder</h4>
              <p>Don't have a team yet? Use the <strong>Find CBS Teammates</strong> button below any competition to link up with fellow batchmates and seniors on SSCBS OS.</p>
            </div>
            <div className="cc-playbook-step">
              <span className="cc-step-number">04</span>
              <h4>Focus on Structure over Jargon</h4>
              <p>Judges value clear problem framing, MECE segmentation, and actionable financial feasibility far more than fancy business buzzwords.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Competitions Grid ── */}
      {loading ? (
        <div className="cc-loading-state">
          <div className="cc-spinner"></div>
          <p className="cc-loading-title">Connecting to Unstop catalog...</p>
          <p className="cc-loading-subtitle">Filtering active undergraduate case competitions for you</p>
        </div>
      ) : filteredCompetitions.length === 0 ? (
        <div className="cc-empty-state">
          <div className="cc-empty-icon">
            <TrophyIcon size={36} />
          </div>
          <h3 className="cc-empty-title">No competitions found</h3>
          <p className="cc-empty-desc">
            Try adjusting your search query or switching tabs to see more opportunities.
          </p>
          <button
            className="cc-empty-btn"
            onClick={() => {
              setSearchQuery('');
              setActiveFilter('all');
              setTeamFilter('all');
            }}
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="cc-grid">
          {filteredCompetitions.map((comp) => (
            <article key={comp.id} className="cc-card">
              {/* Card Header: Organizer */}
              <div className="cc-card-top">
                <div className="cc-org-wrapper">
                  {comp.orgLogo ? (
                    <img
                      src={comp.orgLogo}
                      alt=""
                      className="cc-org-logo"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="cc-org-placeholder">
                      {comp.orgName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="cc-org-name" title={comp.orgName}>
                    {comp.orgName}
                  </span>
                </div>

                <div className={`cc-urgency-badge ${comp.urgency}`}>
                  <ClockIcon size={12} />
                  <span>{comp.remainDaysText}</span>
                </div>
              </div>

              {/* Title */}
              <h2 className="cc-card-title" title={comp.title}>
                {comp.title}
              </h2>

              {/* Tag Badges */}
              <div className="cc-badges-row">
                {comp.isFlagship && (
                  <span className="cc-tag gold">
                    <FlameIcon size={11} filled /> Tier-1 Flagship
                  </span>
                )}
                {comp.isFirstYearFriendly && (
                  <span className="cc-tag green">
                    <GraduationCapIcon size={11} /> First-Year Pick
                  </span>
                )}
                <span className="cc-tag neutral">
                  <UsersIcon size={11} /> {comp.teamSizeDisplay}
                </span>
                {comp.isFree && (
                  <span className="cc-tag free">Free Entry</span>
                )}
              </div>

              {/* Highlights Box */}
              <div className="cc-details-box">
                <div className="cc-detail-item">
                  <span className="cc-detail-label">Prize Pool</span>
                  <span className="cc-detail-value prize">{comp.prizes}</span>
                </div>
                {comp.registeredCount > 0 && (
                  <div className="cc-detail-item">
                    <span className="cc-detail-label">Registrations</span>
                    <span className="cc-detail-value">{comp.registeredCount.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="cc-card-actions">
                <a
                  href={comp.unstopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cc-btn primary"
                >
                  <span>Apply on Unstop</span>
                  <ExternalLinkIcon size={13} />
                </a>

                <button
                  type="button"
                  className="cc-btn secondary"
                  onClick={(e) => handleFindTeammates(comp, e)}
                  title="Find CBS teammates on Team Finder"
                >
                  <UsersIcon size={14} />
                  <span>Find Teammates</span>
                </button>

                <button
                  type="button"
                  className={`cc-share-btn ${copiedId === comp.id ? 'copied' : ''}`}
                  onClick={(e) => handleShare(comp, e)}
                  title="Share with friends"
                >
                  {copiedId === comp.id ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
