import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Auth from './components/Auth';
import ProfileModal from './components/ProfileModal';
import ClassSchedulesCard from './components/ClassSchedulesCard';
import FindMyProfessor from './components/FindMyProfessor';
import './App.css';
import { Analytics } from '@vercel/analytics/react';

function App() {
  const { user, loading } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfTrackerOpen, setIsProfTrackerOpen] = useState(false);

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

  return (
    <>
      <div className="workspace-container">
        {/* Top Header Navigation */}
        <header className="workspace-header">
          <div className="header-left">
            <img className="header-logo-img" src="/sscbs_logo.png" alt="SSCBS Crest" width="32" height="32" />
            <span className="workspace-title">
              SSCBS <span className="title-highlight">Campus OS</span>
            </span>
          </div>
          <div className="header-right">
            <div 
              className="user-profile" 
              onClick={() => setIsProfileOpen(true)} 
              title="Profile Settings"
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
              <svg 
                className="profile-chevron" 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </header>

        {/* Main Workspace Dashboard */}
        <main className="workspace-main">

          {/* Core Feature: Timetable Schedule Tracker */}
          <ClassSchedulesCard onOpenProfile={() => setIsProfileOpen(true)} />

          {/* Student Tools Grid */}
          <section className="dashboard-grid">
            
            {/* Active Feature: Find My Professor */}
            <div className="dashboard-card active-card" onClick={() => setIsProfTrackerOpen(true)}>
              <div className="card-header">
                <h3>Find My Professor</h3>
                <span className="badge-active">Track Live</span>
              </div>
              <p>Locate where any faculty member is teaching right now. View their current room, daily timeline, and full weekly schedule.</p>
              <div className="card-footer">
                <span className="btn-card-action">Launch Tracker →</span>
              </div>
            </div>

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

      {/* Find My Professor Modal */}
      <FindMyProfessor
        isOpen={isProfTrackerOpen}
        onClose={() => setIsProfTrackerOpen(false)}
      />

      <Analytics />
    </>
  );
}

export default App;


