import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SSCBS OS ErrorBoundary caught an error:', error, errorInfo);
    // Auto-recover from dynamic import chunk 404s after new Vercel deployments
    if (error && (
      error.name === 'ChunkLoadError' ||
      /loading.*chunk/i.test(error.message || '') ||
      /dynamically imported module/i.test(error.message || '') ||
      /failed to fetch/i.test(error.message || '')
    )) {
      const chunkRetry = window.sessionStorage.getItem('sscbs_chunk_err_reload');
      if (!chunkRetry) {
        window.sessionStorage.setItem('sscbs_chunk_err_reload', 'true');
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('sscbs_chunk_err_reload');
      window.location.hash = '';
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          background: 'var(--bg-main, #f8f6f0)',
          color: 'var(--ink, #1c1917)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ color: 'var(--ink-dim, #78716c)', maxWidth: '420px', fontSize: '0.95rem', marginBottom: '24px' }}>
            An unexpected error occurred while rendering this page. You can reload or return to the main dashboard.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--primary-color, #1e3a8a)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            Reload &amp; Return Home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
