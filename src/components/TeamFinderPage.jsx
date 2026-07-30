import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { isAdminEmail } from '../lib/admin';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import {
  TrophyIcon,
  UsersIcon,
  SearchIcon,
  WhatsAppIcon,
  CheckIcon,
  BackIcon,
  ShieldIcon,
  FileIcon,
} from './icons';
import './TeamFinderPage.css';

const DEFAULT_SKILLS = [
  'Financial Modeling',
  'Valuation & DCF',
  'Slide Deck & UI Design',
  'Public Speaking & Pitching',
  'Market Strategy & Research',
  'Python / Data Analytics',
  'Fullstack Dev / Tech',
  'Economics & Policy',
];

const PRESET_ORGANIZERS = [
  'EY India',
  'Bain & Company',
  'McKinsey & Company',
  'Accenture',
  'CBS Case Comp Society',
  'IIM Ahmedabad',
  'IIM Bangalore',
  'Harvard College China Forum',
  'L\'Oréal',
];

const SAMPLE_POSTS = [
  {
    id: 'sample-1',
    competition_name: 'EY NextGen Leader 2026',
    organizer: 'EY India',
    competition_link: 'https://www.ey.com/en_in/careers/nextgen-leader-challenge',
    phone_number: '919876543210',
    title: 'Building 4-member Squad for EY NextGen Challenge!',
    description: 'We have 2 team members proficient in Market Strategy and Pitch Deck Presentation. Looking for 2 people with strong hands-on Financial Modeling & Valuation skills to crunch numbers.',
    skills_have: ['Market Strategy & Research', 'Public Speaking & Pitching', 'Slide Deck & UI Design'],
    skills_looking_for: ['Financial Modeling', 'Valuation & DCF'],
    spots_left: 2,
    course: 'BMS',
    year: '2nd Year',
    is_open: true,
    created_by_email: 'aditya.25015@sscbs.du.ac.in',
    created_by_name: 'Aditya (Admin)',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    competition_name: 'Bain Capability Network (BCN) Case Comp',
    organizer: 'Bain & Company',
    competition_link: 'https://www.bain.com/',
    phone_number: '919988776655',
    title: 'Need 1 Deck Specialist & Analyst for Bain BCN Case Competition',
    description: 'Aiming for top podium. We have financial analysis covered. Need 1 design/slide wizard who can structure McKinsey/Bain style slides cleanly.',
    skills_have: ['Financial Modeling', 'Valuation & DCF', 'Market Strategy & Research'],
    skills_looking_for: ['Slide Deck & UI Design', 'Python / Data Analytics'],
    spots_left: 1,
    course: 'BFIA',
    year: '3rd Year',
    is_open: true,
    created_by_email: 'manthan.25138@sscbs.du.ac.in',
    created_by_name: 'Manthan (Admin)',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export default function TeamFinderPage({ onBack }) {
  const { user } = useAuth();
  const isAdmin = isAdminEmail(user?.email);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'open', 'my_posts'
  const [selectedSkillFilter, setSelectedSkillFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    competition_name: '',
    organizer: '',
    competition_link: '',
    phone_number: '',
    title: '',
    description: '',
    skills_have: [],
    skills_looking_for: [],
    custom_skill_have: '',
    custom_skill_looking: '',
    spots_left: 1,
    course: 'BMS',
    year: '2nd Year',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Load posts from Supabase or localStorage fallback
  const fetchPosts = async () => {
    setLoading(true);
    try {
      if (hasValidCredentials) {
        const { data, error } = await supabase
          .from('squad_posts')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          setPosts(data);
          setLoading(false);
          return;
        }
      }

      // LocalStorage / Sample fallback
      const saved = localStorage.getItem('sscbs_squad_posts');
      if (saved) {
        setPosts(JSON.parse(saved));
      } else {
        setPosts(SAMPLE_POSTS);
        localStorage.setItem('sscbs_squad_posts', JSON.stringify(SAMPLE_POSTS));
      }
    } catch (err) {
      console.warn('Using local fallback for squad posts:', err);
      const saved = localStorage.getItem('sscbs_squad_posts');
      setPosts(saved ? JSON.parse(saved) : SAMPLE_POSTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleToggleSkillHave = (skill) => {
    setFormData((prev) => {
      const exists = prev.skills_have.includes(skill);
      return {
        ...prev,
        skills_have: exists
          ? prev.skills_have.filter((s) => s !== skill)
          : [...prev.skills_have, skill],
      };
    });
  };

  const handleToggleSkillLooking = (skill) => {
    setFormData((prev) => {
      const exists = prev.skills_looking_for.includes(skill);
      return {
        ...prev,
        skills_looking_for: exists
          ? prev.skills_looking_for.filter((s) => s !== skill)
          : [...prev.skills_looking_for, skill],
      };
    });
  };

  const handleAddCustomSkillHave = () => {
    if (!formData.custom_skill_have.trim()) return;
    const skill = formData.custom_skill_have.trim();
    if (!formData.skills_have.includes(skill)) {
      setFormData((prev) => ({
        ...prev,
        skills_have: [...prev.skills_have, skill],
        custom_skill_have: '',
      }));
    }
  };

  const handleAddCustomSkillLooking = () => {
    if (!formData.custom_skill_looking.trim()) return;
    const skill = formData.custom_skill_looking.trim();
    if (!formData.skills_looking_for.includes(skill)) {
      setFormData((prev) => ({
        ...prev,
        skills_looking_for: [...prev.skills_looking_for, skill],
        custom_skill_looking: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.competition_name.trim()) {
      setFormError('Please enter the competition name.');
      return;
    }
    if (!formData.title.trim()) {
      setFormError('Please enter a team post title.');
      return;
    }
    if (!formData.phone_number.trim()) {
      setFormError('Please provide a WhatsApp / phone contact number.');
      return;
    }

    setSubmitting(true);

    const newPost = {
      id: 'post-' + Date.now(),
      competition_name: formData.competition_name.trim(),
      organizer: formData.organizer.trim() || 'Independent / Corporate',
      competition_link: formData.competition_link.trim(),
      phone_number: formData.phone_number.trim(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      skills_have: formData.skills_have,
      skills_looking_for: formData.skills_looking_for,
      spots_left: parseInt(formData.spots_left, 10) || 1,
      course: formData.course,
      year: formData.year,
      is_open: true,
      created_by_email: user.email,
      created_by_name: user.user_metadata?.full_name || user.email.split('@')[0],
      created_at: new Date().toISOString(),
    };

    try {
      if (hasValidCredentials) {
        const { error } = await supabase.from('squad_posts').insert([
          {
            user_id: user.id,
            competition_name: newPost.competition_name,
            organizer: newPost.organizer,
            competition_link: newPost.competition_link,
            phone_number: newPost.phone_number,
            title: newPost.title,
            description: newPost.description,
            skills_have: newPost.skills_have,
            skills_looking_for: newPost.skills_looking_for,
            spots_left: newPost.spots_left,
            course: newPost.course,
            year: newPost.year,
            is_open: true,
          },
        ]);
        if (error) {
          console.warn('Supabase insert warning, saving locally:', error);
        }
      }
    } catch (err) {
      console.warn('Saving locally:', err);
    }

    const updated = [newPost, ...posts];
    setPosts(updated);
    localStorage.setItem('sscbs_squad_posts', JSON.stringify(updated));

    setSubmitting(false);
    setIsCreateModalOpen(false);
    // Reset form
    setFormData({
      competition_name: '',
      organizer: '',
      competition_link: '',
      phone_number: '',
      title: '',
      description: '',
      skills_have: [],
      skills_looking_for: [],
      custom_skill_have: '',
      custom_skill_looking: '',
      spots_left: 1,
      course: 'BMS',
      year: '2nd Year',
    });
  };

  const handleDeletePost = async (id) => {
    if (!window.confirm('Are you sure you want to delete this squad listing?')) return;

    try {
      if (hasValidCredentials) {
        await supabase.from('squad_posts').delete().eq('id', id);
      }
    } catch (err) {
      console.warn('Failed to delete on Supabase:', err);
    }

    const updated = posts.filter((p) => p.id !== id);
    setPosts(updated);
    localStorage.setItem('sscbs_squad_posts', JSON.stringify(updated));
  };

  const handleToggleStatus = async (id, currentOpenState) => {
    const updated = posts.map((p) =>
      p.id === id ? { ...p, is_open: !currentOpenState } : p
    );
    setPosts(updated);
    localStorage.setItem('sscbs_squad_posts', JSON.stringify(updated));

    try {
      if (hasValidCredentials) {
        await supabase
          .from('squad_posts')
          .update({ is_open: !currentOpenState })
          .eq('id', id);
      }
    } catch (err) {
      console.warn('Status update error:', err);
    }
  };

  // Filter logic
  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      post.competition_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.organizer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.skills_looking_for.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'open' && !post.is_open) return false;
    if (filterType === 'my_posts' && post.created_by_email !== user?.email) return false;

    if (selectedSkillFilter) {
      const hasSkill = post.skills_looking_for.includes(selectedSkillFilter);
      if (!hasSkill) return false;
    }

    return true;
  });

  if (!isAdmin) {
    return (
      <div className="team-finder-container">
        <div className="admin-restricted-card">
          <div className="restricted-badge">
            <ShieldIcon size={24} />
            <span>Admin Beta Access Restricted</span>
          </div>
          <h2>Team Finder & Competition Hub</h2>
          <p>
            This module is currently in active private preview for SSCBS OS administrators (
            <code>aditya.25015@sscbs.du.ac.in</code> & <code>manthan.25138@sscbs.du.ac.in</code>).
          </p>
          <p className="restricted-sub">
            Full campus rollout for all BMS, BFIA & B.Sc students will occur in the upcoming update.
          </p>
          {onBack && (
            <button className="btn-secondary" onClick={onBack}>
              <BackIcon /> Return to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="team-finder-container">
      {/* ── Top Header Banner ── */}
      <header className="tf-header">
        <div className="tf-header-left">
          {onBack && (
            <button className="tf-back-btn" onClick={onBack} title="Back">
              <BackIcon />
            </button>
          )}
          <div>
            <div className="tf-badge">
              <ShieldIcon size={14} />
              <span>ADMIN PREVIEW • ADITYA & MANTHAN</span>
            </div>
            <h1 className="tf-title">Team Finder & Competition Hub</h1>
            <p className="tf-subtitle">
              Form competitive squads for Case Comps, Finance Challenges & Corporate Hackathons.
            </p>
          </div>
        </div>

        <button className="tf-create-btn" onClick={() => setIsCreateModalOpen(true)}>
          <UsersIcon size={18} />
          <span>Post Team Opening</span>
        </button>
      </header>

      {/* ── Controls & Filter Bar ── */}
      <div className="tf-controls-bar">
        <div className="tf-search-box">
          <SearchIcon size={18} />
          <input
            type="text"
            placeholder="Search competitions, skills needed, organizers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        <div className="tf-filter-pills">
          <button
            className={`tf-filter-pill ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Listings ({posts.length})
          </button>
          <button
            className={`tf-filter-pill ${filterType === 'open' ? 'active' : ''}`}
            onClick={() => setFilterType('open')}
          >
            Open Positions ({posts.filter((p) => p.is_open).length})
          </button>
          <button
            className={`tf-filter-pill ${filterType === 'my_posts' ? 'active' : ''}`}
            onClick={() => setFilterType('my_posts')}
          >
            My Admin Posts ({posts.filter((p) => p.created_by_email === user?.email).length})
          </button>
        </div>
      </div>

      {/* ── Skill Tag Quick Filter Strip ── */}
      <div className="tf-skills-strip">
        <span className="strip-label">Filter by Needed Skill:</span>
        <button
          className={`skill-tag-filter ${selectedSkillFilter === '' ? 'selected' : ''}`}
          onClick={() => setSelectedSkillFilter('')}
        >
          All Skills
        </button>
        {DEFAULT_SKILLS.slice(0, 6).map((skill) => (
          <button
            key={skill}
            className={`skill-tag-filter ${selectedSkillFilter === skill ? 'selected' : ''}`}
            onClick={() => setSelectedSkillFilter(selectedSkillFilter === skill ? '' : skill)}
          >
            {skill}
          </button>
        ))}
      </div>

      {/* ── Feed Grid ── */}
      {loading ? (
        <div className="tf-loading">
          <div className="system-spinner"></div>
          <p>Loading active competition squads…</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="tf-empty-state">
          <TrophyIcon size={40} />
          <h3>No squad listings match your criteria</h3>
          <p>Be the first to create a team opening for an upcoming case competition!</p>
          <button className="tf-create-btn" onClick={() => setIsCreateModalOpen(true)}>
            Post Team Opening Now
          </button>
        </div>
      ) : (
        <div className="tf-posts-grid">
          {filteredPosts.map((post) => (
            <div key={post.id} className={`tf-post-card ${!post.is_open ? 'closed' : ''}`}>
              <div className="card-top-bar">
                <span className="comp-organizer">{post.organizer}</span>
                <div className="card-status-tags">
                  {post.is_open ? (
                    <span className="status-badge open">🔥 {post.spots_left} Spot(s) Left</span>
                  ) : (
                    <span className="status-badge filled">✓ Team Filled</span>
                  )}
                </div>
              </div>

              <h2 className="comp-name">{post.competition_name}</h2>

              {post.competition_link && (
                <a
                  href={post.competition_link.startsWith('http') ? post.competition_link : `https://${post.competition_link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="comp-link"
                >
                  <FileIcon size={14} /> Official Competition Page ↗
                </a>
              )}

              <h3 className="post-title">{post.title}</h3>
              <p className="post-desc">{post.description}</p>

              {/* Skills We Have */}
              {post.skills_have && post.skills_have.length > 0 && (
                <div className="skills-group">
                  <span className="skills-group-label">Skills Present in Team:</span>
                  <div className="skills-pills">
                    {post.skills_have.map((s, idx) => (
                      <span key={idx} className="skill-pill present">
                        ✓ {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills We Need */}
              {post.skills_looking_for && post.skills_looking_for.length > 0 && (
                <div className="skills-group">
                  <span className="skills-group-label">Looking For:</span>
                  <div className="skills-pills">
                    {post.skills_looking_for.map((s, idx) => (
                      <span key={idx} className="skill-pill needed">
                        ⚡ {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Card Footer */}
              <div className="card-footer">
                <div className="creator-info">
                  <span className="creator-avatar">
                    {(post.created_by_name || post.created_by_email || 'A').charAt(0).toUpperCase()}
                  </span>
                  <span className="creator-details">
                    <span className="creator-name">{post.created_by_name || 'Admin Student'}</span>
                    <span className="creator-course">
                      {post.course} • {post.year}
                    </span>
                  </span>
                </div>

                <div className="card-actions">
                  {post.phone_number && (
                    <a
                      href={`https://wa.me/${post.phone_number.replace(/\D/g, '')}?text=Hi!%20Saw%20your%20team%20post%20for%20${encodeURIComponent(
                        post.competition_name
                      )}%20on%20SSCBS%20OS.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wa-connect-btn"
                      title="Direct WhatsApp Reachout"
                    >
                      <WhatsAppIcon size={16} /> WhatsApp
                    </a>
                  )}

                  {post.created_by_email === user?.email && (
                    <>
                      <button
                        className="btn-icon-subtle"
                        onClick={() => handleToggleStatus(post.id, post.is_open)}
                        title={post.is_open ? 'Mark as Closed' : 'Reopen Team'}
                      >
                        {post.is_open ? 'Close' : 'Reopen'}
                      </button>
                      <button
                        className="btn-icon-subtle danger"
                        onClick={() => handleDeletePost(post.id)}
                        title="Delete Post"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Post Modal ── */}
      {isCreateModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div className="tf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Post Team Opening</h2>
              <button className="modal-close" onClick={() => setIsCreateModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="tf-form">
              {formError && <div className="form-error-banner">{formError}</div>}

              <div className="form-row grid-2">
                <div className="form-group">
                  <label>Competition Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EY NextGen Leader 2026, Bain BCN"
                    value={formData.competition_name}
                    onChange={(e) => setFormData({ ...formData, competition_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Organizing Institute / Corp</label>
                  <input
                    type="text"
                    placeholder="e.g. EY India, Bain, IIM Ahmedabad"
                    value={formData.organizer}
                    onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                    list="preset-organizers"
                  />
                  <datalist id="preset-organizers">
                    {PRESET_ORGANIZERS.map((org) => (
                      <option key={org} value={org} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="form-row grid-2">
                <div className="form-group">
                  <label>Official Competition Link</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.competition_link}
                    onChange={(e) => setFormData({ ...formData, competition_link: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>WhatsApp / Contact Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 919876543210 (Country code + phone)"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Listing Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Need 1 Financial Modeler & Deck Specialist for EY NextGen"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Team Overview & Requirements</label>
                <textarea
                  rows="3"
                  placeholder="Describe your current team composition, strategy, vision, or deadline details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Skills We Have Selector */}
              <div className="form-group">
                <label>Skills Present in Your Current Team</label>
                <div className="skill-selector-box">
                  {DEFAULT_SKILLS.map((skill) => (
                    <button
                      type="button"
                      key={skill}
                      className={`skill-select-pill ${formData.skills_have.includes(skill) ? 'active' : ''}`}
                      onClick={() => handleToggleSkillHave(skill)}
                    >
                      {formData.skills_have.includes(skill) && <CheckIcon size={12} />} {skill}
                    </button>
                  ))}
                </div>
                <div className="custom-skill-input-row">
                  <input
                    type="text"
                    placeholder="Add custom skill present..."
                    value={formData.custom_skill_have}
                    onChange={(e) => setFormData({ ...formData, custom_skill_have: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSkillHave();
                      }
                    }}
                  />
                  <button type="button" onClick={handleAddCustomSkillHave} className="btn-add-skill">
                    + Add
                  </button>
                </div>
              </div>

              {/* Skills We Are Looking For Selector */}
              <div className="form-group">
                <label>Skills Needed in Teammate(s) You Want to Hire</label>
                <div className="skill-selector-box needed-box">
                  {DEFAULT_SKILLS.map((skill) => (
                    <button
                      type="button"
                      key={skill}
                      className={`skill-select-pill needed ${formData.skills_looking_for.includes(skill) ? 'active' : ''}`}
                      onClick={() => handleToggleSkillLooking(skill)}
                    >
                      {formData.skills_looking_for.includes(skill) && <CheckIcon size={12} />} {skill}
                    </button>
                  ))}
                </div>
                <div className="custom-skill-input-row">
                  <input
                    type="text"
                    placeholder="Add custom skill looking for..."
                    value={formData.custom_skill_looking}
                    onChange={(e) => setFormData({ ...formData, custom_skill_looking: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSkillLooking();
                      }
                    }}
                  />
                  <button type="button" onClick={handleAddCustomSkillLooking} className="btn-add-skill">
                    + Add
                  </button>
                </div>
              </div>

              <div className="form-row grid-3">
                <div className="form-group">
                  <label>Open Spots Left</label>
                  <select
                    value={formData.spots_left}
                    onChange={(e) => setFormData({ ...formData, spots_left: e.target.value })}
                  >
                    <option value="1">1 Spot</option>
                    <option value="2">2 Spots</option>
                    <option value="3">3 Spots</option>
                    <option value="4">4+ Spots</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Lead Course</label>
                  <select
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  >
                    <option value="BMS">BMS</option>
                    <option value="BFIA">BFIA</option>
                    <option value="B.Sc. CS">B.Sc. CS</option>
                    <option value="Cross-Course">Cross-Course</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Year</label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="tf-create-btn" disabled={submitting}>
                  {submitting ? 'Publishing Post…' : 'Publish Squad Opening'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
