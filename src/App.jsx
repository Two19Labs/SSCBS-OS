import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { logFeatureView, subscribeToPresence } from './lib/analytics';
import Auth from './components/Auth';
import HomeDashboard from './components/HomeDashboard';
import ProfilePage from './components/ProfilePage';
import ClassSchedulesCard from './components/ClassSchedulesCard';
import FindMyProfessorPage from './components/FindMyProfessorPage';
import GpaCalculatorModal from './components/GpaCalculatorModal';
import WaiverToolPage from './components/WaiverToolPage';
import AdminConsolePage from './components/AdminConsolePage';
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

const TOOL_VIEWS = ['find-prof', 'waiver', 'admin'];

function App() {
  const { user, loading } = useAuth();
  const [view, setView] = useState('home');
  const [returnView, setReturnView] = useState('home');
  const [isGpaOpen, setIsGpaOpen] = useState(false);

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
    return <WaiverToolPage onBack={goBack} />;
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
        return <FindMyProfessorPage onBack={goBack} />;
      case 'admin':
        return isAdmin ? <AdminConsolePage onBack={goBack} /> : <HomeDashboard onNavigate={openTool} onOpenProfile={() => setView('profile')} />;
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

      <GpaCalculatorModal isOpen={isGpaOpen} onClose={() => setIsGpaOpen(false)} />
      <InstallPwaPrompt />
      <Analytics />
    </>
  );
}

export default App;
