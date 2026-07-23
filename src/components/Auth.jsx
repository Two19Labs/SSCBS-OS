import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import './Auth.css';

const slides = [
  {
    title: 'Waiver Tool',
    description: 'Manage, track, and apply for college attendance waivers with automated document generation.'
  },
  {
    title: 'GPA Calculator',
    description: 'Calculate and track your CGPA & SGPA dynamically based on DU guidelines.'
  },
  {
    title: 'Class Schedules',
    description: 'Access your customized course timetables and class slots in one tap.'
  },
  {
    title: 'PYQs & Study Resources',
    description: 'Instantly download previous years\' question papers, syllabus, and study notes.'
  }
];

export default function Auth({ forceMode }) {
  const { signIn, signUp, resetPassword, updatePassword, isPasswordRecovery, setIsPasswordRecovery, directStudentAccess, isConfigured } = useAuth();
  
  // mode: 'signin' | 'signup' | 'forgot' | 'update_password'
  const [mode, setMode] = useState(() => forceMode || (isPasswordRecovery ? 'update_password' : 'signin'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (forceMode) {
      setMode(forceMode);
    } else if (isPasswordRecovery) {
      setMode('update_password');
    }
  }, [forceMode, isPasswordRecovery]);

  const handleInstantAccess = () => {
    const targetEmail = email && email.includes('@') ? email : 'aditya.25015@sscbs.du.ac.in';
    directStudentAccess(targetEmail);
  };

  // Carousel auto-play
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const isCollegeEmail = (email) => {
    if (!email) return true;
    return email.toLowerCase().endsWith('@sscbs.du.ac.in');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (mode === 'forgot') {
      try {
        await resetPassword(email);
        setSuccessMsg('Password reset instructions have been sent to your email! (Please check your inbox & spam folder).');
      } catch (err) {
        setError(err.message || 'Failed to send password reset email.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'update_password') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify.');
        setLoading(false);
        return;
      }
      try {
        await updatePassword(password);
        setSuccessMsg('Your password has been updated successfully! Opening your dashboard…');
        setPassword('');
        setConfirmPassword('');
        if (setIsPasswordRecovery) setIsPasswordRecovery(false);
        if (typeof window !== 'undefined' && (window.location.hash.includes('recovery') || window.location.hash.includes('reset-password'))) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        setTimeout(() => {
          window.location.href = window.location.origin;
        }, 1200);
      } catch (err) {
        setError(err.message || 'Failed to update password.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      if (mode === 'signup') {
        await signUp(email, password, { full_name: fullName });
        setSuccessMsg('Registration successful! Please check your email for a confirmation link. (Be sure to check your spam or junk folder if you do not see it in a few minutes).');
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

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            hd: 'sscbs.du.ac.in', // Lock domain input/selection to college domain
            prompt: 'select_account'
          },
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || 'An error occurred during Google Sign-In.');
      setLoading(false);
    }
  };

  const getHeaderTitle = () => {
    switch (mode) {
      case 'signup': return 'Create Account';
      case 'forgot': return 'Reset Password';
      case 'update_password': return 'Set New Password';
      default: return 'Sign In';
    }
  };

  const getHeaderDesc = () => {
    switch (mode) {
      case 'signup': return 'Enter your credentials to register.';
      case 'forgot': return 'Enter your registered college email to receive a reset link.';
      case 'update_password': return 'Enter your new password below to update your account.';
      default: return 'Sign in to access your student dashboard.';
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-split-wrapper">
        
        {/* Left Panel: Sourced Campus Image Backdrop & Minimalist Carousel */}
        <div className="auth-panel-left">
          <div className="auth-left-image-overlay"></div>
          <div className="left-content-wrapper">
            
            <div className="sscbs-badge">
              <img className="sscbs-logo-img" src="/sscbs_logo.png" alt="SSCBS Crest" width="48" height="48" />
              <div className="badge-text">
                <span className="inst-name">SHAHEED SUKHDEV</span>
                <span className="inst-sub">COLLEGE OF BUSINESS STUDIES</span>
              </div>
            </div>

            <div className="visual-hero">
              <h1 className="hero-title">
                SSCBS <span className="gold-text">Campus OS</span>
              </h1>
              <p className="hero-subtitle">
                A unified digital workspace for students.
              </p>
            </div>

            {/* Carousel slider - Clean text layout */}
            <div className="carousel-container">
              <div className="carousel-slides">
                {slides.map((slide, idx) => (
                  <div key={idx} className={`carousel-slide ${idx === activeSlide ? 'active' : ''}`}>
                    <div className="slide-content">
                      <h3>{slide.title}</h3>
                      <p>{slide.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="carousel-indicators">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    className={`indicator-dot ${idx === activeSlide ? 'active' : ''}`}
                    onClick={() => setActiveSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                  ></button>
                ))}
              </div>
            </div>


          </div>
        </div>

        {/* Right Panel: Clean Minimalist Auth Form */}
        <div className="auth-panel-right">
          <div className="auth-card-outer">
            <div className="auth-card-inner">
              <div className="card-header">
                <h2>{getHeaderTitle()}</h2>
                <p>{getHeaderDesc()}</p>
              </div>

              {error && <div className="feedback-alert error-alert">{error}</div>}
              {successMsg && <div className="feedback-alert success-alert">{successMsg}</div>}

              <form onSubmit={handleSubmit} className="auth-form">
                {mode === 'signup' && (
                  <div className="form-input-group">
                    <label htmlFor="fullName">Full Name</label>
                    <div className="input-field-wrapper">
                      <input
                        type="text"
                        id="fullName"
                        placeholder="Aditya Vardhan"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {mode !== 'update_password' && (
                  <div className="form-input-group">
                    <label htmlFor="email">College Email</label>
                    <div className="input-field-wrapper">
                      <input
                        type="email"
                        id="email"
                        placeholder="name@sscbs.du.ac.in"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    {email && !isCollegeEmail(email) && (
                      <div className="email-warning-tag">
                        ⚠️ Real student features require an @sscbs.du.ac.in email
                      </div>
                    )}
                    {email && isCollegeEmail(email) && (
                      <div className="email-success-tag">
                        ✓ Verified SSCBS Student Email
                      </div>
                    )}
                  </div>
                )}

                {mode !== 'forgot' && (
                  <div className="form-input-group">
                    <div className="label-row">
                      <label htmlFor="password">
                        {mode === 'update_password' ? 'New Password' : 'Password'}
                      </label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          className="forgot-password-link"
                          onClick={() => {
                            setMode('forgot');
                            setError('');
                            setSuccessMsg('');
                          }}
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="input-field-wrapper">
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
                )}

                {mode === 'update_password' && (
                  <div className="form-input-group">
                    <label htmlFor="confirmPassword">Confirm New Password</label>
                    <div className="input-field-wrapper">
                      <input
                        type="password"
                        id="confirmPassword"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                <button type="submit" className="submit-button" disabled={loading}>
                  {loading ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    <span>
                      {mode === 'signup' && 'Create Account'}
                      {mode === 'signin' && 'Sign In'}
                      {mode === 'forgot' && 'Send Reset Link'}
                      {mode === 'update_password' && 'Update Password'}
                    </span>
                  )}
                </button>
              </form>

              {mode !== 'forgot' && mode !== 'update_password' && (
                <>
                  <div className="auth-divider">
                    <span>OR</span>
                  </div>

                  <button type="button" className="google-signin-button" onClick={handleGoogleSignIn} disabled={loading}>
                    <svg className="google-icon-svg" viewBox="0 0 24 24" width="18" height="18">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </>
              )}

              <div className="card-footer">
                <p>
                  {mode === 'forgot' || mode === 'update_password' ? (
                    <button
                      type="button"
                      className="toggle-auth-mode"
                      onClick={() => {
                        if (setIsPasswordRecovery) setIsPasswordRecovery(false);
                        if (typeof window !== 'undefined' && (window.location.hash.includes('recovery') || window.location.hash.includes('reset-password'))) {
                          window.history.replaceState(null, '', window.location.pathname);
                        }
                        setMode('signin');
                        setError('');
                        setSuccessMsg('');
                      }}
                    >
                      ← Back to Sign In
                    </button>
                  ) : (
                    <>
                      {mode === 'signup' ? 'Already registered?' : 'New to Campus OS?'}
                      <button
                        type="button"
                        className="toggle-auth-mode"
                        onClick={() => {
                          setMode(mode === 'signup' ? 'signin' : 'signup');
                          setError('');
                          setSuccessMsg('');
                        }}
                      >
                        {mode === 'signup' ? 'Sign In' : 'Register'}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
          
          <div className="auth-credit-footer">
            <span>
              Made with <span className="heart-icon">♥</span> by{' '}
              <a href="https://www.linkedin.com/in/aditya-singhani-69294a27a/" target="_blank" rel="noopener noreferrer" className="developer-name linkedin-link">Aditya Singhani</a>{' '}
              &amp;{' '}
              <a href="https://www.linkedin.com/in/manthan-kabra/" target="_blank" rel="noopener noreferrer" className="developer-name linkedin-link">Manthan Kabra</a>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}


