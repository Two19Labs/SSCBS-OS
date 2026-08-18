import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { useConfig } from './context/ConfigContext';
import { logFeatureView, logFeatureClick, subscribeToPresence, FEATURE_NAMES } from './lib/analytics';
import Auth from './components/Auth';
import HomeDashboard from './components/HomeDashboard';
import ProfilePage from './components/ProfilePage';
import ProfileModal from './components/ProfileModal';
import NoticeBoard from './components/NoticeBoard';
import { isAdminEmail, canAccessTeamFinder, canAccessEmptyRoom, canAccessFacultyDatabase, canAccessSocietyTracker } from './lib/admin';
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
  HeartIcon,
  UsersIcon,
  MenuIcon,
  CloseIcon,
} from './components/icons';
import './App.css';
import InstallPwaPrompt from './components/InstallPwaPrompt';
import FooterCredit from './components/FooterCredit';
import { Analytics } from '@vercel/analytics/react';
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


const PageLoader = () => (
  <div className="loading-screen" style={{ minHeight: '300px' }}>
    <div className="loading-logo-container">
      <img src="/sscbs_logo.png" alt="SSCBS OS" className="loading-logo" />
      <span className="system-spinner"></span>
    </div>
    <p className="loading-text">Loading...</p>
  </div>
);

const TOOL_VIEWS = ['find-prof', 'waiver', 'admin', 'team-finder', 'empty-room', 'faculty-db', 'society-tracker'];
const VALID_VIEWS = ['home', 'find-prof', 'waiver', 'tools', 'buzz', 'profile', 'admin', 'contact', 'team-finder', 'empty-room', 'faculty-db', 'society-tracker'];


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
  useNotificationEngine();
  const [view, setViewState] = useState(getInitialView);
  const [returnView, setReturnView] = useState('home');
  const [isGpaOpen, setIsGpaOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
    if (user && user.email) {
      const activeViewName = isGpaOpen ? 'gpa' : view;
      logFeatureView(activeViewName, user);
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

  const openTool = (id) => {
    setIsMobileSidebarOpen(false);
    logFeatureView(id, user);
    if (id === 'gpa') {
      setIsGpaOpen(true);
      return;
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

  const navSections = [
    {
      title: 'Main Navigation',
      items: [
        { id: 'home', label: 'Home', Icon: HomeIcon },
        ...(hasSocietyTrackerAccess ? [{ id: 'society-tracker', label: 'Recruitment Tracker', Icon: UsersIcon, featured: true }] : []),
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

  const activeTab = TOOL_VIEWS.includes(view) || view === 'tools' ? 'tools' : view === 'buzz' ? 'home' : view;

  const pageTitle = {
    tools: 'Tools',
    'society-tracker': 'Society Recruitment Tracker',
    'find-prof': 'Find My Professor',
    'faculty-db': 'Faculty Directory',
    'team-finder': 'Team Finder & Compete Hub',
    'empty-room': 'Classroom Radar',
    admin: 'Admin Console',
    buzz: 'Campus Buzz',
    profile: 'Profile',
    contact: 'Contact Us',
  }[view];

  const renderView = () => {
    switch (view) {
      case 'society-tracker':
        return hasSocietyTrackerAccess ? (
          <Suspense fallback={<PageLoader />}>
            <SocietyTrackerPage onBack={goBack} />
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
            <FacultyDatabasePage onBack={goBack} />
          </Suspense>
        ) : <HomeDashboard onNavigate={openTool} onOpenProfile={() => setView('profile')} />;
      case 'team-finder':
        return (
          <Suspense fallback={<PageLoader />}>
            <TeamFinderPage onBack={goBack} />
          </Suspense>
        );
      case 'empty-room':
        return (
          <Suspense fallback={<PageLoader />}>
            <EmptyRoomFinderPage onBack={goBack} />
          </Suspense>
        );
      case 'contact':
        return (
          <Suspense fallback={<PageLoader />}>
            <ContactPage onBack={goBack} />
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
              ...(hasSocietyTrackerAccess ? [{ id: 'society-tracker', micro: 'LIVE', microClass: 'success', title: 'Society Recruitment Tracker', desc: 'Keep track of info & form deadlines for societies', Icon: UsersIcon, locked: false }] : []),
              ...(hasTeamFinderAccess ? [{ id: 'team-finder', micro: 'NEW', microClass: 'success', title: 'Team Finder & Compete Hub', desc: 'Find teammates & post case comp openings', Icon: TrophyIcon, locked: false }] : []),

              { id: 'pyqs', micro: 'SOON', microClass: 'dim', title: 'PYQs & Resources', desc: 'Papers, syllabus, notes', Icon: FileIcon, locked: !featureFlags['pyqs'] && !isAdmin },
              { id: 'waiver', micro: 'SOON', microClass: 'dim', title: 'Waiver Tool', desc: 'Clear attendance smartly', Icon: PercentIcon, locked: !featureFlags['waiver'] && !isAdmin },
              { id: 'gpa', micro: 'DU', microClass: 'maroon', title: 'GPA Calculator', desc: 'SGPA & CGPA, official schemas', Icon: CalculatorIcon, locked: !featureFlags['gpa'] && !isAdmin },
              { id: 'confessions-matchmaker', micro: 'SOON', microClass: 'dim', title: 'Campus Confessions & Matchmaker', desc: "We're still thinking on this, DM to let us know you'd like this :)", Icon: HeartIcon, locked: true },
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
          <div className="sidebar-brand" onClick={() => { setView('home'); setIsMobileSidebarOpen(false); }}>
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
            onClick={() => setView('profile')}
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

        {/* ── Mobile slide-out sidebar drawer ── */}
        <aside className={`app-sidebar-mobile ${isMobileSidebarOpen ? 'open' : ''}`}>
          <div className="mobile-sidebar-header">
            <div className="sidebar-brand" onClick={() => { setView('home'); setIsMobileSidebarOpen(false); }}>
              <img src="/sscbs_logo.png" alt="" width="28" height="28" />
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-name">SSCBS OS</span>
                <span className="sidebar-brand-sub">CAMPUS WORKSPACE</span>
              </div>
            </div>
            <button
              className="mobile-sidebar-close"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close Navigation"
            >
              <CloseIcon size={20} />
            </button>
          </div>

          <nav className="mobile-sidebar-nav">
            {navSections.map((section, idx) => (
              <div key={idx} className="mobile-sidebar-section">
                <div className="mobile-section-header">{section.title}</div>
                {section.items.map(({ id, label, Icon, locked, featured }) => (
                  <button
                    key={id}
                    className={`mobile-sidebar-item ${view === id ? 'active' : ''} ${locked ? 'locked' : ''} ${featured ? 'featured-nav-item' : ''}`}
                    onClick={() => {
                      if (!locked) {
                        setIsMobileSidebarOpen(false);
                        openTool(id);
                      }
                    }}
                    disabled={locked}
                  >
                    <div className="mobile-item-left">
                      <Icon filled={view === id} size={18} />
                      <span>{label}</span>
                    </div>
                    {featured && <span className="sidebar-featured-badge">LIVE</span>}
                    {locked && <span className="sidebar-soon">SOON</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div
            className={`mobile-sidebar-user-card ${view === 'profile' ? 'active' : ''}`}
            onClick={() => { setView('profile'); setIsMobileSidebarOpen(false); }}
          >
            <span className="sidebar-avatar">{displayName.charAt(0).toUpperCase()}</span>
            <div className="mobile-user-details">
              <span className="mobile-user-name">{displayName}</span>
              <span className="mobile-user-email">{user.email}</span>
            </div>
            <span className="mobile-profile-tag">Profile</span>
          </div>
        </aside>

        {/* ── Mobile top bar ── */}
        <header className="app-topbar">
          <button
            className="topbar-menu-btn"
            onClick={() => setIsMobileSidebarOpen(prev => !prev)}
            aria-label="Toggle Menu"
          >
            <MenuIcon size={22} />
          </button>
          
          <div className="topbar-title-group" onClick={() => setView('home')}>
            <img src="/sscbs_logo.png" alt="" width="24" height="24" />
            <span className="topbar-title">{pageTitle || 'SSCBS OS'}</span>
          </div>

          <NotificationCenter onNavigate={openTool} />
        </header>

        {/* ── Main content ── */}
        <main className="app-main">
          {view !== 'home' && (
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
      <Analytics beforeSend={(event) => {
        try {
          if (event && event.url) {
            const urlObj = new URL(event.url);
            let rawRoute = urlObj.hash ? urlObj.hash.replace(/^#\/?/, '').trim() : '';
            if (!rawRoute && typeof window !== 'undefined' && window.location.hash) {
              rawRoute = window.location.hash.replace(/^#\/?/, '').trim();
            }
            if (rawRoute) {
              const route = (rawRoute === 'home') ? '' : rawRoute;
              urlObj.pathname = route ? `/${route}` : '/';
              urlObj.hash = '';
              event.url = urlObj.toString();
              return event;
            }
          }
        } catch (e) {
          // Ignore URL parse errors
        }
        return event;
      }} />
    </>
  );
}

export default App;
