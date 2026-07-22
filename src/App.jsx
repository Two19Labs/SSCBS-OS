import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { logFeatureView, subscribeToPresence } from './lib/analytics';
import Auth from './components/Auth';
import HomeDashboard from './components/HomeDashboard';
import ProfilePage from './components/ProfilePage';
import ProfileModal from './components/ProfileModal';
import ClassSchedulesCard from './components/ClassSchedulesCard';
import NoticeBoard from './components/NoticeBoard';
import { isAdminEmail } from './lib/admin';
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
} from './components/icons';
import './App.css';
import InstallPwaPrompt from './components/InstallPwaPrompt';
import FooterCredit from './components/FooterCredit';
import { Analytics } from '@vercel/analytics/react';

// Lazy-loaded heavy page & tool chunks for fast initial app shell booting
const WaiverToolPage = lazy(() => import('./components/WaiverToolPage'));
const FindMyProfessorPage = lazy(() => import('./components/FindMyProfessorPage'));
const AdminConsolePage = lazy(() => import('./components/AdminConsolePage'));
const GpaCalculatorModal = lazy(() => import('./components/GpaCalculatorModal'));

const PageLoader = () => (
  <div className="loading-screen" style={{ minHeight: '300px' }}>
    <span className="system-spinner"></span>
    <p className="loading-text">Loading...</p>
  </div>
);

const TOOL_VIEWS = ['find-prof', 'waiver', 'admin'];
const VALID_VIEWS = ['home', 'timetable', 'find-prof', 'waiver', 'tools', 'buzz', 'profile', 'admin'];

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
  const { user, loading } = useAuth();
  const [view, setViewState] = useState(getInitialView);
  const [returnView, setReturnView] = useState('home');
  const [isGpaOpen, setIsGpaOpen] = useState(false);

  const setView = (newView) => {
    if (VALID_VIEWS.includes(newView)) {
      setViewState(newView);
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
      } else if (!hash) {
        setViewState('home');
        localStorage.setItem('sscbs_active_view', 'home');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Ensure current view is recorded in URL hash & localStorage on mount
  useEffect(() => {
    if (view && view !== 'home' && typeof window !== 'undefined') {
      window.location.hash = view;
      localStorage.setItem('sscbs_active_view', view);
    }
  }, []);

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
        <span className="system-spinner"></span>
        <p className="loading-text">Loading SSCBS Campus OS…</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const displayName = user.user_metadata?.full_name || user.email.split('@')[0];
  const isAdmin = isAdminEmail(user.email);

  const openTool = (id) => {
    if (id === 'gpa') {
      setIsGpaOpen(true);
      return;
    }
    setReturnView(TOOL_VIEWS.includes(view) ? 'home' : view);
    setView(id);
  };

  const goBack = () => setView(returnView);

  // Waiver tool ships its own full-page layout
  if (view === 'waiver') {
    return (
      <Suspense fallback={<PageLoader />}>
        <WaiverToolPage onBack={goBack} />
      </Suspense>
    );
  }

  const navItems = [
    { id: 'home', label: 'Home', Icon: HomeIcon },
    { id: 'timetable', label: 'Timetable', Icon: CalendarIcon },
    { id: 'find-prof', label: 'Find My Professor', Icon: SearchIcon },
    { id: 'waiver', label: 'Waiver Tool', Icon: PercentIcon },
    { id: 'gpa', label: 'GPA Calculator', Icon: CalculatorIcon },
    { id: 'pyqs', label: 'PYQs & Resources', Icon: FileIcon, locked: true },
    { id: 'buzz', label: 'Campus Buzz', Icon: MegaphoneIcon },
  ];

  const tabs = [
    { id: 'home', label: 'Home', Icon: HomeIcon },
    { id: 'timetable', label: 'Timetable', Icon: CalendarIcon },
    { id: 'tools', label: 'Tools', Icon: GridIcon },
    { id: 'profile', label: 'Profile', Icon: UserIcon },
  ];

  const activeTab = TOOL_VIEWS.includes(view) || view === 'tools' ? 'tools' : view === 'buzz' ? 'home' : view;

  const pageTitle = {
    timetable: 'Timetable',
    tools: 'Tools',
    'find-prof': 'Find My Professor',
    admin: 'Admin Console',
    buzz: 'Campus Buzz',
    profile: 'Profile',
  }[view];

  const renderView = () => {
    switch (view) {
      case 'timetable':
        return <ClassSchedulesCard onOpenProfile={() => setView('profile')} />;
      case 'find-prof':
        return (
          <Suspense fallback={<PageLoader />}>
            <FindMyProfessorPage onBack={goBack} />
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
              { id: 'find-prof', micro: 'LIVE', microClass: 'success', title: 'Find My Professor', desc: "Who's teaching where, right now", Icon: SearchIcon },
              { id: 'waiver', micro: '85%', microClass: 'gold', title: 'Waiver Tool', desc: 'Clear attendance smartly', Icon: PercentIcon },
              { id: 'gpa', micro: 'DU', microClass: 'maroon', title: 'GPA Calculator', desc: 'SGPA & CGPA, official schemas', Icon: CalculatorIcon },
              { id: 'pyqs', micro: 'SOON', microClass: 'dim', title: 'PYQs & Resources', desc: 'Papers, syllabus, notes', Icon: FileIcon, locked: true },
            ].map(({ id, micro, microClass, title, desc, Icon, locked }) => (
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
                <span className={`micro-label ${microClass}`}>{micro}</span>
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
          <div className="sidebar-brand" onClick={() => setView('home')}>
            <img src="/sscbs_logo.png" alt="" width="30" height="30" />
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">SSCBS OS</span>
              <span className="sidebar-brand-sub">CAMPUS WORKSPACE</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map(({ id, label, Icon, locked }) => (
              <button
                key={id}
                className={`sidebar-item ${view === id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                onClick={() => !locked && openTool(id)}
                disabled={locked}
              >
                <Icon filled={view === id} />
                <span>{label}</span>
                {locked && <span className="sidebar-soon">SOON</span>}
              </button>
            ))}
            {isAdmin && (
              <button
                className={`sidebar-item ${view === 'admin' ? 'active' : ''}`}
                onClick={() => openTool('admin')}
              >
                <ShieldIcon filled={view === 'admin'} />
                <span>Admin Console</span>
              </button>
            )}
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

        {/* ── Mobile top bar ── */}
        <header className="app-topbar">
          {view !== 'home' && activeTab !== view ? (
            <button className="topbar-back" onClick={goBack} aria-label="Back">
              <BackIcon />
            </button>
          ) : (
            <img src="/sscbs_logo.png" alt="" width="26" height="26" />
          )}
          <span className="topbar-title">{pageTitle || 'SSCBS OS'}</span>
          <button className="topbar-avatar" onClick={() => setView('profile')} aria-label="Profile">
            {displayName.charAt(0).toUpperCase()}
          </button>
        </header>

        {/* ── Main content ── */}
        <main className="app-main">
          {pageTitle && (
            <div className="page-heading-desktop">
              <h1>{pageTitle}</h1>
            </div>
          )}
          {renderView()}
          <FooterCredit />
        </main>

        {/* ── Mobile bottom tabs ── */}
        <nav className="app-tabbar">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`tabbar-item ${activeTab === id ? 'active' : ''}`}
              onClick={() => setView(id)}
            >
              <Icon filled={activeTab === id} size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      <ProfileModal isOpen={needsProfileSetup} isFirstTimeSetup={needsProfileSetup} />
      <Suspense fallback={null}>
        {isGpaOpen && <GpaCalculatorModal isOpen={isGpaOpen} onClose={() => setIsGpaOpen(false)} />}
      </Suspense>
      <InstallPwaPrompt />
      <Analytics />
    </>
  );
}

export default App;
