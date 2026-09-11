import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Self-contained SVG Icons to guarantee zero bundler chunking collisions or export mismatches
const BackIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const SearchIcon = ({ size = 18, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
);

const RefreshIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M2.5 22v-6h6" />
    <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.3L2.5 16" />
  </svg>
);

const ExternalLinkIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const TrophyIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
  </svg>
);

const UsersIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const FlameIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" />
  </svg>
);

const SparklesIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
    <path d="M19 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
  </svg>
);

const ClockIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CalendarIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const GraduationCapIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10 12 5 2 10l10 5 10-5v6" />
    <path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5" />
  </svg>
);

const CheckIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CopyIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
import './CaseCompsPage.css';

function formatDeadlineDisplay(deadlineStr, remainDaysText) {
  if (!deadlineStr) return remainDaysText || 'Ongoing';
  try {
    const d = new Date(deadlineStr);
    if (isNaN(d.getTime())) return remainDaysText || 'Ongoing';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return remainDaysText || 'Ongoing';
  }
}

function getCardCircuit(comp) {
  if (comp.isDU) return { type: 'du', label: 'DU Circuit', icon: '🎓' };
  if (comp.isIIMorMBA) return { type: 'iim', label: 'IIM / MBA', icon: '🏛️' };
  if (comp.isIITorTech) return { type: 'iit', label: 'IIT / Tech', icon: '⚙️' };
  if (comp.isFlagship) return { type: 'flagship', label: 'Tier-1 Flagship', icon: '⭐' };
  return { type: 'general', label: 'National Circuit', icon: '💼' };
}

export default function CaseCompsPage({ onBack, onNavigate }) {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'iim' | 'du' | 'iit' | 'flagship' | 'closing-soon'
  const [teamFilter, setTeamFilter] = useState('all'); // 'all' | 'solo' | 'team'
  const [copiedId, setCopiedId] = useState(null);
  const [isPlaybookExpanded, setIsPlaybookExpanded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchOpportunities = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setLoading(true);
    setFetchError(null);

    try {
      const res = await fetch('/api/competitions');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to reach Unstop`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCompetitions(data.data);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else {
        throw new Error(data.error || 'Empty response received from Unstop');
      }
    } catch (err) {
      console.error('Error fetching live Unstop competitions:', err);
      setFetchError(err.message || 'Unable to load real-time competitions from Unstop.');
      setCompetitions([]);
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
    const teamSize = Math.max(2, Math.min(5, comp.maxTeam || 4));
    const prefill = {
      competition_name: comp.title || '',
      organizer: comp.orgName || '',
      competition_link: comp.unstopUrl || '',
      title: `Team for ${comp.title || 'Case Competition'}`,
      description: `Building a squad for ${comp.title} (${comp.orgName}). Aiming for a winning pitch deck and national podium! Looking for peers with strong research, deck design, or quant skills.`,
      total_members: teamSize,
      spots_left: Math.max(1, teamSize - 1),
    };

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('sscbs_team_finder_prefill', JSON.stringify(prefill));
      }
    } catch (err) {
      console.warn('Could not cache prefill in sessionStorage', err);
    }

    if (onNavigate) {
      onNavigate('team-finder', prefill);
    }
  };

  // Metrics computation from 100% real Unstop competitions
  const metrics = useMemo(() => {
    const total = competitions.length;
    const du = competitions.filter((c) => c.isDU).length;
    const iim = competitions.filter((c) => c.isIIMorMBA).length;
    const iit = competitions.filter((c) => c.isIITorTech).length;
    const flagship = competitions.filter((c) => c.isFlagship).length;
    const closingSoon = competitions.filter((c) => c.daysRemainingNum <= 3).length;
    return { total, du, iim, iit, flagship, closingSoon };
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
      if (activeFilter === 'du' && !comp.isDU) return false;
      if (activeFilter === 'iim' && !comp.isIIMorMBA) return false;
      if (activeFilter === 'iit' && !comp.isIITorTech) return false;
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
              <span>LIVE UNSTOP FEED · 100% REAL OPPORTUNITIES</span>
            </div>
            <h1 className="cc-title">Case Competitions Alerts</h1>
            <p className="cc-subtitle">
              Live case competitions & corporate challenges synced directly from Unstop across Delhi University, IIMs, IITs, top B-Schools and national enterprises.
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
          className={`cc-metric-card ${activeFilter === 'iim' ? 'active' : ''}`}
          onClick={() => setActiveFilter('iim')}
        >
          <div className="cc-metric-icon gold">
            <FlameIcon size={18} />
          </div>
          <div className="cc-metric-info">
            <span className="cc-metric-value">{metrics.iim}</span>
            <span className="cc-metric-label">IIMs & Top MBA</span>
          </div>
        </div>

        <div
          className={`cc-metric-card ${activeFilter === 'du' ? 'active' : ''}`}
          onClick={() => setActiveFilter('du')}
        >
          <div className="cc-metric-icon success">
            <GraduationCapIcon size={18} />
          </div>
          <div className="cc-metric-info">
            <span className="cc-metric-value">{metrics.du}</span>
            <span className="cc-metric-label">DU Colleges</span>
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
            placeholder="Search by name, IIM, IIT, LSR, Stephen's, BITS, prizes..."
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
              All Comps ({metrics.total})
            </button>
            <button
              className={`cc-tab-btn ${activeFilter === 'iim' ? 'active' : ''}`}
              onClick={() => setActiveFilter('iim')}
            >
              🏛️ IIMs & MBA ({metrics.iim})
            </button>
            <button
              className={`cc-tab-btn ${activeFilter === 'du' ? 'active' : ''}`}
              onClick={() => setActiveFilter('du')}
            >
              🎓 DU Circuits ({metrics.du})
            </button>
            <button
              className={`cc-tab-btn ${activeFilter === 'iit' ? 'active' : ''}`}
              onClick={() => setActiveFilter('iit')}
            >
              ⚙️ IITs & Tech ({metrics.iit})
            </button>
            <button
              className={`cc-tab-btn ${activeFilter === 'flagship' ? 'active' : ''}`}
              onClick={() => setActiveFilter('flagship')}
            >
              ⭐ Tier-1 Flagships ({metrics.flagship})
            </button>
            <button
              className={`cc-tab-btn ${activeFilter === 'closing-soon' ? 'active' : ''}`}
              onClick={() => setActiveFilter('closing-soon')}
            >
              ⏳ Closing Soon ({metrics.closingSoon})
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
            Showing <strong>{filteredCompetitions.length}</strong> live active competitions from Unstop
            {lastUpdated && <span className="cc-last-sync"> · Synced at {lastUpdated}</span>}
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
              <h4>Start with Preliminary Decks</h4>
              <p>Target competitions with 3-slider executive summaries or open quiz rounds. They require zero prerequisite pedigree and focus on structured logic.</p>
            </div>
            <div className="cc-playbook-step">
              <span className="cc-step-number">02</span>
              <h4>Form a Balanced Squad</h4>
              <p>The classic CBS winning formula: <strong>1 Secondary Researcher</strong> + <strong>1 Financial/Quant Analyst</strong> + <strong>1 Deck Designer & Presenter</strong>.</p>
            </div>
            <div className="cc-playbook-step">
              <span className="cc-step-number">03</span>
              <h4>Use the Team Finder</h4>
              <p>Don't have a team yet? Use the <strong>Find Teammates</strong> button below any competition to link up with fellow batchmates and seniors on SSCBS OS.</p>
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
          <p className="cc-loading-title">Fetching live competitions from Unstop...</p>
          <p className="cc-loading-subtitle">Pulling direct listings across DU, IIMs, IITs & corporate circuits</p>
        </div>
      ) : fetchError ? (
        <div className="cc-empty-state error">
          <div className="cc-empty-icon">
            <TrophyIcon size={36} />
          </div>
          <h3 className="cc-empty-title">Could not load live competitions</h3>
          <p className="cc-empty-desc">{fetchError}</p>
          <button className="cc-empty-btn" onClick={() => fetchOpportunities(false)}>
            Retry Connection to Unstop
          </button>
        </div>
      ) : filteredCompetitions.length === 0 ? (
        <div className="cc-empty-state">
          <div className="cc-empty-icon">
            <TrophyIcon size={36} />
          </div>
          <h3 className="cc-empty-title">No competitions match your filter</h3>
          <p className="cc-empty-desc">
            Try searching a different keyword or resetting your filter tabs.
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
          {filteredCompetitions.map((comp) => {
            const circuit = getCardCircuit(comp);
            const deadlineText = formatDeadlineDisplay(comp.deadline, comp.remainDaysText);

            return (
              <article key={comp.id} className={`cc-card cc-card-${circuit.type}`}>
                {/* Top circuit accent line */}
                <div className={`cc-card-accent-bar cc-accent-${circuit.type}`} />

                <div className="cc-card-inner">
                  {/* Row 1: Header pills (Circuit + Entry + Urgency) */}
                  <div className="cc-card-header-pills">
                    <div className="cc-pill-group-left">
                      <span className={`cc-circuit-pill ${circuit.type}`}>
                        <span className="cc-circuit-icon">{circuit.icon}</span>
                        <span>{circuit.label}</span>
                      </span>
                      {comp.isFree ? (
                        <span className="cc-entry-pill free">Free Entry</span>
                      ) : (
                        <span className="cc-entry-pill paid">Paid</span>
                      )}
                    </div>

                    <div className={`cc-urgency-chip ${comp.urgency}`}>
                      <span className="cc-status-dot" />
                      <span>{comp.remainDaysText}</span>
                    </div>
                  </div>

                  {/* Row 2: Host / Organizer */}
                  <div className="cc-host-row">
                    {comp.orgLogo ? (
                      <img
                        src={comp.orgLogo}
                        alt=""
                        className="cc-host-logo"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className={`cc-host-avatar ${circuit.type}`}>
                        {(comp.orgName ? comp.orgName.charAt(0) : 'A').toUpperCase()}
                      </div>
                    )}
                    <span className="cc-host-name" title={comp.orgName || 'Academic Host'}>
                      {comp.orgName || 'Academic Host'}
                    </span>
                  </div>

                  {/* Row 3: Competition Title */}
                  <h2 className="cc-card-title" title={comp.title || 'Case Competition'}>
                    {comp.title || 'Case Competition'}
                  </h2>

                  {/* Row 4: 3-Column Bento Specs Grid */}
                  <div className="cc-specs-grid">
                    <div className="cc-spec-cell">
                      <span className="cc-spec-label">
                        <TrophyIcon size={11} /> PRIZE POOL
                      </span>
                      <span className="cc-spec-val prize" title={comp.prizes || 'Recognition'}>
                        {comp.prizes || 'Recognition'}
                      </span>
                    </div>

                    <div className="cc-spec-cell">
                      <span className="cc-spec-label">
                        <UsersIcon size={11} /> FORMAT
                      </span>
                      <span className="cc-spec-val" title={comp.teamSizeDisplay || 'Solo / Team'}>
                        {comp.teamSizeDisplay || 'Solo / Team'}
                      </span>
                    </div>

                    <div className="cc-spec-cell">
                      <span className="cc-spec-label">
                        <CalendarIcon size={11} /> DEADLINE
                      </span>
                      <span className="cc-spec-val" title={deadlineText}>
                        {deadlineText}
                      </span>
                    </div>
                  </div>

                  {/* Row 5: Micro Social Proof & Status */}
                  <div className="cc-card-meta-row">
                    <span className="cc-meta-reg">
                      {Number(comp.registeredCount || 0) > 0 ? (
                        <>
                          <strong>{Number(comp.registeredCount).toLocaleString()}</strong> applied
                        </>
                      ) : (
                        <span className="cc-meta-fresh">⚡ Recently Listed</span>
                      )}
                    </span>
                  </div>

                  {/* Row 6: Action Buttons */}
                  <div className="cc-card-actions">
                    <a
                      href={comp.unstopUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cc-action-btn cc-btn-apply"
                    >
                      <span>Apply on Unstop</span>
                      <ExternalLinkIcon size={12} />
                    </a>

                    <button
                      type="button"
                      className="cc-action-btn cc-btn-team"
                      onClick={(e) => handleFindTeammates(comp, e)}
                      title="Find batchmates on Team Finder"
                    >
                      <UsersIcon size={13} />
                      <span>Find Teammates</span>
                    </button>

                    <button
                      type="button"
                      className={`cc-share-icon-btn ${copiedId === comp.id ? 'copied' : ''}`}
                      onClick={(e) => handleShare(comp, e)}
                      title={copiedId === comp.id ? 'Copied link!' : 'Copy competition link'}
                    >
                      {copiedId === comp.id ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
