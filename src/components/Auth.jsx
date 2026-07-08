import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const slides = [
  {
    icon: '📊',
    title: 'GPA Calculator',
    description: 'Calculate and track your CGPA & SGPA dynamically based on DU guidelines. Keep your academic targets on course.'
  },
  {
    icon: '📚',
    title: 'PYQs & Study Resources',
    description: 'Instantly download previous years\' question papers, lecture notes, and essential study guides curated by seniors.'
  },
  {
    icon: '📅',
    title: 'Daily Class Schedules',
    description: 'Access your personalized course timetable, class slots, and classroom locations in one tap.'
  }
];

export default function Auth() {
  const { signIn, signUp, isConfigured } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);

  // Carousel auto-play
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const isCollegeEmail = (email) => {
    if (!email) return true; // don't show warning if empty
    return email.toLowerCase().endsWith('@sscbs.du.ac.in');
  };

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
      {/* Background decoration */}
      <div className="auth-decorations">
        <div className="light-ray ray-left"></div>
        <div className="light-ray ray-right"></div>
        <div className="bg-dots"></div>
      </div>

      <div className="auth-split-wrapper">
        
        {/* Left Panel: Branding & Slideshow */}
        <div className="auth-panel-left">
          <div className="left-content-wrapper">
            <div className="sscbs-badge">
              <svg className="sscbs-svg-logo" viewBox="0 0 100 100" width="56" height="56">
                {/* Shield background */}
                <path d="M50 5 L85 20 V55 C85 75 50 95 50 95 C50 95 15 75 15 55 V20 Z" fill="#0c2340" stroke="#d4af37" strokeWidth="3" />
                {/* Open Book */}
                <path d="M32 48 C39 48 46 51 50 54 C54 51 61 48 68 48 M32 61 C39 61 46 64 50 67 C54 64 61 61 68 61" fill="none" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" />
                <line x1="50" y1="51" x2="50" y2="70" stroke="#d4af37" strokeWidth="2" />
                {/* Glowing Flame/Lamp */}
                <path d="M50 20 C47 26 45 30 45 34 C45 38 47 41 50 41 C53 41 55 38 55 34 C55 30 53 26 50 20 Z" fill="#d4af37" />
                <path d="M50 24 C48 28 47 30 47 32 C47 34 48 36 50 36 C52 36 53 34 53 32 C53 30 52 28 50 24 Z" fill="#ffffff" opacity="0.85" />
              </svg>
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
                The ultimate digital ecosystem. Built by students, for students.
              </p>
            </div>

            {/* Carousel slider */}
            <div className="carousel-container">
              <div className="carousel-slides">
                {slides.map((slide, idx) => (
                  <div key={idx} className={`carousel-slide ${idx === activeSlide ? 'active' : ''}`}>
                    <div className="slide-icon">{slide.icon}</div>
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

            <div className="left-footer">
              <span>University of Delhi • Sector 16, Rohini</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Sign In / Sign Up Form */}
        <div className="auth-panel-right">
          <div className="auth-card-outer">
            {!isConfigured && (
              <div className="demo-mode-chip">
                <span className="pulse-circle"></span>
                Offline Sandbox Mode
              </div>
            )}

            <div className="auth-card-inner">
              <div className="card-header">
                <h2>{isSignUp ? 'Get Started' : 'Welcome Back'}</h2>
                <p>
                  {isSignUp 
                    ? 'Register with your student details to activate your account.' 
                    : 'Access your GPA metrics, timetables, and resource portal.'
                  }
                </p>
              </div>

              {!isConfigured && (
                <div className="sandbox-info-banner">
                  <span className="banner-icon">💡</span>
                  <p>
                    <strong>Supabase not connected.</strong> Using local mock authentication. You can type any username and password to log in.
                  </p>
                </div>
              )}

              {error && <div className="feedback-alert error-alert">{error}</div>}
              {successMsg && <div className="feedback-alert success-alert">{successMsg}</div>}

              <form onSubmit={handleSubmit} className="auth-form">
                {isSignUp && (
                  <div className="form-input-group">
                    <label htmlFor="fullName">Full Name</label>
                    <div className="input-field-wrapper">
                      <span className="input-field-icon">👤</span>
                      <input
                        type="text"
                        id="fullName"
                        placeholder="e.g. Aditya Vardhan"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={isSignUp}
                        autoComplete="name"
                      />
                    </div>
                  </div>
                )}

                <div className="form-input-group">
                  <label htmlFor="email">College Email Address</label>
                  <div className="input-field-wrapper">
                    <span className="input-field-icon">✉️</span>
                    <input
                      type="email"
                      id="email"
                      placeholder="name@sscbs.du.ac.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  {email && !isCollegeEmail(email) && (
                    <div className="email-warning-tag">
                      ⚠️ College features require an @sscbs.du.ac.in email
                    </div>
                  )}
                  {email && isCollegeEmail(email) && (
                    <div className="email-success-tag">
                      ✓ Verified SSCBS Student Email
                    </div>
                  )}
                </div>

                <div className="form-input-group">
                  <label htmlFor="password">Password</label>
                  <div className="input-field-wrapper">
                    <span className="input-field-icon">🔒</span>
                    <input
                      type="password"
                      id="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button type="submit" className="submit-button" disabled={loading}>
                  {loading ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    <span>{isSignUp ? 'Create Student Account' : 'Sign In'}</span>
                  )}
                </button>
              </form>

              <div className="card-footer">
                <p>
                  {isSignUp ? 'Already registered?' : 'New to SSCBS Campus OS?'}
                  <button
                    type="button"
                    className="toggle-auth-mode"
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

      </div>
    </div>
  );
}

