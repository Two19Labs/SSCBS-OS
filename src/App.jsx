import React from 'react';
import { useAuth } from './context/AuthContext';
import Auth from './components/Auth';
import './App.css';
import { Analytics } from '@vercel/analytics/react';

function App() {
  const { user, signOut, loading, isConfigured } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader-container">
          <span className="system-spinner"></span>
          <p className="loading-text">Loading SSCBS Campus Workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  // Extract user info
  const displayName = user.user_metadata?.full_name || user.email.split('@')[0];
  const userEmail = user.email;

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  return (
    <>
      <div className="workspace-container">
        {/* Top Header Navigation */}
        <header className="workspace-header">
          <div className="header-left">
            <svg className="header-logo" viewBox="0 0 100 100" width="32" height="32">
              <path d="M50 5 L85 20 V55 C85 75 50 95 50 95 C50 95 15 75 15 55 V20 Z" fill="none" stroke="#d4af37" strokeWidth="3" />
              <path d="M32 48 C39 48 46 51 50 54 C54 51 61 48 68 48 M32 61 C39 61 46 64 50 67 C54 64 61 61 68 61" fill="none" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" />
              <line x1="50" y1="51" x2="50" y2="70" stroke="#d4af37" strokeWidth="2" />
              <path d="M50 20 C47 26 45 30 45 34 C45 38 47 41 50 41 C53 41 55 38 55 34 C55 30 53 26 50 20 Z" fill="#d4af37" />
            </svg>
            <span className="workspace-title">
              SSCBS <span className="title-highlight">Campus OS</span>
              <span className="version-badge">v1.0.0</span>
            </span>
          </div>
          <div className="header-right">
            <div className="user-profile">
              <div className="avatar">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">{displayName}</span>
                <span className="user-role">{userEmail}</span>
              </div>
            </div>
            <button className="btn-signout" onClick={handleLogout} title="Sign Out">
              Sign Out
            </button>
          </div>
        </header>

        {/* Main Workspace Dashboard */}
        <main className="workspace-main">
          <section className="welcome-banner">
            <div className="banner-content">
              <h2>Welcome, {displayName}</h2>
              <p>SSCBS Student Dashboard is fully active.</p>
            </div>
            <div className="status-indicator">
              <span className={`status-dot ${isConfigured ? 'online' : 'offline'}`}></span>
              {isConfigured ? 'Synced' : 'Sandbox Mode'}
            </div>
          </section>

          {/* Student Tools Grid */}
          <section className="dashboard-grid">
            
            <div className="dashboard-card locked">
              <div className="card-header">
                <h3>Waiver Tool</h3>
              </div>
              <p>Manage, track, and apply for college attendance/marks waivers with automated document generation.</p>
              <div className="card-footer">
                <span className="badge-lock">Coming Soon</span>
              </div>
            </div>

            <div className="dashboard-card locked">
              <div className="card-header">
                <h3>GPA Calculator</h3>
              </div>
              <p>Calculate your SGPA and CGPA dynamically using official Delhi University credit schemas.</p>
              <div className="card-footer">
                <span className="badge-lock">Coming Soon</span>
              </div>
            </div>

            <div className="dashboard-card locked">
              <div className="card-header">
                <h3>Class Schedules</h3>
              </div>
              <p>Access your personalized course timetable, classrooms, sections, and notifications.</p>
              <div className="card-footer">
                <span className="badge-lock">Coming Soon</span>
              </div>
            </div>

            <div className="dashboard-card locked">
              <div className="card-header">
                <h3>PYQs & Resources</h3>
              </div>
              <p>Search and download previous years' examination papers, syllabus, and study notes.</p>
              <div className="card-footer">
                <span className="badge-lock">Coming Soon</span>
              </div>
            </div>

          </section>
        </main>
      </div>
      <Analytics />
    </>
  );
}

export default App;


