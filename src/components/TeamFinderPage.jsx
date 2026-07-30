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
    course: user?.user_metadata?.course || 'BMS',
    year: user?.user_metadata?.semester ? `Sem ${user.user_metadata.semester}` : '2nd Year',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Fetch real posts from Supabase (or localStorage sync if offline)
  const fetchPosts = async () => {
    setLoading(true);
    try {
      if (hasValidCredentials) {
        const { data, error } = await supabase
          .from('squad_posts')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setPosts(data);
          localStorage.setItem('sscbs_squad_posts', JSON.stringify(data));
          setLoading(false);
          return;
        }
      }

      // Offline / cached storage fallback
      const saved = localStorage.getItem('sscbs_squad_posts');
      if (saved) {
        setPosts(JSON.parse(saved));
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.warn('Error fetching squad posts:', err);
      const saved = localStorage.getItem('sscbs_squad_posts');
      setPosts(saved ? JSON.parse(saved) : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();

    if (hasValidCredentials) {
      const channel = supabase
        .channel('public:squad_posts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_posts' }, () => {
          fetchPosts();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
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
      setFormError('Please enter a post title.');
      return;
    }
    if (!formData.phone_number.trim()) {
      setFormError('Please provide a contact phone / WhatsApp number.');
      return;
    }

    setSubmitting(true);

    const postPayload = {
      user_id: user?.id,
      competition_name: formData.competition_name.trim(),
      organizer: formData.organizer.trim() || 'Corporate / Society',
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
        const { data, error } = await supabase
          .from('squad_posts')
          .insert([postPayload])
          .select();

        if (error) {
          console.error('Supabase error inserting post:', error);
          setFormError('Could not save post to database. Checking fallback...');
        } else if (data && data[0]) {
          postPayload.id = data[0].id;
        }
      }
    } catch (err) {
      console.warn('Saving locally:', err);
    }

    if (!postPayload.id) {
      postPayload.id = 'post-' + Date.now();
    }

    const updated = [postPayload, ...posts.filter((p) => p.id !== postPayload.id)];
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
      course: user?.user_metadata?.course || 'BMS',
      year: user?.user_metadata?.semester ? `Sem ${user.user_metadata.semester}` : '2nd Year',
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

  // Filtering
  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      (post.competition_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.organizer || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.skills_looking_for || []).some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'open' && !post.is_open) return false;
    if (filterType === 'my_posts' && post.created_by_email !== user?.email && post.user_id !== user?.id) return false;

    if (selectedSkillFilter) {
      const hasSkill = (post.skills_looking_for || []).includes(selectedSkillFilter);
      if (!hasSkill) return false;
    }

    return true;
  });

  if (!isAdmin) {
    return (
      <div className="team-finder-container">
        <div className="admin-restricted-card">
          <div className="restricted-badge">
            <ShieldIcon size={20} />
            <span>Admin Beta Access Restricted</span>
          </div>
          <h2>Team Finder & Competition Hub</h2>
          <p>
            This feature is currently restricted to SSCBS OS administrators (
            <code>aditya.25015@sscbs.du.ac.in</code> & <code>manthan.25138@sscbs.du.ac.in</code>).
          </p>
          {onBack && (
            <button className="btn-tf-primary" onClick={onBack} style={{ marginTop: '1rem' }}>
              <BackIcon /> Return to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="team-finder-container">
      {/* ── Header ── */}
      <header className="tf-header">
        <div className="tf-header-left">
          {onBack && (
            <button className="tf-back-btn" onClick={onBack} title="Back">
              <BackIcon />
            </button>
          )}
          <div>
            <div className="tf-badge">
              <ShieldIcon size={13} />
              <span>ADMIN PREVIEW</span>
            </div>
            <h1 className="tf-title">Team Finder & Competition Hub</h1>
            <p className="tf-subtitle">
              Connect with peers, find complementary skills, and form teams for case competitions & hackathons.
            </p>
          </div>
        </div>

        <button className="btn-tf-primary" onClick={() => setIsCreateModalOpen(true)}>
          <UsersIcon size={18} />
          <span>Post Team Opening</span>
        </button>
      </header>

      {/* ── Filter Bar ── */}
      <div className="tf-controls-bar">
        <div className="tf-search-box">
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Search competitions, skills, or organizers..."
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
            Open ({posts.filter((p) => p.is_open).length})
          </button>
          <button
            className={`tf-filter-pill ${filterType === 'my_posts' ? 'active' : ''}`}
            onClick={() => setFilterType('my_posts')}
          >
            My Openings ({posts.filter((p) => p.created_by_email === user?.email || p.user_id === user?.id).length})
          </button>
        </div>
      </div>

      {/* ── Skill Tag Quick Filter Strip ── */}
      <div className="tf-skills-strip">
        <span className="strip-label">Skill needed:</span>
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
          <div className="notice-spinner"></div>
          <p>Loading squad postings…</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="tf-empty-state">
          <TrophyIcon size={36} />
          <h3>No team postings found</h3>
          <p>
            {searchQuery || selectedSkillFilter || filterType !== 'all'
              ? 'No team listings match your current filters.'
              : 'There are currently no active team postings. Post a new opening to start building your squad!'}
          </p>
          <button className="btn-tf-primary" onClick={() => setIsCreateModalOpen(true)}>
            Post Team Opening
          </button>
        </div>
      ) : (
        <div className="tf-posts-grid">
          {filteredPosts.map((post) => (
            <div key={post.id} className={`tf-post-card ${!post.is_open ? 'closed' : ''}`}>
              <div className="card-top-bar">
                <span className="comp-organizer">{post.organizer || 'Corporate / Society'}</span>
                <span className={`micro-label ${post.is_open ? 'success' : 'dim'}`}>
                  {post.is_open ? `${post.spots_left || 1} SPOT(S) LEFT` : 'FILLED'}
                </span>
              </div>

              <h2 className="comp-name">{post.competition_name}</h2>

              {post.competition_link && (
                <a
                  href={post.competition_link.startsWith('http') ? post.competition_link : `https://${post.competition_link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="comp-link"
                >
                  <FileIcon size={14} /> Competition Link ↗
                </a>
              )}

              <h3 className="post-title">{post.title}</h3>
              {post.description && <p className="post-desc">{post.description}</p>}

              {/* Skills We Have */}
              {post.skills_have && post.skills_have.length > 0 && (
                <div className="skills-group">
                  <span className="skills-group-label">Skills Present:</span>
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
                    <span className="creator-name">{post.created_by_name || 'Student'}</span>
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
                      title="Direct WhatsApp Connect"
                    >
                      <WhatsAppIcon size={15} /> WhatsApp
                    </a>
                  )}

                  {(post.created_by_email === user?.email || post.user_id === user?.id) && (
                    <>
                      <button
                        className="btn-card-subtle"
                        onClick={() => handleToggleStatus(post.id, post.is_open)}
                      >
                        {post.is_open ? 'Close' : 'Reopen'}
                      </button>
                      <button
                        className="btn-card-subtle danger"
                        onClick={() => handleDeletePost(post.id)}
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
                    placeholder="e.g. EY NextGen Leader, Bain BCN Case Comp"
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
                  <label>Competition Link</label>
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
                    placeholder="e.g. 919876543210"
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
                  placeholder="e.g. Need 1 Financial Modeler for EY NextGen"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Team Overview & Requirements</label>
                <textarea
                  rows="3"
                  placeholder="Describe your team strategy, current members, deadline, and requirements..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Skills Present */}
              <div className="form-group">
                <label>Skills Present in Your Team</label>
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

              {/* Skills Needed */}
              <div className="form-group">
                <label>Skills Needed in Teammates</label>
                <div className="skill-selector-box">
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
                    placeholder="Add custom skill needed..."
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
                  <label>Open Spots</label>
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
                  <label>Course</label>
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
                  <label>Year / Semester</label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="e.g. 2nd Year / Sem 4"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-tf-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-tf-primary" disabled={submitting}>
                  {submitting ? 'Publishing…' : 'Publish Opening'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
