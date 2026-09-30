import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { useConfig } from './context/ConfigContext';
import { initPostHog, logFeatureView, logFeatureClick, subscribeToPresence, FEATURE_NAMES, trackNavigationEvent, trackGpaEvent, trackPostHogPageView } from './lib/analytics';
import Auth from './components/Auth';
import HomeDashboard from './components/HomeDashboard';
import ProfilePage from './components/ProfilePage';
import ProfileModal from './components/ProfileModal';
import NoticeBoard from './components/NoticeBoard';
import ErrorBoundary from './components/ErrorBoundary';
import { isAdminEmail, canAccessTeamFinder, canAccessEmptyRoom, canAccessFacultyDatabase, canAccessSocietyTracker, canAccessCaseComps } from './lib/admin';
import {
  HomeIcon,
  CalendarIcon,
  GridIcon,
  UserIcon,
  SearchIcon,
  PercentIcon,
  CalculatorIcon,
  FileIcon,
  MegaphoneIcon,
  ShieldIcon,
  BackIcon,
  MessageIcon,
  TrophyIcon,
  DoorIcon,
  UsersIcon,
  FlameIcon,
  MenuIcon,
  CloseIcon,
} from './components/icons';
import './App.css';
import InstallPwaPrompt from './components/InstallPwaPrompt';
import FooterCredit from './components/FooterCredit';
import NotificationCenter from './components/NotificationCenter';
import { useNotificationEngine } from './hooks/useNotificationEngine';

// Resilient lazy loader helper for Vercel chunk hash updates
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageHasBeenRetried = typeof window !== 'undefined' && window.sessionStorage.getItem('sscbs_chunk_retry');
    try {
      const component = await componentImport();
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('sscbs_chunk_retry');
      }
      return component;
    } catch (error) {
      if (!pageHasBeenRetried && typeof window !== 'undefined') {
        window.sessionStorage.setItem('sscbs_chunk_retry', 'true');
        window.location.reload();
      }
      throw error;
    }
  });

const WaiverToolPage = lazyWithRetry(() => import('./components/WaiverToolPage'));
const FindMyProfessorPage = lazyWithRetry(() => import('./components/FindMyProfessorPage'));
const FacultyDatabasePage = lazyWithRetry(() => import('./components/FacultyDatabasePage'));
const AdminConsolePage = lazyWithRetry(() => import('./components/AdminConsolePage'));
const GpaCalculatorModal = lazyWithRetry(() => import('./components/GpaCalculatorModal'));
const ContactPage = lazyWithRetry(() => import('./components/ContactPage'));
const TeamFinderPage = lazyWithRetry(() => import('./components/TeamFinderPage'));
const EmptyRoomFinderPage = lazyWithRetry(() => import('./components/EmptyRoomFinderPage').then(m => ({ default: m.EmptyRoomFinderPage })));
const SocietyTrackerPage = lazyWithRetry(() => import('./components/SocietyTrackerPage'));
const CaseCompsPage = lazyWithRetry(() => import('./components/CaseCompsPage'));


const PageLoader = () => (
  <div className="loading-screen" style={{ minHeight: '300px' }}>
    <div className="loading-logo-container">
      <img src="/sscbs_logo.png" alt="SSCBS OS" className="loading-logo" />
      <span className="system-spinner"></span>
    </div>
    <p className="loading-text">Loading...</p>
  </div>
);

import { useIsMobile } from './hooks/useIsMobile';
import { MOBILE_V2 } from './lib/uiFlags';
import { useTheme } from './context/ThemeContext';
import TimetablePage from './components/TimetablePage';

const TOOL_VIEWS = ['find-prof', 'waiver', 'admin', 'team-finder', 'empty-room', 'faculty-db', 'society-tracker', 'case-comps'];
const VALID_VIEWS = ['home', 'timetable', 'find-prof', 'waiver', 'tools', 'buzz', 'profile', 'admin', 'contact', 'team-finder', 'empty-room', 'faculty-db', 'society-tracker', 'case-comps', 'notifications', 'pyqs'];


const getInitialView = () => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (hash && VALID_VIEWS.includes(hash)) {
      return hash;
    }
    const saved = localStorage.getItem('sscbs_active_view');
    if (saved && VALID_VIEWS.includes(saved)) {
      return saved;
    }
  }
  return 'home';
};

function App() {
  const { user, loading, isPasswordRecovery } = useAuth();
  const { featureFlags } = useConfig();
  const isMobile = useIsMobile();
  const { theme, setPreference } = useTheme();
  useNotificationEngine();

  useEffect(() => {
    initPostHog();
  }, []);

  const [view, setViewState] = useState(getInitialView);
  const [returnView, setReturnView] = useState('home');
  const [isGpaOpen, setIsGpaOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [teamFinderPrefill, setTeamFinderPrefill] = useState(null);
  const [facultyDbPrefillProfId, setFacultyDbPrefillProfId] = useState(null);

  const setView = (newView) => {
    if (VALID_VIEWS.includes(newView)) {
      setViewState(newView);
      setIsMobileSidebarOpen(false);
      if (typeof window !== 'undefined') {
        window.location.hash = newView === 'home' ? '' : newView;
        localStorage.setItem('sscbs_active_view', newView);
      }
    }
  };

  // Sync state with browser hash navigation (back/forward & initial load)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (hash && VALID_VIEWS.includes(hash)) {
        setViewState(hash);
        localStorage.setItem('sscbs_active_view', hash);
      } else {
        setViewState('home');
        localStorage.setItem('sscbs_active_view', 'home');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Escape key handler to close mobile sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll when mobile navigation drawer is open
  useEffect(() => {
    if (isMobileSidebarOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isMobileSidebarOpen]);

  // Ensure current view is recorded in URL hash & localStorage on mount
  useEffect(() => {
    if (!isPasswordRecovery && view && view !== 'home' && typeof window !== 'undefined') {
      window.location.hash = view;
      localStorage.setItem('sscbs_active_view', view);
    }
  }, [isPasswordRecovery]);

  // Check if profile setup is required (missing name, course/class, or section)
  const hasCompletedProfile = Boolean(
    user?.user_metadata?.profile_completed ||
    (user?.user_metadata?.full_name && user?.user_metadata?.course && user?.user_metadata?.section)
  );
  const needsProfileSetup = Boolean(user && !hasCompletedProfile);

  // 🟢 Real-Time Presence & Feature Usage Logger across SSCBS OS
  useEffect(() => {
    const activeViewName = isGpaOpen ? 'gpa' : view;
    // Log view unconditionally so PostHog tracks every visitor & view
    logFeatureView(activeViewName, user);

    if (user && user.email) {
      const unsubscribe = subscribeToPresence(user, activeViewName);
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [user, view, isGpaOpen]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo-container">
          <img src="/sscbs_logo.png" alt="SSCBS OS" className="loading-logo" />
          <span className="system-spinner"></span>
        </div>
        <p className="loading-text">Loading SSCBS Campus OS…</p>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return <Auth forceMode="update_password" />;
  }

  if (!user) {
    return <Auth />;
  }

  const displayName = user.user_metadata?.full_name || user.email.split('@')[0];
  const isAdmin = isAdminEmail(user.email);
  const hasTeamFinderAccess = featureFlags['team-finder'] || canAccessTeamFinder(user.email);
  const hasEmptyRoomAccess = featureFlags['empty-room'] || canAccessEmptyRoom(user.email);
  const hasFacultyDbAccess = canAccessFacultyDatabase(user.email);
  const hasSocietyTrackerAccess = canAccessSocietyTracker(user.email);
  const hasCaseCompsAccess = canAccessCaseComps(user.email);

  const openTool = (id, extra = null) => {
    setIsMobileSidebarOpen(false);
    trackNavigationEvent('tool_opened', id, { source_view: view, has_extra: Boolean(extra) });
    logFeatureView(id, user);
    if (id === 'gpa') {
      trackGpaEvent('open');
      setIsGpaOpen(true);
      return;
    }
    if (id === 'team-finder' && extra) {
      setTeamFinderPrefill(extra);
    }
    if (id === 'faculty-db' && extra) {
      setFacultyDbPrefillProfId(extra.profId || extra);
    }
    setReturnView(TOOL_VIEWS.includes(view) ? 'home' : view);
    setView(id);
  };

  const goBack = () => setView(returnView);

  // Waiver Tool ships its own full-page layout
  if (view === 'waiver') {
    return (
      <Suspense fallback={<PageLoader />}>
        <WaiverToolPage onBack={goBack} />
      </Suspense>
    );
  }

  // Competitions Portal ships its own dedicated full-page layout (only filter sidebar on the left, no OS sidebar)
  if (view === 'case-comps') {
    return (
      <>
        {hasCaseCompsAccess ? (
          <Suspense fallback={<PageLoader />}>
            <ErrorBoundary>
              <div className="case-comps-standalone-page">
                <CaseCompsPage 
                  onBack={goBack} 
                  onNavigate={openTool} 
                  headerAction={<NotificationCenter onNavigate={openTool} />} 
                />
                <FooterCredit />
              </div>
            </ErrorBoundary>
          </Suspense>
        ) : (
          <div className="app-shell">
            <HomeDashboard onNavigate={openTool} onOpenProfile={() => setView('profile')} />
          </div>
        )}
        <ProfileModal isOpen={needsProfileSetup} isFirstTimeSetup={needsProfileSetup} />
        <Suspense fallback={null}>
          {isGpaOpen && <GpaCalculatorModal isOpen={isGpaOpen} onClose={() => setIsGpaOpen(false)} />}
        </Suspense>
        <InstallPwaPrompt />
      </>
    );
  }

  const navSections = [
    {
      title: 'Main Navigation',
      items: [
        { id: 'home', label: 'Home', Icon: HomeIcon },
        ...(hasCaseCompsAccess ? [{ id: 'case-comps', label: 'Competitions', Icon: FlameIcon, featured: true }] : []),
        { id: 'buzz', label: 'Campus Buzz', Icon: MegaphoneIcon, locked: !featureFlags['buzz'] && !isAdmin },
      ],
    },
    {
      title: 'Academic & Tools',
      items: [
        { id: 'find-prof', label: 'Find My Professor', Icon: SearchIcon, locked: !featureFlags['find-prof'] && !isAdmin },
        { id: 'empty-room', label: 'Classroom Radar', Icon: DoorIcon },
        ...(hasTeamFinderAccess ? [{ id: 'team-finder', label: 'Team Finder', Icon: TrophyIcon }] : []),
        { id: 'waiver', label: 'Waiver Tool', Icon: PercentIcon, locked: !featureFlags['waiver'] && !isAdmin },
        { id: 'gpa', label: 'GPA Calculator', Icon: CalculatorIcon, locked: !featureFlags['gpa'] && !isAdmin },
        { id: 'pyqs', label: 'PYQs & Resources', Icon: FileIcon, locked: !featureFlags['pyqs'] && !isAdmin },
      ],
    },
    {
      title: 'Miscellaneous & Support',
      items: [
        ...(hasSocietyTrackerAccess ? [{ id: 'society-tracker', label: 'Societies Database', Icon: UsersIcon }] : []),
        ...(hasFacultyDbAccess ? [{ id: 'faculty-db', label: 'Faculty Directory', Icon: UserIcon }] : []),
        { id: 'contact', label: 'Contact Us', Icon: MessageIcon, locked: !featureFlags['contact'] && !isAdmin },
      ],
    },
    ...(isAdmin ? [{
      title: 'Administration',
      items: [
        { id: 'admin', label: 'Admin Console', Icon: ShieldIcon },
      ],
    }] : []),
  ];

  const mobileNavSections = [
    {
      title: 'MAIN',
      items: [
        { id: 'home', label: 'Home', Icon: HomeIcon },
        { id: 'timetable', label: 'Timetable', Icon: CalendarIcon },
        { id: 'buzz', label: 'Campus Buzz', Icon: MegaphoneIcon, locked: !featureFlags['buzz'] && !isAdmin, badge: '3' },
      ],
    },
    {
      title: 'ACADEMIC & TOOLS',
      items: [
        { id: 'find-prof', label: 'Find My Professor', Icon: SearchIcon, locked: !featureFlags['find-prof'] && !isAdmin },
        { id: 'empty-room', label: 'Classroom Radar', Icon: DoorIcon, liveTag: true },
        { id: 'gpa', label: 'GPA Calculator', Icon: CalculatorIcon, locked: !featureFlags['gpa'] && !isAdmin },
        { id: 'waiver', label: 'Waiver Tool', Icon: PercentIcon, locked: !featureFlags['waiver'] && !isAdmin },
        { id: 'pyqs', label: 'PYQs & Resources', Icon: FileIcon, locked: !featureFlags['pyqs'] && !isAdmin, soonTag: true },
      ],
    },
    {
      title: 'COMMUNITY',
      items: [
        ...(hasCaseCompsAccess ? [{ id: 'case-comps', label: 'Competitions', Icon: FlameIcon, liveTag: true }] : []),
        ...(hasTeamFinderAccess ? [{ id: 'team-finder', label: 'Team Finder', Icon: TrophyIcon }] : []),
        ...(hasSocietyTrackerAccess ? [{ id: 'society-tracker', label: 'Societies Database', Icon: UsersIcon }] : []),
        ...(hasFacultyDbAccess ? [{ id: 'faculty-db', label: 'Faculty Directory', Icon: UserIcon }] : []),
      ],
    },
    ...(isAdmin ? [{
      title: 'ADMINISTRATION',
      items: [
        { id: 'admin', label: 'Admin Console', Icon: ShieldIcon },
      ],
    }] : []),
  ];

  const activeTab = TOOL_VIEWS.includes(view) || view === 'tools' ? 'tools' : view === 'buzz' ? 'home' : view;

  const pageTitle = {
    tools: 'Tools',
    timetable: 'Timetable',
    'society-tracker': 'Societies Database',
    'case-comps': 'Competitions',
    'find-prof': 'Find My Professor',
    'faculty-db': 'Faculty Directory',
    'team-finder': 'Team Finder',
    'empty-room': 'Classroom Radar',
    admin: 'Admin Console',
    buzz: 'Campus Buzz',
    profile: 'Profile',
    contact: 'Contact Us',
    pyqs: 'PYQs & Resources',
  }[view];

  const renderView = () => {
    switch (view) {
      case 'timetable':
        return (
          <TimetablePage
            onNavigate={openTool}
            onOpenDrawer={() => setIsMobileSidebarOpen(true)}
          />
        );
      case 'pyqs':
        return (
          <div className="pyqs-page-container">
            <div className="pyqs-card">
              <span className="pyqs-icon">
                <FileIcon size={32} />
              </span>
              <span className="m-chip" style={{ fontSize: '10px', height: '28px', pointerEvents: 'none' }}>COMING SOON</span>
              <h2>Past papers, syllabus and notes</h2>
              <p>Organised by course and semester. We'll tell you on Campus Buzz when it opens.</p>
              <button className="m-chip active" style={{ height: '44px', padding: '0 20px', cursor: 'pointer', marginTop: '12px' }} onClick={() => setView('home')}>
                Back to Home
              </button>
            </div>
          </div>
        );
      case 'society-tracker':
        return hasSocietyTrackerAccess ? (
          <Suspense fallback={<PageLoader />}>
            <SocietyTrackerPage 
              onBack={goBack} 
              onNavigate={openTool} 
              headerAction={<NotificationCenter onNavigate={openTool} />} 
            />
          </Suspense>
        ) : <HomeDashboard onNavigate={openTool} onOpenProfile={() => setView('profile')} />;

      case 'case-comps':
        return hasCaseCompsAccess ? (
          <Suspense fallback={<PageLoader />}>
            <ErrorBoundary>
              <CaseCompsPage 
                onBack={goBack} 
                onNavigate={openTool} 
                headerAction={<NotificationCenter onNavigate={openTool} />} 
              />
            </ErrorBoundary>
          </Suspense>
        ) : <HomeDashboard onNavigate={openTool} onOpenProfile={() => setView('profile')} />;

      case 'find-prof':
        return (
          <Suspense fallback={<PageLoader />}>
            <FindMyProfessorPage onBack={goBack} />
          </Suspense>
        );
      case 'faculty-db':
        return canAccessFacultyDatabase(user?.email) ? (
          <Suspense fallback={<PageLoader />}>
            <FacultyDatabasePage 
              onBack={goBack} 
              initialProfId={facultyDbPrefillProfId}
              onClearPrefill={() => setFacultyDbPrefillProfId(null)}
              headerAction={<NotificationCenter onNavigate={openTool} />} 
            />
          </Suspense>
        ) : <HomeDashboard onNavigate={openTool} onOpenProfile={() => setView('profile')} />;
      case 'team-finder':
        return (
          <Suspense fallback={<PageLoader />}>
            <TeamFinderPage 
              onBack={goBack} 
              initialPrefill={teamFinderPrefill}
              onClearPrefill={() => setTeamFinderPrefill(null)}
              headerAction={<NotificationCenter onNavigate={openTool} />} 
            />
          </Suspense>
        );
      case 'empty-room':
        return (
          <Suspense fallback={<PageLoader />}>
            <EmptyRoomFinderPage 
              onBack={goBack} 
              headerAction={<NotificationCenter onNavigate={openTool} />} 
            />
          </Suspense>
        );
      case 'contact':
        return (
          <Suspense fallback={<PageLoader />}>
            <ContactPage 
              onBack={goBack} 
              headerAction={<NotificationCenter onNavigate={openTool} />} 
            />
          </Suspense>
        );
      case 'admin':
        return isAdmin ? (
          <Suspense fallback={<PageLoader />}>
            <AdminConsolePage onBack={goBack} />
          </Suspense>
        ) : <HomeDashboard onNavigate={openTool} onOpenProfile={() => setView('profile')} />;
      case 'buzz':
        return (
          <div className="buzz-page">
            <NoticeBoard />
          </div>
        );
      case 'profile':
        return <ProfilePage onNavigate={openTool} />;
      case 'tools':
        return (
          <div className="tools-hub">
            {[
              ...(hasSocietyTrackerAccess ? [{ id: 'society-tracker', micro: 'DATABASE', microClass: 'success', title: 'Societies Database', desc: 'Directory of 62+ societies, domains & PoR contacts', Icon: UsersIcon, locked: false }] : []),
              ...(hasCaseCompsAccess ? [{ id: 'case-comps', micro: 'LIVE', microClass: 'success', title: 'Competitions', desc: 'Live opportunities from Unstop for SSCBS students across all circuits', Icon: FlameIcon, locked: false }] : []),
              ...(hasTeamFinderAccess ? [{ id: 'team-finder', micro: 'NEW', microClass: 'success', title: 'Team Finder & Compete Hub', desc: 'Find teammates & post case comp openings', Icon: TrophyIcon, locked: false }] : []),

              { id: 'pyqs', micro: 'SOON', microClass: 'dim', title: 'PYQs & Resources', desc: 'Papers, syllabus, notes', Icon: FileIcon, locked: !featureFlags['pyqs'] && !isAdmin },
              { id: 'waiver', micro: 'SOON', microClass: 'dim', title: 'Waiver Tool', desc: 'Clear attendance smartly', Icon: PercentIcon, locked: !featureFlags['waiver'] && !isAdmin },
              { id: 'gpa', micro: 'DU', microClass: 'maroon', title: 'GPA Calculator', desc: 'SGPA & CGPA, official schemas', Icon: CalculatorIcon, locked: !featureFlags['gpa'] && !isAdmin },
              { id: 'find-prof', micro: 'SEARCH', microClass: 'success', title: 'Find My Professor', desc: "Who's teaching where, right now", Icon: SearchIcon, locked: !featureFlags['find-prof'] && !isAdmin },

              { id: 'empty-room', micro: 'LIVE', microClass: 'success', title: 'Classroom Radar', desc: 'Live room occupancy, daily schedules & vacant room finder', Icon: DoorIcon, locked: false },
            ].map(({ id, title, desc, Icon, locked }) => (
              <button
                key={id}
                className={`tools-hub-row ${locked ? 'locked' : ''}`}
                onClick={() => !locked && openTool(id)}
                disabled={locked}
              >
                <span className="tools-hub-icon"><Icon size={20} /></span>
                <span className="tools-hub-text">
                  <span className="tools-hub-title">{title}</span>
                  <span className="tools-hub-desc">{desc}</span>
                </span>
              </button>
            ))}
          </div>
        );
      default:
        return <HomeDashboard onNavigate={openTool} onOpenProfile={() => setView('profile')} />;
    }
  };


  return (
    <>
      <div className="app-shell">
        {/* ── Desktop sidebar ── */}
        <aside className="app-sidebar">
          <div className="sidebar-brand" onClick={() => { trackNavigationEvent('sidebar_brand', 'home'); setView('home'); setIsMobileSidebarOpen(false); }}>
            <img src="/sscbs_logo.png" alt="" width="30" height="30" />
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">SSCBS OS</span>
              <span className="sidebar-brand-sub">CAMPUS WORKSPACE</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navSections.map((section, idx) => (
              <div key={idx} className="sidebar-section">
                <span className="sidebar-section-title">{section.title}</span>
                {section.items.map(({ id, label, Icon, locked, featured }) => (
                  <button
                    key={id}
                    className={`sidebar-item ${view === id ? 'active' : ''} ${locked ? 'locked' : ''} ${featured ? 'featured-nav-item' : ''}`}
                    onClick={() => !locked && openTool(id)}
                    disabled={locked}
                  >
                    <Icon filled={view === id} />
                    <span>{label}</span>
                    {featured && <span className="sidebar-featured-badge">LIVE</span>}
                    {locked && <span className="sidebar-soon">SOON</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <button
            className={`sidebar-user ${view === 'profile' ? 'active' : ''}`}
            onClick={() => { trackNavigationEvent('sidebar_user_profile', 'profile'); setView('profile'); }}
          >
            <span className="sidebar-avatar">{displayName.charAt(0).toUpperCase()}</span>
            <span className="sidebar-user-text">
              <span className="sidebar-user-name">{displayName}</span>
              <span className="sidebar-user-email">{user.email}</span>
            </span>
          </button>
        </aside>

        {/* ── Mobile sidebar drawer backdrop ── */}
        <div
          className={`mobile-sidebar-backdrop ${isMobileSidebarOpen ? 'show' : ''}`}
          onClick={() => setIsMobileSidebarOpen(false)}
        />

        {/* ── Mobile slide-out sidebar drawer (Screen 04) ── */}
        <aside className={`app-sidebar-mobile ${isMobileSidebarOpen ? 'open' : ''}`}>
          <div className="mobile-sidebar-header">
            <div className="sidebar-brand" onClick={() => { trackNavigationEvent('mobile_brand', 'home'); setView('home'); setIsMobileSidebarOpen(false); }}>
              <img src="/sscbs_logo.png" alt="" width="26" height="26" style={{ borderRadius: '6px' }} />
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-name">SSCBS OS</span>
                <span className="sidebar-brand-sub">CAMPUS WORKSPACE</span>
              </div>
            </div>
            <button
              className="mobile-sidebar-close"
              onClick={() => { trackNavigationEvent('mobile_drawer_close', view); setIsMobileSidebarOpen(false); }}
              aria-label="Close Navigation"
            >
              <CloseIcon size={20} />
            </button>
          </div>

          {/* Profile Card right below header (Screen 04) */}
          <div
            className="mobile-drawer-profile-card"
            onClick={() => { trackNavigationEvent('mobile_drawer_profile', 'profile'); setView('profile'); setIsMobileSidebarOpen(false); }}
          >
            <span className="mobile-drawer-avatar">{displayName.charAt(0).toUpperCase()}</span>
            <div className="mobile-drawer-user-info">
              <span className="mobile-drawer-name">{displayName}</span>
              <span className="mobile-drawer-sub">
                {user?.user_metadata?.course || 'Student'} · Sem {user?.user_metadata?.semester || '1'} · Section {user?.user_metadata?.section || 'A'}
              </span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </div>

          <nav className="mobile-sidebar-nav">
            {mobileNavSections.map((section, idx) => (
              <div key={idx} className="mobile-sidebar-section">
                <div className="mobile-section-header">{section.title}</div>
                {section.items.map(({ id, label, Icon, locked, liveTag, soonTag, badge }) => (
                  <button
                    key={id}
                    className={`mobile-sidebar-item ${view === id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                    onClick={() => {
                      if (!locked) {
                        setIsMobileSidebarOpen(false);
                        openTool(id);
                      }
                    }}
                    disabled={locked}
                  >
                    <div className="mobile-item-left">
                      <Icon filled={view === id} size={19} />
                      <span>{label}</span>
                    </div>
                    {badge && <span className="mobile-item-badge">{badge}</span>}
                    {liveTag && <span className="mobile-item-live">● LIVE</span>}
                    {soonTag && <span className="mobile-item-soon">SOON</span>}
                    {locked && !soonTag && <span className="mobile-item-soon">SOON</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Drawer Footer with Contact Us & Theme Toggle (Screen 04) */}
          <div className="mobile-drawer-footer">
            <button
              className="mobile-drawer-contact-btn"
              onClick={() => { setIsMobileSidebarOpen(false); setView('contact'); }}
            >
              <MessageIcon size={18} />
              <span>Contact us</span>
            </button>
            <div className="mobile-drawer-theme-toggle">
              <button
                className={`mobile-drawer-theme-pill ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setPreference('light')}
              >
                Light
              </button>
              <button
                className={`mobile-drawer-theme-pill ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setPreference('dark')}
              >
                Dark
              </button>
            </div>
          </div>
        </aside>

        {/* ── Mobile top bar (56px) ── */}
        <header className="app-topbar">
          <button
            className="topbar-menu-btn"
            onClick={() => {
              const nextState = !isMobileSidebarOpen;
              trackNavigationEvent(nextState ? 'mobile_drawer_open' : 'mobile_drawer_close', view);
              setIsMobileSidebarOpen(nextState);
            }}
            aria-label="Toggle Menu"
          >
            <MenuIcon size={22} />
          </button>
          
          <div className="topbar-title-group" onClick={() => { trackNavigationEvent('topbar_brand', 'home'); setView('home'); }}>
            {view === 'home' && <img src="/sscbs_logo.png" alt="" width="26" height="26" style={{ borderRadius: '6px' }} />}
            <span className="topbar-title">{view === 'home' ? 'SSCBS OS' : (pageTitle || 'SSCBS OS')}</span>
          </div>

          <div className="topbar-right-action">
            {view === 'profile' ? (
              <span className="topbar-saved-badge">✓ Saved</span>
            ) : view === 'timetable' ? (
              <div style={{ width: '44px' }} />
            ) : (
              <NotificationCenter onNavigate={openTool} />
            )}
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="app-main">
          {view !== 'home' && 
           view !== 'case-comps' && 
           view !== 'empty-room' && 
           view !== 'team-finder' && 
           view !== 'society-tracker' && 
           view !== 'faculty-db' && 
           view !== 'contact' && (
            <div className="page-heading-desktop">
              <h1 style={{ margin: 0 }}>{pageTitle || 'SSCBS OS'}</h1>
              <NotificationCenter onNavigate={openTool} />
            </div>
          )}
          {renderView()}
          <FooterCredit />
        </main>
      </div>

      <ProfileModal isOpen={needsProfileSetup} isFirstTimeSetup={needsProfileSetup} />
      <Suspense fallback={null}>
        {isGpaOpen && <GpaCalculatorModal isOpen={isGpaOpen} onClose={() => setIsGpaOpen(false)} />}
      </Suspense>
      <InstallPwaPrompt />
    </>
  );
}

export default App;
