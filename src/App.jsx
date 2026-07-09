import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Auth from './components/Auth';
import ProfileModal from './components/ProfileModal';
import ClassSchedulesCard from './components/ClassSchedulesCard';
import './App.css';
import { Analytics } from '@vercel/analytics/react';

function App() {
  const { user, signOut, loading, isConfigured } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
  const userCourse = user.user_metadata?.course;
  const userSemester = user.user_metadata?.semester;
  const userSection = user.user_metadata?.section;

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
            <img className="header-logo-img" src="/sscbs_logo.png" alt="SSCBS Crest" width="32" height="32" />
            <span className="workspace-title">
              SSCBS <span className="title-highlight">Campus OS</span>
              <span className="version-badge">v1.0.0</span>
            </span>
          </div>
          <div className="header-right">
            <div 
              className="user-profile" 
              onClick={() => setIsProfileOpen(true)} 
              title="Edit Profile"
              style={{ cursor: 'pointer' }}
            >
              <div className="avatar">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">{displayName}</span>
                <div className="user-role-badge-row">
                  <span className="user-role">{userEmail}</span>
                  {userCourse && (
                    <span className="user-class-badge-small">
                      {userCourse} {userSemester}{userSection}
                    </span>
                  )}
                </div>
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

          {/* Core Feature: Timetable Schedule Tracker */}
          <ClassSchedulesCard onOpenProfile={() => setIsProfileOpen(true)} />

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

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />

      <Analytics />
    </>
  );
}

export default App;


