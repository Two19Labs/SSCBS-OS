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
  CalendarIcon,
} from './icons';
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
                        {comp.orgName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="cc-host-name" title={comp.orgName}>
                      {comp.orgName}
                    </span>
                  </div>

                  {/* Row 3: Competition Title */}
                  <h2 className="cc-card-title" title={comp.title}>
                    {comp.title}
                  </h2>

                  {/* Row 4: 3-Column Bento Specs Grid */}
                  <div className="cc-specs-grid">
                    <div className="cc-spec-cell">
                      <span className="cc-spec-label">
                        <TrophyIcon size={11} /> PRIZE POOL
                      </span>
                      <span className="cc-spec-val prize" title={comp.prizes}>
                        {comp.prizes}
                      </span>
                    </div>

                    <div className="cc-spec-cell">
                      <span className="cc-spec-label">
                        <UsersIcon size={11} /> FORMAT
                      </span>
                      <span className="cc-spec-val" title={comp.teamSizeDisplay}>
                        {comp.teamSizeDisplay}
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

                  {/* Row 5: Micro Social Proof & Recommendation Tag */}
                  <div className="cc-card-meta-row">
                    {comp.isFirstYearFriendly ? (
                      <span className="cc-meta-tag fyp">
                        <SparklesIcon size={11} /> 1st Year Friendly
                      </span>
                    ) : (
                      <span className="cc-meta-tag open">
                        Verified Listing
                      </span>
                    )}

                    <span className="cc-meta-reg">
                      {comp.registeredCount > 0 ? (
                        <>
                          <strong>{comp.registeredCount.toLocaleString()}</strong> applied
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
                      title="Find CBS batchmates on Team Finder"
                    >
                      <UsersIcon size={13} />
                      <span>CBS Teammates</span>
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
