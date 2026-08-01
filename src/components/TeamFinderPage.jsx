import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { isAdminEmail, canAccessTeamFinder } from '../lib/admin';
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
  MoreVerticalIcon,
  RefreshIcon,
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

function formatWhatsAppUrl(phone, textMessage = '') {
  if (!phone) return '#';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '91' + digits;
  }
  return `https://wa.me/${digits}${textMessage ? `?text=${encodeURIComponent(textMessage)}` : ''}`;
}

function formatStudentName(rawName, email) {
  if (rawName && rawName !== 'Student Lead' && rawName !== 'Student' && rawName.trim()) {
    return rawName.trim();
  }
  if (email && typeof email === 'string' && email.includes('@')) {
    const handle = email.split('@')[0]; // e.g. "aditya.25015"
    const parts = handle.split('.');
    if (parts.length >= 2) {
      const namePart = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const rollPart = parts[1];
      return `${namePart} (${rollPart})`;
    }
    return handle.charAt(0).toUpperCase() + handle.slice(1);
  }
  return 'Student Lead';
}

export default function TeamFinderPage({ onBack }) {
  const { user } = useAuth();
  const { featureFlags } = useConfig();
  const isAdmin = isAdminEmail(user?.email);
  const hasAccess = featureFlags['team-finder'] || canAccessTeamFinder(user?.email);

  const [posts, setPosts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('my'); // 'my' (My Listings), 'other' (Other Listings)
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState('');

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setRefreshToast('');
    await fetchPostsAndApps(true);
    setIsRefreshing(false);
    setRefreshToast('✨ Listings updated!');
    setTimeout(() => setRefreshToast(''), 2500);
  };
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null); // When editing a post
  const [selectedPostForApply, setSelectedPostForApply] = useState(null);
  const [selectedPostForReview, setSelectedPostForReview] = useState(null);
  const [activeAdminMenuPostId, setActiveAdminMenuPostId] = useState(null);

  useEffect(() => {
    const handleOutsideClick = () => setActiveAdminMenuPostId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Create/Edit Form State
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

  const POST_EXPIRATION_MS = 72 * 60 * 60 * 1000; // 72 hours (3 days)

  // Fetch real posts & applications from Supabase
  const fetchPostsAndApps = async (force = false) => {
    const now = Date.now();

    if (!force && !hasValidCredentials) {
      const savedPosts = localStorage.getItem('sscbs_squad_posts');
      const savedApps = localStorage.getItem('sscbs_squad_apps');
      if (savedPosts) {
        const parsed = JSON.parse(savedPosts);
        const active = parsed.filter((p) => !p.created_at || now - new Date(p.created_at).getTime() <= POST_EXPIRATION_MS);
        setPosts(active);
      }
      if (savedApps) setApplications(JSON.parse(savedApps));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (hasValidCredentials) {
        const [postsRes, appsRes] = await Promise.all([
          supabase.from('squad_posts').select('*').order('created_at', { ascending: false }),
          supabase.from('squad_applications').select('*').order('created_at', { ascending: false }),
        ]);

        if (!postsRes.error && postsRes.data) {
          const expiredPosts = postsRes.data.filter((p) => p.created_at && now - new Date(p.created_at).getTime() > POST_EXPIRATION_MS);
          const activePostsData = postsRes.data.filter((p) => !p.created_at || now - new Date(p.created_at).getTime() <= POST_EXPIRATION_MS);

          // Auto-delete expired posts older than 72 hours from Supabase
          if (expiredPosts.length > 0) {
            const expiredIds = expiredPosts.map((p) => p.id);
            supabase.from('squad_posts').delete().in('id', expiredIds).then();
            supabase.from('squad_applications').delete().in('post_id', expiredIds).then();
          }

          const enrichedPosts = activePostsData.map((p) => {
            const authorEmail = p.created_by_email || p.user_email || '';
            const authorName = formatStudentName(p.created_by_name, authorEmail);
            return {
              ...p,
              created_by_name: authorName,
              created_by_email: authorEmail,
              total_members: p.total_members || (p.spots_left ? p.spots_left + 1 : 4),
            };
          });
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
        if (savedPosts) {
          const parsed = JSON.parse(savedPosts);
          const active = parsed.filter((p) => !p.created_at || now - new Date(p.created_at).getTime() <= POST_EXPIRATION_MS);
          setPosts(active);
        }
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
          fetchPostsAndApps(true);
        })
        .subscribe();

      const channelApps = supabase
        .channel('public:squad_applications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_applications' }, () => {
          fetchPostsAndApps(true);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channelPosts);
        supabase.removeChannel(channelApps);
      };
    }
  }, []);

  const handleOpenCreateModal = () => {
    setEditingPost(null);
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
    setFormError('');
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (post) => {
    setEditingPost(post);
    setFormData({
      competition_name: post.competition_name || '',
      organizer: post.organizer || '',
      competition_link: post.competition_link || '',
      phone_number: post.phone_number || '',
      title: post.title || '',
      description: post.description || '',
      skills_have: post.skills_have ? [...post.skills_have] : [],
      skills_looking_for: post.skills_looking_for ? [...post.skills_looking_for] : [],
      custom_skill_have: '',
      custom_skill_looking: '',
      total_members: post.total_members || 4,
      spots_left: post.spots_left || 1,
      course: post.course || 'BMS',
      year: post.year || '2nd Year',
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

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
    const descText = (formData.description || formData.title || '').trim();
    if (!descText) {
      setFormError('Please write a brief description for your opening.');
      return;
    }
    const cleanPostPhone = (formData.phone_number || '').replace(/\D/g, '');
    if (!cleanPostPhone || cleanPostPhone.length !== 10) {
      setFormError('Please enter a valid compulsory 10-digit WhatsApp phone number (e.g. 9876543210).');
      return;
    }

    setSubmitting(true);

    const totalMem = parseInt(formData.total_members, 10) || 4;
    const openSpots = Math.min(totalMem, parseInt(formData.spots_left, 10) || 1);

    const userCourse = user?.user_metadata?.course || 'BMS';
    const userSem = user?.user_metadata?.semester
      ? `Sem ${user.user_metadata.semester}${user?.user_metadata?.section ? ` · Sec ${user.user_metadata.section}` : ''}`
      : (user?.user_metadata?.year || '2nd Year');

    if (editingPost) {
      // ── EDIT EXISTING POST ──
      const updatePayload = {
        competition_name: formData.competition_name.trim(),
        organizer: formData.organizer.trim() || 'Corporate / Society',
        competition_link: formData.competition_link.trim(),
        phone_number: formData.phone_number.trim(),
        title: descText,
        description: descText,
        skills_have: formData.skills_have,
        skills_looking_for: formData.skills_looking_for,
        total_members: totalMem,
        initial_open_spots: openSpots,
        spots_left: openSpots,
        course: userCourse,
        year: userSem,
        is_open: openSpots > 0,
      };

      try {
        if (hasValidCredentials) {
          await supabase.from('squad_posts').update(updatePayload).eq('id', editingPost.id);
        }
      } catch (err) {
        console.warn('Supabase update post error:', err);
      }

      const updated = posts.map((p) => (p.id === editingPost.id ? { ...p, ...updatePayload } : p));
      setPosts(updated);
      localStorage.setItem('sscbs_squad_posts', JSON.stringify(updated));

      setSubmitting(false);
      setIsCreateModalOpen(false);
      setEditingPost(null);
      return;
    }

    const authorDisplayName = formatStudentName(user?.user_metadata?.full_name, user?.email);

    // ── CREATE NEW POST ──
    const postPayload = {
      user_id: user?.id,
      competition_name: formData.competition_name.trim(),
      organizer: formData.organizer.trim() || 'Corporate / Society',
      competition_link: formData.competition_link.trim(),
      phone_number: formData.phone_number.trim(),
      title: descText,
      description: descText,
      skills_have: formData.skills_have,
      skills_looking_for: formData.skills_looking_for,
      total_members: totalMem,
      initial_open_spots: openSpots,
      spots_left: openSpots,
      course: userCourse,
      year: userSem,
      is_open: openSpots > 0,
      created_by_email: user.email,
      created_by_name: authorDisplayName,
      created_at: new Date().toISOString(),
    };

    try {
      if (hasValidCredentials) {
        let res = await supabase
          .from('squad_posts')
          .insert([postPayload])
          .select();

        if (res.error) {
          console.warn('Full payload insert warning, trying core payload:', res.error);
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
            created_by_email: postPayload.created_by_email,
            created_by_name: postPayload.created_by_name,
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
    const cleanApplyPhone = (applyForm.applicant_phone || '').replace(/\D/g, '');
    if (!cleanApplyPhone || cleanApplyPhone.length !== 10) {
      setApplyError('Please enter a valid compulsory 10-digit WhatsApp phone number (e.g. 9876543210).');
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

    const userEmailLower = user?.email?.toLowerCase();
    const updatedApps = [
      appPayload,
      ...applications.filter((a) => {
        const samePost = String(a.post_id) === String(selectedPostForApply.id);
        const sameEmail = a.applicant_email && userEmailLower && a.applicant_email.toLowerCase() === userEmailLower;
        const sameId = a.id === appPayload.id;
        return !(sameId || (samePost && sameEmail));
      }),
    ];
    setApplications(updatedApps);
    localStorage.setItem('sscbs_squad_apps', JSON.stringify(updatedApps));

    setApplySubmitting(false);
    setApplySuccess('🎉 Join request submitted! The team lead will review your application.');
    setTimeout(() => {
      setSelectedPostForApply(null);
      setApplySuccess('');
    }, 2000);
  };

// ── SPOT COUNT & STATUS HELPERS ──
function getPostOpenSpots(post, applications) {
  if (!post) return 0;
  const initialOpen = parseInt(post.initial_open_spots, 10) || parseInt(post.spots_left, 10) || 1;
  const acceptedApps = (applications || []).filter(
    (a) => String(a.post_id) === String(post.id) && a.status === 'accepted'
  );
  return Math.max(0, initialOpen - acceptedApps.length);
}

function isPostOpen(post, applications) {
  if (!post) return false;
  if (post.is_closed_by_host) return false;
  return getPostOpenSpots(post, applications) > 0;
}

function getUserApp(applications, postId, userEmail, userId) {
  if (!applications || !postId) return null;
  const emailLower = userEmail ? userEmail.toLowerCase() : '';

  const matches = applications.filter((a) => {
    if (String(a.post_id) !== String(postId)) return false;
    const isEmail = a.applicant_email && emailLower && a.applicant_email.toLowerCase() === emailLower;
    const isId = a.applicant_id && userId && a.applicant_id === userId;
    return isEmail || isId;
  });

  if (matches.length === 0) return null;

  // CRITICAL RULE:
  // If ANY matching application for this user & post has status === 'removed',
  // the host removed them from the team. Return the removed application record!
  const removedApp = matches.find((m) => m.status === 'removed');
  if (removedApp) return removedApp;

  // Otherwise, sort by creation timestamp / ID descending to get latest status
  matches.sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime() || (typeof a.id === 'number' ? a.id : 0);
    const timeB = new Date(b.created_at || 0).getTime() || (typeof b.id === 'number' ? b.id : 0);
    return timeB - timeA;
  });

  return matches[0];
}

  const handleAcceptApplicant = async (app) => {
    const post = posts.find((p) => String(p.id) === String(app.post_id));
    if (!post) return;

    const appEmailLower = (app.applicant_email || '').toLowerCase();

    const updatedApps = applications.map((a) =>
      a.id === app.id || (String(a.post_id) === String(app.post_id) && a.applicant_email?.toLowerCase() === appEmailLower)
        ? { ...a, status: 'accepted' }
        : a
    );
    setApplications(updatedApps);
    localStorage.setItem('sscbs_squad_apps', JSON.stringify(updatedApps));

    const newOpenSpots = getPostOpenSpots(post, updatedApps);
    const isNowOpen = newOpenSpots > 0;

    const updatedPosts = posts.map((p) =>
      String(p.id) === String(post.id) ? { ...p, spots_left: newOpenSpots, is_open: isNowOpen } : p
    );
    setPosts(updatedPosts);
    localStorage.setItem('sscbs_squad_posts', JSON.stringify(updatedPosts));

    try {
      if (hasValidCredentials) {
        const isRealId = app.id && !String(app.id).startsWith('app-');
        if (isRealId) {
          await supabase.from('squad_applications').update({ status: 'accepted' }).eq('id', app.id);
        }
        if (app.applicant_email) {
          await supabase
            .from('squad_applications')
            .update({ status: 'accepted' })
            .eq('post_id', app.post_id)
            .ilike('applicant_email', app.applicant_email);
        }

        await supabase.from('squad_posts').update({ spots_left: newOpenSpots, is_open: isNowOpen }).eq('id', post.id);
      }
    } catch (err) {
      console.warn('Supabase status update error:', err);
    }
  };

  const handleDeclineApplicant = async (app) => {
    const appEmailLower = (app.applicant_email || '').toLowerCase();
    const updatedApps = applications.map((a) =>
      a.id === app.id || (String(a.post_id) === String(app.post_id) && a.applicant_email?.toLowerCase() === appEmailLower)
        ? { ...a, status: 'declined' }
        : a
    );
    setApplications(updatedApps);
    localStorage.setItem('sscbs_squad_apps', JSON.stringify(updatedApps));

    try {
      if (hasValidCredentials) {
        const isRealId = app.id && !String(app.id).startsWith('app-');
        if (isRealId) {
          await supabase.from('squad_applications').update({ status: 'declined' }).eq('id', app.id);
        }
        if (app.applicant_email) {
          await supabase
            .from('squad_applications')
            .update({ status: 'declined' })
            .eq('post_id', app.post_id)
            .ilike('applicant_email', app.applicant_email);
        }
      }
    } catch (err) {
      console.warn('Supabase status update error:', err);
    }
  };

  const handleRemoveAcceptedMember = async (app) => {
    const post = posts.find((p) => String(p.id) === String(app.post_id));
    if (!post) return;

    const appEmailLower = (app.applicant_email || '').toLowerCase();

    const updatedApps = applications.map((a) => {
      const isMatch = a.id === app.id ||
        (String(a.post_id) === String(app.post_id) && a.applicant_email?.toLowerCase() === appEmailLower) ||
        (app.applicant_id && String(a.post_id) === String(app.post_id) && a.applicant_id === app.applicant_id);
      return isMatch ? { ...a, status: 'removed' } : a;
    });

    setApplications(updatedApps);
    localStorage.setItem('sscbs_squad_apps', JSON.stringify(updatedApps));

    const newOpenSpots = getPostOpenSpots(post, updatedApps);
    const isNowOpen = newOpenSpots > 0;

    const updatedPosts = posts.map((p) =>
      String(p.id) === String(post.id) ? { ...p, spots_left: newOpenSpots, is_open: isNowOpen } : p
    );
    setPosts(updatedPosts);
    localStorage.setItem('sscbs_squad_posts', JSON.stringify(updatedPosts));

    try {
      if (hasValidCredentials) {
        const isRealId = app.id && !String(app.id).startsWith('app-');
        if (isRealId) {
          await supabase.from('squad_applications').update({ status: 'removed' }).eq('id', app.id);
        }
        if (app.applicant_email) {
          await supabase
            .from('squad_applications')
            .update({ status: 'removed' })
            .eq('post_id', app.post_id)
            .ilike('applicant_email', app.applicant_email);
        }
        if (app.applicant_id) {
          await supabase
            .from('squad_applications')
            .update({ status: 'removed' })
            .eq('post_id', app.post_id)
            .eq('applicant_id', app.applicant_id);
        }

        await supabase.from('squad_posts').update({ spots_left: newOpenSpots, is_open: isNowOpen }).eq('id', post.id);
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

  // Counts
  const myPosts = posts.filter(
    (p) => p.created_by_email === user?.email || p.user_id === user?.id
  );
  const otherPosts = posts.filter(
    (p) => p.created_by_email !== user?.email && p.user_id !== user?.id
  );
  const myPostsCount = myPosts.length;
  const otherPostsCount = otherPosts.length;

  // Pending incoming requests across all user's posts
  const myPostIds = new Set(myPosts.map((p) => String(p.id)));
  const pendingRequestsCount = applications.filter(
    (a) => myPostIds.has(String(a.post_id)) && a.status === 'pending'
  ).length;

  // Filtering
  const filteredPosts = posts.filter((post) => {
    const isMyPost = post.created_by_email === user?.email || post.user_id === user?.id;

    if (activeTab === 'my' && !isMyPost) return false;
    if (activeTab === 'other' && isMyPost) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (post.competition_name || '').toLowerCase().includes(q) ||
        (post.organizer || '').toLowerCase().includes(q) ||
        (post.title || '').toLowerCase().includes(q) ||
        (post.skills_looking_for || []).some((s) => s.toLowerCase().includes(q)) ||
        (post.skills_have || []).some((s) => s.toLowerCase().includes(q));

      if (!matchesSearch) return false;
    }

    return true;
  });

  if (!hasAccess) {
    return (
      <div className="team-finder-container">
        <div className="admin-restricted-card">
          <div className="restricted-badge">
            <ShieldIcon size={18} />
            <span>Beta Restricted</span>
          </div>
          <h2>Team Finder & Competition Hub</h2>
          <p>
            This feature is currently in private beta testing.
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

        <div className="tf-header-actions">
          <button
            className={`btn-tf-secondary btn-refresh-listings ${isRefreshing ? 'refreshing' : ''}`}
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Fetch latest team openings and peer requests"
          >
            <RefreshIcon size={14} className={isRefreshing ? 'spin-icon' : ''} />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh Listings'}</span>
          </button>

          <button className="btn-tf-primary" onClick={handleOpenCreateModal}>
            <UsersIcon size={16} />
            <span>Post Team Opening</span>
          </button>
        </div>
      </header>

      {/* ── Teaming Guidelines & Auto-Cleanup Banner ── */}
      <div className="tf-cleanup-notice">
        <div className="cleanup-notice-icon">🧹</div>
        <div className="cleanup-notice-text">
          <strong>Teaming Guidelines:</strong> Please delete your listing once your squad is sorted! To keep the feed fresh and prevent piling up, listings auto-delete after <strong>72 hours (3 days)</strong>.
        </div>
      </div>

      {/* ── Refresh Tip Banner ── */}
      <div className="tf-refresh-tip">
        <span>💡 Been on this page for a while? Click <strong>Refresh Listings</strong> above to see recent moves by peers!</span>
        {refreshToast && <span className="refresh-toast-msg">{refreshToast}</span>}
      </div>

      {/* ── Tab Switcher & Search Bar ── */}
      <div className="tf-controls-bar">
        <div className="tf-tab-switcher">
          <button
            className={`tf-tab-btn ${activeTab === 'my' ? 'active' : ''}`}
            onClick={() => setActiveTab('my')}
          >
            <span>📌 My Listings</span>
            <span className="tf-tab-count">{myPostsCount}</span>
            {pendingRequestsCount > 0 && (
              <span className="tf-tab-pending-badge" title={`${pendingRequestsCount} pending applicant request(s)`}>
                {pendingRequestsCount} new
              </span>
            )}
          </button>
          <button
            className={`tf-tab-btn ${activeTab === 'other' ? 'active' : ''}`}
            onClick={() => setActiveTab('other')}
          >
            <span>🌐 Other Listings</span>
            <span className="tf-tab-count">{otherPostsCount}</span>
          </button>
        </div>

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
          {searchQuery ? (
            <>
              <h3>No matching listings found</h3>
              <p>No team listings match "{searchQuery}" under {activeTab === 'my' ? 'My Listings' : 'Other Listings'}.</p>
              <button className="btn-tf-secondary" onClick={() => setSearchQuery('')} style={{ marginTop: '1rem' }}>
                Clear Search
              </button>
            </>
          ) : activeTab === 'my' ? (
            <>
              <h3>You haven't posted any team openings yet</h3>
              <p>Post a team opening to find complementary teammates for upcoming competitions!</p>
              <button className="btn-tf-primary" onClick={handleOpenCreateModal} style={{ marginTop: '1rem' }}>
                <UsersIcon size={16} /> Post Team Opening
              </button>
            </>
          ) : (
            <>
              <h3>No other team listings available right now</h3>
              <p>Be the first to create a team opening for your squad!</p>
              <button className="btn-tf-primary" onClick={handleOpenCreateModal} style={{ marginTop: '1rem' }}>
                <UsersIcon size={16} /> Post Team Opening
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="tf-posts-grid">
          {filteredPosts.map((post) => {
            const isHost = post.created_by_email === user?.email || post.user_id === user?.id;
            const postApps = applications.filter((a) => a.post_id === post.id);
            const pendingAppsCount = postApps.filter((a) => a.status === 'pending').length;
            
            // Check if current user has already applied
            const userApp = getUserApp(applications, post.id, user?.email, user?.id);
            const openSpots = getPostOpenSpots(post, applications);
            const openStatus = isPostOpen(post, applications);

            return (
              <div key={post.id} className={`tf-post-card ${!openStatus ? 'closed' : ''}`}>
                <div className="card-top-bar">
                  <span className="comp-organizer">{post.organizer || 'Corporate / Society'}</span>
                  <div className="card-top-right">
                    {renderSquadDots(post.total_members || 4, openSpots, openStatus)}
                    {isAdmin && (
                      <div className="tf-admin-menu-wrapper">
                        <button
                          className={`tf-admin-dots-btn ${activeAdminMenuPostId === post.id ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveAdminMenuPostId(activeAdminMenuPostId === post.id ? null : post.id);
                          }}
                          title="Admin Moderation Menu"
                        >
                          <MoreVerticalIcon size={16} />
                        </button>
                        {activeAdminMenuPostId === post.id && (
                          <div className="tf-admin-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                            <div className="tf-admin-menu-header">
                              <ShieldIcon size={12} />
                              <span>Admin Moderation</span>
                            </div>
                            <button
                              className="tf-admin-menu-item"
                              onClick={() => {
                                setActiveAdminMenuPostId(null);
                                setSelectedPostForReview(post);
                              }}
                            >
                              <MailIcon size={13} /> Review Requests ({postApps.length})
                            </button>
                            <button
                              className="tf-admin-menu-item"
                              onClick={() => {
                                setActiveAdminMenuPostId(null);
                                handleToggleStatus(post.id, openStatus);
                              }}
                            >
                              {openStatus ? 'Close Listing' : 'Reopen Listing'}
                            </button>
                            <button
                              className="tf-admin-menu-item danger"
                              onClick={() => {
                                setActiveAdminMenuPostId(null);
                                handleDeletePost(post.id);
                              }}
                            >
                              Delete Listing
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <h2 className="comp-name">{post.competition_name}</h2>

                {post.competition_link && (
                  <a
                    href={post.competition_link.startsWith('http') ? post.competition_link : `https://${post.competition_link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="comp-link-blue"
                  >
                    Click to visit ↗
                  </a>
                )}

                {/* User Application Status Callout Banner */}
                {userApp && !isHost && (
                  <div className={`user-app-banner ${userApp.status}`}>
                    <div className="user-app-banner-icon">
                      {userApp.status === 'accepted' ? '🎉' : userApp.status === 'declined' ? '❌' : userApp.status === 'removed' ? '⚠️' : '⏳'}
                    </div>
                    <div className="user-app-banner-content">
                      <span className="user-app-banner-title">
                        {userApp.status === 'accepted'
                          ? 'Accepted into Squad'
                          : userApp.status === 'declined'
                          ? 'Application Declined'
                          : userApp.status === 'removed'
                          ? 'Removed from Squad'
                          : 'Request Pending Review'}
                      </span>
                      <span className="user-app-banner-sub">
                        {userApp.status === 'accepted'
                          ? 'You are part of this team! Connect on WhatsApp below.'
                          : userApp.status === 'declined'
                          ? 'The host declined your request.'
                          : userApp.status === 'removed'
                          ? 'You were removed from this squad by the host.'
                          : 'The team lead is reviewing your application.'}
                      </span>
                    </div>
                  </div>
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

                {/* Card Footer */}
                {(() => {
                  const authorName = formatStudentName(post.created_by_name, post.created_by_email);
                  const avatarChar = (authorName || 'S').charAt(0).toUpperCase();

                  return (
                    <div className="card-footer">
                      <div className="creator-info">
                        <span className="creator-avatar">
                          {avatarChar}
                        </span>
                        <span className="creator-details">
                          <span className="creator-name">{authorName}</span>
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
                              onClick={() => handleOpenEditModal(post)}
                              title="Edit Listing Details"
                            >
                              Edit
                            </button>
                            <button
                              className="btn-card-subtle"
                              onClick={() => handleToggleStatus(post.id, openStatus)}
                            >
                              {openStatus ? 'Close' : 'Reopen'}
                            </button>
                            <button
                              className="btn-card-subtle danger"
                              onClick={() => handleDeletePost(post.id)}
                              title="Delete Post"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          /* Peer Student Controls (Visible to everyone including Admins) */
                          <>
                            {post.phone_number && (
                              <a
                                href={formatWhatsAppUrl(post.phone_number, `Hi! Saw your team post for ${post.competition_name} on SSCBS OS.`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="wa-connect-btn"
                                title="Direct WhatsApp Connect"
                              >
                                <WhatsAppIcon size={14} /> WhatsApp
                              </a>
                            )}

                            {openStatus && (!userApp || userApp.status === 'declined' || userApp.status === 'removed') && (
                              <button
                                className="btn-tf-primary"
                                onClick={() => handleOpenApplyModal(post)}
                              >
                                <MailIcon size={13} /> {userApp ? 'Re-apply to Join' : 'Request to Join'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT POST MODAL ── */}
      {isCreateModalOpen && (
        <div className="tf-modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="tf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tf-modal-header">
              <div>
                <h3>{editingPost ? 'Edit Squad Listing' : 'Post Team Opening'}</h3>
                <p className="tf-modal-subtitle">
                  {editingPost ? 'Update competition details & team requirements' : 'Find complementary teammates for your competition squad'}
                </p>
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
                  <label>WhatsApp / Contact Phone (10 Digits) *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit number (e.g. 9876543210)"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  />
                </div>
              </div>

              <div className="tf-form-group">
                <label>Brief description, anything you want to state, etc *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Describe your team opening, requirements, strategy, or anything you want to state..."
                  value={formData.description || formData.title}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value, title: e.target.value })}
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
                  {submitting ? 'Saving…' : editingPost ? 'Update Opening' : 'Publish Opening'}
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
                <label>Your WhatsApp / Contact Phone (10 Digits) *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10-digit phone (e.g. 9876543210)"
                  value={applyForm.applicant_phone}
                  onChange={(e) => setApplyForm({ ...applyForm, applicant_phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
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
                  {selectedPostForReview.competition_name} • {getPostOpenSpots(selectedPostForReview, applications)} open spot(s)
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
                            {app.status === 'accepted' ? '✓ Accepted' : app.status === 'declined' ? 'Declined' : app.status === 'removed' ? 'Removed' : 'Pending'}
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
                              href={formatWhatsAppUrl(app.applicant_phone, `Hi ${app.applicant_name}! Regarding your request to join our squad for ${selectedPostForReview.competition_name}.`)}
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
