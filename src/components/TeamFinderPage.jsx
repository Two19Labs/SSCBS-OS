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
  MailIcon,
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
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'open', 'my_posts', 'my_requests'
  const [selectedSkillFilter, setSelectedSkillFilter] = useState('');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPostForApply, setSelectedPostForApply] = useState(null);
  const [selectedPostForReview, setSelectedPostForReview] = useState(null);

  // Create Form State
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
    total_members: 4,
    spots_left: 1,
    course: user?.user_metadata?.course || 'BMS',
    year: user?.user_metadata?.semester ? `Sem ${user.user_metadata.semester}` : '2nd Year',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Skill Feedback messages
  const [skillHaveFeedback, setSkillHaveFeedback] = useState('');
  const [skillLookingFeedback, setSkillLookingFeedback] = useState('');

  // Apply Modal Form State
  const [applyForm, setApplyForm] = useState({
    pitch_note: '',
    applicant_phone: '',
    highlighted_skills: [],
  });
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState('');

  // Fetch real posts & applications from Supabase
  const fetchPostsAndApps = async () => {
    setLoading(true);
    try {
      if (hasValidCredentials) {
        const [postsRes, appsRes] = await Promise.all([
          supabase.from('squad_posts').select('*').order('created_at', { ascending: false }),
          supabase.from('squad_applications').select('*').order('created_at', { ascending: false }),
        ]);

        if (!postsRes.error && postsRes.data) {
          const enrichedPosts = postsRes.data.map((p) => ({
            ...p,
            created_by_name: p.created_by_name || (p.created_by_email ? p.created_by_email.split('@')[0] : 'Student Lead'),
            created_by_email: p.created_by_email || '',
            total_members: p.total_members || (p.spots_left ? p.spots_left + 1 : 4),
          }));
          setPosts(enrichedPosts);
          localStorage.setItem('sscbs_squad_posts', JSON.stringify(enrichedPosts));
        } else if (postsRes.error) {
          console.error('Supabase fetch posts error:', postsRes.error);
        }

        if (!appsRes.error && appsRes.data) {
          setApplications(appsRes.data);
          localStorage.setItem('sscbs_squad_apps', JSON.stringify(appsRes.data));
        } else if (appsRes.error) {
          console.error('Supabase fetch apps error:', appsRes.error);
        }
      } else {
        const savedPosts = localStorage.getItem('sscbs_squad_posts');
        const savedApps = localStorage.getItem('sscbs_squad_apps');
        if (savedPosts) setPosts(JSON.parse(savedPosts));
        if (savedApps) setApplications(JSON.parse(savedApps));
      }
    } catch (err) {
      console.warn('Error loading squad posts/apps:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostsAndApps();

    if (hasValidCredentials) {
      const channelPosts = supabase
        .channel('public:squad_posts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_posts' }, () => {
          fetchPostsAndApps();
        })
        .subscribe();

      const channelApps = supabase
        .channel('public:squad_applications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_applications' }, () => {
          fetchPostsAndApps();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channelPosts);
        supabase.removeChannel(channelApps);
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
    const skill = formData.custom_skill_have.trim();
    if (!skill) return;

    if (!formData.skills_have.includes(skill)) {
      setFormData((prev) => ({
        ...prev,
        skills_have: [...prev.skills_have, skill],
        custom_skill_have: '',
      }));
      setSkillHaveFeedback(`✓ Added "${skill}" to skills present`);
      setTimeout(() => setSkillHaveFeedback(''), 3000);
    }
  };

  const handleAddCustomSkillLooking = () => {
    const skill = formData.custom_skill_looking.trim();
    if (!skill) return;

    if (!formData.skills_looking_for.includes(skill)) {
      setFormData((prev) => ({
        ...prev,
        skills_looking_for: [...prev.skills_looking_for, skill],
        custom_skill_looking: '',
      }));
      setSkillLookingFeedback(`✓ Added "${skill}" to skills needed`);
      setTimeout(() => setSkillLookingFeedback(''), 3000);
    }
  };

  const handleRemoveSkillHave = (skill) => {
    setFormData((prev) => ({
      ...prev,
      skills_have: prev.skills_have.filter((s) => s !== skill),
    }));
  };

  const handleRemoveSkillLooking = (skill) => {
    setFormData((prev) => ({
      ...prev,
      skills_looking_for: prev.skills_looking_for.filter((s) => s !== skill),
    }));
  };

  const handleSubmitPost = async (e) => {
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

    const totalMem = parseInt(formData.total_members, 10) || 4;
    const openSpots = Math.min(totalMem, parseInt(formData.spots_left, 10) || 1);

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
      total_members: totalMem,
      spots_left: openSpots,
      course: formData.course,
      year: formData.year,
      is_open: openSpots > 0,
      created_by_email: user.email,
      created_by_name: user.user_metadata?.full_name || user.email.split('@')[0],
      created_at: new Date().toISOString(),
    };

    try {
      if (hasValidCredentials) {
        // 1. Try full insert
        let res = await supabase
          .from('squad_posts')
          .insert([postPayload])
          .select();

        if (res.error) {
          console.warn('Full payload insert warning, trying core payload:', res.error);
          // 2. Fallback insert with core columns
          const corePayload = {
            user_id: user?.id,
            competition_name: postPayload.competition_name,
            organizer: postPayload.organizer,
            competition_link: postPayload.competition_link,
            phone_number: postPayload.phone_number,
            title: postPayload.title,
            description: postPayload.description,
            skills_have: postPayload.skills_have,
            skills_looking_for: postPayload.skills_looking_for,
            spots_left: postPayload.spots_left,
            course: postPayload.course,
            year: postPayload.year,
            is_open: postPayload.is_open,
          };
          res = await supabase
            .from('squad_posts')
            .insert([corePayload])
            .select();
        }

        if (!res.error && res.data && res.data[0]) {
          postPayload.id = res.data[0].id;
        } else if (res.error) {
          console.error('Supabase squad_posts insert error:', res.error);
          setFormError('Could not save post online: ' + (res.error.message || 'Database error'));
          setSubmitting(false);
          return;
        }
      }
    } catch (err) {
      console.error('Exception during post submission:', err);
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
      total_members: 4,
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

  // ── IN-APP JOIN REQUEST FLOW ──
  const handleOpenApplyModal = (post) => {
    setSelectedPostForApply(post);
    setApplyForm({
      pitch_note: '',
      applicant_phone: user?.user_metadata?.phone || '',
      highlighted_skills: post.skills_looking_for ? [...post.skills_looking_for] : [],
    });
    setApplyError('');
    setApplySuccess('');
  };

  const handleSubmitJoinRequest = async (e) => {
    e.preventDefault();
    if (!applyForm.pitch_note.trim()) {
      setApplyError('Please write a short pitch note.');
      return;
    }

    setApplySubmitting(true);
    setApplyError('');

    const appPayload = {
      id: 'app-' + Date.now(),
      post_id: selectedPostForApply.id,
      applicant_id: user?.id,
      applicant_name: user?.user_metadata?.full_name || user?.email.split('@')[0],
      applicant_email: user?.email,
      applicant_phone: applyForm.applicant_phone.trim(),
      applicant_course: user?.user_metadata?.course || 'BMS',
      applicant_year: user?.user_metadata?.semester ? `Sem ${user.user_metadata.semester}` : '2nd Year',
      pitch_note: applyForm.pitch_note.trim(),
      highlighted_skills: applyForm.highlighted_skills,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    try {
      if (hasValidCredentials) {
        const { data, error } = await supabase
          .from('squad_applications')
          .insert([{
            post_id: selectedPostForApply.id,
            applicant_id: user?.id,
            applicant_name: appPayload.applicant_name,
            applicant_email: appPayload.applicant_email,
            applicant_phone: appPayload.applicant_phone,
            applicant_course: appPayload.applicant_course,
            applicant_year: appPayload.applicant_year,
            pitch_note: appPayload.pitch_note,
            highlighted_skills: appPayload.highlighted_skills,
            status: 'pending',
          }])
          .select();

        if (error) {
          console.error('Supabase application insert error:', error);
          setApplyError('Could not save application online. Saving locally...');
        } else if (data && data[0]) {
          appPayload.id = data[0].id;
        }
      }
    } catch (err) {
      console.warn('Saving local application:', err);
    }

    const updatedApps = [appPayload, ...applications.filter((a) => a.id !== appPayload.id)];
    setApplications(updatedApps);
    localStorage.setItem('sscbs_squad_apps', JSON.stringify(updatedApps));

    setApplySubmitting(false);
    setApplySuccess('🎉 Join request submitted! The team lead will review your application.');
    setTimeout(() => {
      setSelectedPostForApply(null);
      setApplySuccess('');
    }, 2000);
  };

  // ── HOST REVIEW & ACCEPTANCE FLOW ──
  const handleAcceptApplicant = async (app) => {
    const post = posts.find((p) => p.id === app.post_id);
    if (!post) return;

    const currentOpen = Math.max(0, (post.spots_left || 1) - 1);
    const isNowOpen = currentOpen > 0;

    // Update application status to 'accepted'
    const updatedApps = applications.map((a) => (a.id === app.id ? { ...a, status: 'accepted' } : a));
    setApplications(updatedApps);
    localStorage.setItem('sscbs_squad_apps', JSON.stringify(updatedApps));

    // Update post open spots count & filled status
    const updatedPosts = posts.map((p) =>
      p.id === post.id ? { ...p, spots_left: currentOpen, is_open: isNowOpen } : p
    );
    setPosts(updatedPosts);
    localStorage.setItem('sscbs_squad_posts', JSON.stringify(updatedPosts));

    try {
      if (hasValidCredentials) {
        await Promise.all([
          supabase.from('squad_applications').update({ status: 'accepted' }).eq('id', app.id),
          supabase.from('squad_posts').update({ spots_left: currentOpen, is_open: isNowOpen }).eq('id', post.id),
        ]);
      }
    } catch (err) {
      console.warn('Supabase status update error:', err);
    }
  };

  const handleDeclineApplicant = async (app) => {
    const updatedApps = applications.map((a) => (a.id === app.id ? { ...a, status: 'declined' } : a));
    setApplications(updatedApps);
    localStorage.setItem('sscbs_squad_apps', JSON.stringify(updatedApps));

    try {
      if (hasValidCredentials) {
        await supabase.from('squad_applications').update({ status: 'declined' }).eq('id', app.id);
      }
    } catch (err) {
      console.warn('Supabase status update error:', err);
    }
  };

  const handleRemoveAcceptedMember = async (app) => {
    const post = posts.find((p) => p.id === app.post_id);
    if (!post) return;

    const currentOpen = (post.spots_left || 0) + 1;

    // Reopen spot
    const updatedApps = applications.map((a) => (a.id === app.id ? { ...a, status: 'declined' } : a));
    setApplications(updatedApps);
    localStorage.setItem('sscbs_squad_apps', JSON.stringify(updatedApps));

    const updatedPosts = posts.map((p) =>
      p.id === post.id ? { ...p, spots_left: currentOpen, is_open: true } : p
    );
    setPosts(updatedPosts);
    localStorage.setItem('sscbs_squad_posts', JSON.stringify(updatedPosts));

    try {
      if (hasValidCredentials) {
        await Promise.all([
          supabase.from('squad_applications').update({ status: 'declined' }).eq('id', app.id),
          supabase.from('squad_posts').update({ spots_left: currentOpen, is_open: true }).eq('id', post.id),
        ]);
      }
    } catch (err) {
      console.warn('Supabase remove member error:', err);
    }
  };

  // Dots rendering helper
  const renderSquadDots = (totalMembers = 4, openSpots = 1, isOpen = true) => {
    const total = Math.max(1, parseInt(totalMembers, 10) || 4);
    const open = isOpen ? Math.min(total, Math.max(0, parseInt(openSpots, 10) || 0)) : 0;
    const filled = Math.max(0, total - open);

    const dots = [];
    for (let i = 0; i < filled; i++) {
      dots.push(<span key={`f-${i}`} className="squad-dot filled" title="Filled Member Spot">●</span>);
    }
    for (let i = 0; i < open; i++) {
      dots.push(<span key={`o-${i}`} className="squad-dot open" title="Open Slot Looking for Member">○</span>);
    }

    return (
      <div className="squad-dots-wrapper" title={`${filled}/${total} slots filled (${open} open)`}>
        <div className="squad-dots">{dots}</div>
        <span className="squad-dots-subtext">
          {open > 0 ? `${open} open` : 'Full'}
        </span>
      </div>
    );
  };

  // My Applications sent by current user
  const mySentApplications = applications.filter(
    (a) => a.applicant_email === user?.email || a.applicant_id === user?.id
  );

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
    if (filterType === 'my_requests') {
      const hasApplied = mySentApplications.some((a) => a.post_id === post.id);
      if (!hasApplied) return false;
    }

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
            <ShieldIcon size={18} />
            <span>Admin Beta Restricted</span>
          </div>
          <h2>Team Finder & Competition Hub</h2>
          <p>
            This feature is currently restricted to SSCBS OS administrators (
            <code>aditya.25015</code>, <code>manthan.25138</code> & <code>somya.25221</code>).
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
              <ShieldIcon size={12} />
              <span>ADMIN PREVIEW</span>
            </div>
            <h1 className="tf-title">Team Finder & Competition Hub</h1>
            <p className="tf-subtitle">
              Connect with peers, match complementary skills, and form competition teams.
            </p>
          </div>
        </div>

        <button className="btn-tf-primary" onClick={() => setIsCreateModalOpen(true)}>
          <UsersIcon size={16} />
          <span>Post Team Opening</span>
        </button>
      </header>

      {/* ── Filter Bar ── */}
      <div className="tf-controls-bar">
        <div className="tf-search-box">
          <SearchIcon size={15} />
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
            All ({posts.length})
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
            Mine ({posts.filter((p) => p.created_by_email === user?.email || p.user_id === user?.id).length})
          </button>
          <button
            className={`tf-filter-pill ${filterType === 'my_requests' ? 'active' : ''}`}
            onClick={() => setFilterType('my_requests')}
          >
            My Requests ({mySentApplications.length})
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
          <TrophyIcon size={32} />
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
          {filteredPosts.map((post) => {
            const isHost = post.created_by_email === user?.email || post.user_id === user?.id;
            const postApps = applications.filter((a) => a.post_id === post.id);
            const pendingAppsCount = postApps.filter((a) => a.status === 'pending').length;
            
            // Check if current user has already applied
            const userApp = applications.find(
              (a) => a.post_id === post.id && (a.applicant_email === user?.email || a.applicant_id === user?.id)
            );

            return (
              <div key={post.id} className={`tf-post-card ${!post.is_open ? 'closed' : ''}`}>
                <div className="card-top-bar">
                  <span className="comp-organizer">{post.organizer || 'Corporate / Society'}</span>
                  {renderSquadDots(post.total_members || 4, post.spots_left || 1, post.is_open)}
                </div>

                <h2 className="comp-name">{post.competition_name}</h2>

                {post.competition_link && (
                  <a
                    href={post.competition_link.startsWith('http') ? post.competition_link : `https://${post.competition_link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="comp-link"
                  >
                    <FileIcon size={13} /> Official Link ↗
                  </a>
                )}

                <h3 className="post-title">{post.title}</h3>
                {post.description && <p className="post-desc">{post.description}</p>}

                {/* Skills Present */}
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

                {/* Skills Needed */}
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

                {/* Application Status Badge for User */}
                {userApp && !isHost && (
                  <div className="user-app-status-row">
                    <span className={`user-app-status-pill ${userApp.status}`}>
                      {userApp.status === 'accepted'
                        ? '🎉 Accepted into Squad'
                        : userApp.status === 'declined'
                        ? 'Declined'
                        : '⏳ Request Pending Review'}
                    </span>
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
                    {/* Host Controls */}
                    {isHost ? (
                      <>
                        <button
                          className="btn-review-apps"
                          onClick={() => setSelectedPostForReview(post)}
                          title="Review Applicant Requests"
                        >
                          <MailIcon size={14} />
                          <span>Requests</span>
                          {pendingAppsCount > 0 && <span className="apps-count-badge">{pendingAppsCount}</span>}
                        </button>
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
                    ) : (
                      /* Peer Student Controls */
                      <>
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
                            <WhatsAppIcon size={14} /> WhatsApp
                          </a>
                        )}

                        {post.is_open && !userApp && (
                          <button
                            className="btn-tf-primary"
                            onClick={() => handleOpenApplyModal(post)}
                          >
                            <MailIcon size={13} /> Request to Join
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE POST MODAL ── */}
      {isCreateModalOpen && (
        <div className="tf-modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="tf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tf-modal-header">
              <div>
                <h3>Post Team Opening</h3>
                <p className="tf-modal-subtitle">Find complementary teammates for your competition squad</p>
              </div>
              <button className="tf-close-btn" onClick={() => setIsCreateModalOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitPost} className="tf-modal-form">
              {formError && <div className="form-error-banner">{formError}</div>}

              <div className="tf-form-row">
                <div className="tf-form-group tf-flex-1">
                  <label>Competition Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EY NextGen Leader, Bain BCN"
                    value={formData.competition_name}
                    onChange={(e) => setFormData({ ...formData, competition_name: e.target.value })}
                  />
                </div>

                <div className="tf-form-group tf-flex-1">
                  <label>Organizing Institute / Corp</label>
                  <input
                    type="text"
                    placeholder="e.g. EY India, Bain, IIM Ahmedabad"
                    value={formData.organizer}
                    onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                  />
                </div>
              </div>

              <div className="tf-form-row">
                <div className="tf-form-group tf-flex-1">
                  <label>Competition Link</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.competition_link}
                    onChange={(e) => setFormData({ ...formData, competition_link: e.target.value })}
                  />
                </div>

                <div className="tf-form-group tf-flex-1">
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

              <div className="tf-form-group">
                <label>Listing Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Need 1 Financial Modeler for EY NextGen"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="tf-form-group">
                <label>Team Overview & Strategy</label>
                <textarea
                  rows="2"
                  placeholder="Describe your team composition, strategy, deadline..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Members & Spots Selector */}
              <div className="tf-form-row">
                <div className="tf-form-group tf-flex-1">
                  <label>Total Team Size</label>
                  <select
                    value={formData.total_members}
                    onChange={(e) => setFormData({ ...formData, total_members: e.target.value })}
                  >
                    <option value="2">2 Members</option>
                    <option value="3">3 Members</option>
                    <option value="4">4 Members</option>
                    <option value="5">5 Members</option>
                  </select>
                </div>

                <div className="tf-form-group tf-flex-1">
                  <label>Open Spots Left</label>
                  <select
                    value={formData.spots_left}
                    onChange={(e) => setFormData({ ...formData, spots_left: e.target.value })}
                  >
                    <option value="1">1 Open Spot (● ● ● ○)</option>
                    <option value="2">2 Open Spots (● ● ○ ○)</option>
                    <option value="3">3 Open Spots (● ○ ○ ○)</option>
                    <option value="4">4 Open Spots (○ ○ ○ ○)</option>
                  </select>
                </div>
              </div>

              {/* Skills Present */}
              <div className="tf-form-group">
                <label>Skills Present in Your Team</label>

                {formData.skills_have.length > 0 && (
                  <div className="selected-skills-row">
                    <span className="selected-skills-title">Active:</span>
                    {formData.skills_have.map((skill) => (
                      <span key={skill} className="selected-skill-pill present">
                        {skill}
                        <button
                          type="button"
                          className="btn-remove-skill"
                          onClick={() => handleRemoveSkillHave(skill)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="tf-skill-selector-box">
                  {DEFAULT_SKILLS.map((skill) => (
                    <button
                      type="button"
                      key={skill}
                      className={`tf-skill-pill ${formData.skills_have.includes(skill) ? 'active' : ''}`}
                      onClick={() => handleToggleSkillHave(skill)}
                    >
                      {formData.skills_have.includes(skill) && <CheckIcon size={12} />} {skill}
                    </button>
                  ))}
                </div>

                <div className="tf-custom-skill-row">
                  <input
                    type="text"
                    placeholder="Type custom skill present..."
                    value={formData.custom_skill_have}
                    onChange={(e) => setFormData({ ...formData, custom_skill_have: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSkillHave();
                      }
                    }}
                  />
                  <button type="button" onClick={handleAddCustomSkillHave} className="tf-btn-add-skill">
                    + Add
                  </button>
                </div>
                {skillHaveFeedback && (
                  <div className="skill-feedback-msg success">{skillHaveFeedback}</div>
                )}
              </div>

              {/* Skills Needed */}
              <div className="tf-form-group">
                <label>Skills Needed in Teammate(s)</label>

                {formData.skills_looking_for.length > 0 && (
                  <div className="selected-skills-row">
                    <span className="selected-skills-title">Needed:</span>
                    {formData.skills_looking_for.map((skill) => (
                      <span key={skill} className="selected-skill-pill needed">
                        {skill}
                        <button
                          type="button"
                          className="btn-remove-skill"
                          onClick={() => handleRemoveSkillLooking(skill)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="tf-skill-selector-box">
                  {DEFAULT_SKILLS.map((skill) => (
                    <button
                      type="button"
                      key={skill}
                      className={`tf-skill-pill needed ${formData.skills_looking_for.includes(skill) ? 'active' : ''}`}
                      onClick={() => handleToggleSkillLooking(skill)}
                    >
                      {formData.skills_looking_for.includes(skill) && <CheckIcon size={12} />} {skill}
                    </button>
                  ))}
                </div>

                <div className="tf-custom-skill-row">
                  <input
                    type="text"
                    placeholder="Type custom skill needed..."
                    value={formData.custom_skill_looking}
                    onChange={(e) => setFormData({ ...formData, custom_skill_looking: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSkillLooking();
                      }
                    }}
                  />
                  <button type="button" onClick={handleAddCustomSkillLooking} className="tf-btn-add-skill">
                    + Add
                  </button>
                </div>
                {skillLookingFeedback && (
                  <div className="skill-feedback-msg success">{skillLookingFeedback}</div>
                )}
              </div>

              <div className="tf-form-row">
                <div className="tf-form-group tf-flex-1">
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

                <div className="tf-form-group tf-flex-1">
                  <label>Year / Semester</label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="e.g. 2nd Year / Sem 4"
                  />
                </div>
              </div>

              <div className="tf-modal-footer">
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

      {/* ── JOIN REQUEST MODAL (FOR APPLICANTS) ── */}
      {selectedPostForApply && (
        <div className="tf-modal-overlay" onClick={() => setSelectedPostForApply(null)}>
          <div className="tf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tf-modal-header">
              <div>
                <h3>Request to Join Team</h3>
                <p className="tf-modal-subtitle">{selectedPostForApply.competition_name}</p>
              </div>
              <button className="tf-close-btn" onClick={() => setSelectedPostForApply(null)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitJoinRequest} className="tf-modal-form">
              {applyError && <div className="form-error-banner">{applyError}</div>}
              {applySuccess && <div className="skill-feedback-msg success" style={{ marginBottom: '12px', fontSize: '0.85rem' }}>{applySuccess}</div>}

              <div className="tf-form-group">
                <label>Pitch Note to Host *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Introduce yourself, your course, and explain why you're a great fit for this squad..."
                  value={applyForm.pitch_note}
                  onChange={(e) => setApplyForm({ ...applyForm, pitch_note: e.target.value })}
                />
              </div>

              <div className="tf-form-group">
                <label>Your WhatsApp / Contact Phone (Optional)</label>
                <input
                  type="tel"
                  placeholder="e.g. 919876543210"
                  value={applyForm.applicant_phone}
                  onChange={(e) => setApplyForm({ ...applyForm, applicant_phone: e.target.value })}
                />
              </div>

              {selectedPostForApply.skills_looking_for && selectedPostForApply.skills_looking_for.length > 0 && (
                <div className="tf-form-group">
                  <label>Highlight Skills You Bring to the Team</label>
                  <div className="tf-skill-selector-box">
                    {selectedPostForApply.skills_looking_for.map((skill) => {
                      const isSelected = applyForm.highlighted_skills.includes(skill);
                      return (
                        <button
                          type="button"
                          key={skill}
                          className={`tf-skill-pill ${isSelected ? 'active' : ''}`}
                          onClick={() => {
                            setApplyForm((prev) => ({
                              ...prev,
                              highlighted_skills: isSelected
                                ? prev.highlighted_skills.filter((s) => s !== skill)
                                : [...prev.highlighted_skills, skill],
                            }));
                          }}
                        >
                          {isSelected && <CheckIcon size={12} />} {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="tf-modal-footer">
                <button
                  type="button"
                  className="btn-tf-secondary"
                  onClick={() => setSelectedPostForApply(null)}
                  disabled={applySubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-tf-primary" disabled={applySubmitting}>
                  {applySubmitting ? 'Sending Request…' : 'Submit Join Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── HOST REVIEW APPLICATIONS MODAL ── */}
      {selectedPostForReview && (
        <div className="tf-modal-overlay" onClick={() => setSelectedPostForReview(null)}>
          <div className="tf-modal-card review-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tf-modal-header">
              <div>
                <h3>Review Team Applicants</h3>
                <p className="tf-modal-subtitle">
                  {selectedPostForReview.competition_name} • {selectedPostForReview.spots_left} open spot(s)
                </p>
              </div>
              <button className="tf-close-btn" onClick={() => setSelectedPostForReview(null)}>
                ×
              </button>
            </div>

            <div className="review-apps-body">
              {(() => {
                const postApps = applications.filter((a) => a.post_id === selectedPostForReview.id);

                if (postApps.length === 0) {
                  return (
                    <div className="tf-empty-state" style={{ padding: '30px 10px' }}>
                      <MailIcon size={28} />
                      <p>No join requests received yet for this competition opening.</p>
                    </div>
                  );
                }

                return (
                  <div className="apps-review-list">
                    {postApps.map((app) => (
                      <div key={app.id} className={`app-review-card ${app.status}`}>
                        <div className="app-card-header">
                          <div className="app-applicant-info">
                            <span className="applicant-avatar">
                              {(app.applicant_name || 'S').charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <span className="applicant-name">{app.applicant_name}</span>
                              <span className="applicant-meta">
                                {app.applicant_course} • {app.applicant_year}
                              </span>
                            </div>
                          </div>

                          <span className={`status-pill-badge ${app.status}`}>
                            {app.status === 'accepted' ? '✓ Accepted' : app.status === 'declined' ? 'Declined' : 'Pending'}
                          </span>
                        </div>

                        <p className="app-pitch-text">"{app.pitch_note}"</p>

                        {app.highlighted_skills && app.highlighted_skills.length > 0 && (
                          <div className="app-skills-row">
                            <span className="app-skills-label">Skills Offered:</span>
                            {app.highlighted_skills.map((s, idx) => (
                              <span key={idx} className="skill-pill present">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="app-card-actions">
                          {app.applicant_phone && (
                            <a
                              href={`https://wa.me/${app.applicant_phone.replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(
                                app.applicant_name
                              )}!%20Regarding%20your%20request%20to%20join%20our%20squad%20for%20${encodeURIComponent(
                                selectedPostForReview.competition_name
                              )}.`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="wa-connect-btn"
                            >
                              <WhatsAppIcon size={13} /> Chat on WhatsApp
                            </a>
                          )}

                          {app.status === 'pending' && (
                            <>
                              <button
                                className="btn-accept-app"
                                onClick={() => handleAcceptApplicant(app)}
                              >
                                ✓ Accept & Fill Spot
                              </button>
                              <button
                                className="btn-card-subtle danger"
                                onClick={() => handleDeclineApplicant(app)}
                              >
                                Decline
                              </button>
                            </>
                          )}

                          {app.status === 'accepted' && (
                            <button
                              className="btn-card-subtle danger"
                              onClick={() => handleRemoveAcceptedMember(app)}
                            >
                              Remove Member (Reopen Spot)
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="tf-modal-footer" style={{ padding: '16px 24px' }}>
              <button className="btn-tf-secondary" onClick={() => setSelectedPostForReview(null)}>
                Done Reviewing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
