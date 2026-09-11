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

              {/* Badges Row */}
              <div className="cc-badges-row">
                {comp.isDU && (
                  <span className="cc-tag purple">
                    🎓 DU Circuit
                  </span>
                )}
                {comp.isIIMorMBA && (
                  <span className="cc-tag gold">
                    🏛️ IIM / MBA
                  </span>
                )}
                {comp.isIITorTech && (
                  <span className="cc-tag blue">
                    ⚙️ IIT / Tech
                  </span>
                )}
                {comp.isFlagship && !comp.isIIMorMBA && !comp.isDU && (
                  <span className="cc-tag gold">
                    <FlameIcon size={11} filled /> Tier-1 Flagship
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
                  title="Share competition with friends"
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
