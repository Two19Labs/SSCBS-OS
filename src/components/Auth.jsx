import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Auth() {
  const { signIn, signUp, isConfigured } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (!isConfigured) {
      // Offline/Demo mode simulation
      setTimeout(() => {
        setLoading(false);
        setSuccessMsg(
          `Demo mode: Successfully "authenticated" as ${email || 'guest@example.com'}. ` +
          'To save real progress, configure your Supabase credentials in the .env file.'
        );
      }, 1000);
      return;
    }

    try {
      if (isSignUp) {
        await signUp(email, password, { full_name: fullName });
        setSuccessMsg('Registration successful! Please check your email for a confirmation link.');
        // Reset fields
        setEmail('');
        setPassword('');
        setFullName('');
      } else {
        await signIn(email, password);
        setSuccessMsg('Logged in successfully!');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background-effects">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <div className="auth-card-wrapper">
        {!isConfigured && (
          <div className="demo-badge">
            <span className="pulse-dot"></span>
            Demo Mode (Offline)
          </div>
        )}

        <div className="auth-card">
          <div className="auth-header">
            <div className="logo-area">
              <span className="logo-icon">💻</span>
              <h1 className="brand-title">SSCBS OS</h1>
            </div>
            <p className="auth-subtitle">
              {isSignUp ? 'Create your workspace account' : 'Sign in to access your OS workspace'}
            </p>
          </div>

          {!isConfigured && (
            <div className="offline-notice">
              <span className="notice-icon">⚠️</span>
              <p>
                <strong>Supabase credentials not found.</strong> You can log in with any email and password to explore the simulator in offline mode.
              </p>
            </div>
          )}

          {error && <div className="alert-message alert-error">{error}</div>}
          {successMsg && <div className="alert-message alert-success">{successMsg}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {isSignUp && (
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <div className="input-wrapper">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    id="fullName"
                    placeholder="Enter your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={isSignUp}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon">✉️</span>
                <input
                  type="email"
                  id="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  type="password"
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <span className="spinner"></span>
              ) : (
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setSuccessMsg('');
                }}
              >
                {isSignUp ? 'Sign In' : 'Create Account'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
