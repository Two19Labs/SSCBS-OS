import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
    if (!email) return true;
    return email.toLowerCase().endsWith('@sscbs.du.ac.in');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (!isConfigured) {
      setTimeout(() => {
        setLoading(false);
        setSuccessMsg(
          `Demo mode: Logged in as ${email || 'guest@example.com'}. ` +
          'Configure Supabase in your .env file to enable live database sync.'
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
                <h2>{isSignUp ? 'Create Account' : 'Sign In'}</h2>
                <p>
                  {isSignUp 
                    ? 'Enter your credentials to register.' 
                    : 'Sign in to access your student dashboard.'
                  }
                </p>
              </div>

              {!isConfigured && (
                <div className="sandbox-info-banner">
                  <p>
                    <strong>Offline Sandbox:</strong> Supabase keys not set. Enter any email and password to log in.
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
                      <input
                        type="text"
                        id="fullName"
                        placeholder="Aditya Vardhan"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={isSignUp}
                      />
                    </div>
                  </div>
                )}

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

                <div className="form-input-group">
                  <label htmlFor="password">Password</label>
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

                <button type="submit" className="submit-button" disabled={loading}>
                  {loading ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  )}
                </button>
              </form>

              <div className="card-footer">
                <p>
                  {isSignUp ? 'Already registered?' : 'New to Campus OS?'}
                  <button
                    type="button"
                    className="toggle-auth-mode"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError('');
                      setSuccessMsg('');
                    }}
                  >
                    {isSignUp ? 'Sign In' : 'Register'}
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

