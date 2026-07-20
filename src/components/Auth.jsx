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
      setTimeout(async () => {
        try {
          if (isSignUp) {
            await signUp(email, password, { full_name: fullName });
          } else {
            await signIn(email, password);
          }
          setLoading(false);
        } catch (err) {
          setError(err.message || 'An error occurred.');
          setLoading(false);
        }
      }, 800);
      return;
    }

    try {
      if (isSignUp) {
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

    if (!isConfigured) {
      setTimeout(() => {
        setLoading(false);
        setSuccessMsg(
          'Demo mode: Google Sign-In simulated successfully. ' +
          'Configure your Supabase keys in .env to use real Google Auth.'
        );
      }, 1000);
      return;
    }

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


