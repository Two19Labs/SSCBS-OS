import React from 'react';
import { useAuth } from './context/AuthContext';
import Auth from './components/Auth';
import './App.css';

function App() {
  const { user, signOut, loading, isConfigured } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader-container">
          <span className="system-spinner"></span>
          <p className="loading-text">Booting SSCBS OS Workspace...</p>
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
    <div className="workspace-container">
      {/* Top Bar / Navigation */}
      <header className="workspace-header">
        <div className="header-left">
          <span className="terminal-icon">💻</span>
          <span className="workspace-title">SSCBS OS <span className="version-badge">v1.0.0</span></span>
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
            <span className="signout-icon">🚪</span>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Workspace Dashboard */}
      <main className="workspace-main">
        <section className="welcome-banner">
          <div className="banner-content">
            <h2>Welcome back to the kernel, {displayName}!</h2>
            <p>Your session is active and connected to Supabase cloud sync.</p>
          </div>
          <div className="status-indicator">
            <span className={`status-dot ${isConfigured ? 'online' : 'offline'}`}></span>
            {isConfigured ? 'Sync: Connected' : 'Sync: Offline Demo'}
          </div>
        </section>

        {/* Simulator Grid */}
        <section className="dashboard-grid">
          <div className="dashboard-card locked">
            <div className="card-header">
              <span className="card-icon">⚡</span>
              <h3>CPU Scheduling</h3>
            </div>
            <p>Simulate algorithms like FCFS, SJF, SRTF, Round Robin, and Priority Scheduling with interactive Gantt charts.</p>
            <div className="card-footer">
              <span className="badge-lock">Coming Soon</span>
            </div>
          </div>

          <div className="dashboard-card locked">
            <div className="card-header">
              <span className="card-icon">🧠</span>
              <h3>Memory Management</h3>
            </div>
            <p>Visualize Page Replacement (FIFO, LRU, Optimal) and Memory Allocation (First Fit, Best Fit, Worst Fit) policies.</p>
            <div className="card-footer">
              <span className="badge-lock">Coming Soon</span>
            </div>
          </div>

          <div className="dashboard-card locked">
            <div className="card-header">
              <span className="card-icon">🔄</span>
              <h3>Process Synchronization</h3>
            </div>
            <p>Explore classic synchronization problems like Producer-Consumer, Reader-Writer, and the Dining Philosophers.</p>
            <div className="card-footer">
              <span className="badge-lock">Coming Soon</span>
            </div>
          </div>

          <div className="dashboard-card locked">
            <div className="card-header">
              <span className="card-icon">💾</span>
              <h3>Disk Scheduling</h3>
            </div>
            <p>Visualize seek times for FCFS, SSTF, SCAN, C-SCAN, LOOK, and C-LOOK disk scheduling algorithms.</p>
            <div className="card-footer">
              <span className="badge-lock">Coming Soon</span>
            </div>
          </div>
        </section>

        {/* Live Diagnostics Console */}
        <section className="diagnostics-terminal">
          <div className="terminal-header">
            <div className="terminal-buttons">
              <span className="term-btn close"></span>
              <span className="term-btn minimize"></span>
              <span className="term-btn expand"></span>
            </div>
            <span className="terminal-title">System Diagnostics Console</span>
          </div>
          <div className="terminal-body">
            <div className="terminal-line"><span className="term-time">[14:31:00]</span> <span className="term-sys">[SYSTEM]</span> Initializing core kernel modules...</div>
            <div className="terminal-line"><span className="term-time">[14:31:01]</span> <span className="term-sys">[SYSTEM]</span> Connecting to cloud storage database...</div>
            <div className="terminal-line"><span className="term-time">[14:31:02]</span> <span className="term-success">[SUCCESS]</span> Supabase database wrapper mounted.</div>
            <div className="terminal-line"><span className="term-time">[14:31:03]</span> <span className="term-user">[USER]</span> Authentication state checked. User session found.</div>
            <div className="terminal-line"><span className="term-time">[14:31:04]</span> <span className="term-success">[SUCCESS]</span> Session validated. Welcome to SSCBS OS v1.0.0. Ready for simulation instructions.</div>
            <div className="terminal-line cursor-line"><span className="term-prompt">admin@sscb-os:~$</span> <span className="cursor"></span></div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
