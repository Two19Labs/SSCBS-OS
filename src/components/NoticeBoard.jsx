import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import { isAdminEmail } from '../lib/admin';
import './NoticeBoard.css';

export default function NoticeBoard({ onNavigate, compact = false }) {
  const { user } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSeenTime, setLastSeenTime] = useState(() => {
    const saved = localStorage.getItem('sscbs_last_seen_notice_time');
    return saved ? Number(saved) : 0;
  });

  const newNoticesCount = notices.filter(notice => {
    if (!notice.created_at) return false;
    const noticeTime = new Date(notice.created_at).getTime();
    const baseline = lastSeenTime || (Date.now() - 48 * 3600 * 1000);
    return noticeTime > baseline;
  }).length;

  const handleMarkAllSeen = () => {
    const now = Date.now();
    localStorage.setItem('sscbs_last_seen_notice_time', String(now));
    setLastSeenTime(now);
  };

  const isNoticeNew = (notice) => {
    if (!notice.created_at) return false;
    const noticeTime = new Date(notice.created_at).getTime();
    const baseline = lastSeenTime || (Date.now() - 48 * 3600 * 1000);
    return noticeTime > baseline;
  };

  // Drafter state & auto-dismiss after 3 minutes (180,000 ms) of being seen
  const [isApprovedDrafter, setIsApprovedDrafter] = useState(false);
  const [myDrafts, setMyDrafts] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ type: '', text: '' });
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    category: 'Event',
    society: '',
    venue: '',
    content: '',
    link_url: '',
    event_date: '',
    active_from: '',
    active_to: '',
  });

  const THREE_MINUTES_MS = 3 * 60 * 1000;

  useEffect(() => {
    if (!myDrafts || myDrafts.length === 0) return;

    const currentTime = Date.now();
    myDrafts.forEach((draft) => {
      const key = `sscbs_submission_seen_${draft.id}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, String(currentTime));
      }
    });

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 5000);

    return () => clearInterval(interval);
  }, [myDrafts]);

  const handleDismissDraft = (draftId) => {
    localStorage.setItem(`sscbs_submission_seen_${draftId}`, '0');
    setNow(Date.now());
  };

  const visibleMyDrafts = myDrafts.filter((draft) => {
    const key = `sscbs_submission_seen_${draft.id}`;
    const seenAt = localStorage.getItem(key);
    if (!seenAt) return true;
    return (now - Number(seenAt)) < THREE_MINUTES_MS;
  });

  const userEmail = user?.email || '';
  const isAdmin = isAdminEmail(userEmail);

  const sortNotices = (list) => {
    return [...list].sort((a, b) => {
      const orderA = a.display_order ?? 0;
      const orderB = b.display_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  };

  const filterActiveNotices = (rawNotices) => {
    const now = new Date();
    return (rawNotices || []).filter(notice => {
      // Must be published (or legacy notice without status)
      if (notice.status && notice.status !== 'published') {
        return false;
      }
      if (notice.active_from && new Date(notice.active_from) > now) {
        return false;
      }
      if (notice.active_to && new Date(notice.active_to) < now) {
        return false;
      }
      return true;
    });
  };

  const checkDrafterStatus = async () => {
    if (isAdmin) {
      setIsApprovedDrafter(true);
      return;
    }
    if (!userEmail) return;

    try {
      if (!hasValidCredentials) {
        const localReq = localStorage.getItem(`sscbs_drafter_req_${userEmail}`);
        if (localReq) {
          const parsed = JSON.parse(localReq);
          setIsApprovedDrafter(parsed.status === 'approved');
        }
        return;
      }

      const { data, error } = await supabase
        .from('notice_drafter_requests')
        .select('status')
        .eq('user_email', userEmail)
        .maybeSingle();

      if (!error && data) {
        setIsApprovedDrafter(data.status === 'approved');
      }
    } catch (err) {
      console.warn('Error checking drafter status:', err);
    }
  };

  const fetchMyDrafts = async () => {
    if (!userEmail) return;
    try {
      if (!hasValidCredentials) {
        const localDrafts = localStorage.getItem(`sscbs_user_drafts_${userEmail}`);
        if (localDrafts) setMyDrafts(JSON.parse(localDrafts));
        return;
      }

      const { data, error } = await supabase
        .from('notices')
        .select('id, title, category, society, venue, content, link_url, event_date, active_from, active_to, created_at, created_by_email, created_by_name, display_order, status')
        .eq('created_by_email', userEmail)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMyDrafts(data);
      }
    } catch (err) {
      console.warn('Error fetching my notice drafts:', err);
    }
  };

  const fetchNotices = async (force = false) => {
    try {
      if (!force) {
        const cached = sessionStorage.getItem('sscbs_cached_notices');
        const cachedTime = sessionStorage.getItem('sscbs_cached_notices_time');
        if (cached && cachedTime && (Date.now() - Number(cachedTime)) < 30000) {
          try {
            setNotices(JSON.parse(cached));
            setLoading(false);
            return;
          } catch (e) {}
        }
      }

      setLoading(true);
      if (!hasValidCredentials) {
        setNotices([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notices')
        .select('id, title, category, society, venue, content, link_url, event_date, active_from, active_to, created_at, created_by_email, created_by_name, display_order, status')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading notices from Supabase:', error);
        setNotices([]);
      } else {
        const activeNotices = filterActiveNotices(sortNotices(data || []));
        setNotices(activeNotices);
        sessionStorage.setItem('sscbs_cached_notices', JSON.stringify(activeNotices));
        sessionStorage.setItem('sscbs_cached_notices_time', String(Date.now()));
      }
    } catch (err) {
      console.error('Failed to fetch notices:', err);
      setNotices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
    checkDrafterStatus();

    const handleLocalNoticeUpdate = () => {
      fetchNotices(true);
    };
    window.addEventListener('sscbs-notices-updated', handleLocalNoticeUpdate);

    if (hasValidCredentials) {
      const channel = supabase
        .channel('public:notices')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
          fetchNotices(true);
          fetchMyDrafts();
        })
        .subscribe();

      return () => {
        window.removeEventListener('sscbs-notices-updated', handleLocalNoticeUpdate);
        supabase.removeChannel(channel);
      };
    }
    return () => {
      window.removeEventListener('sscbs-notices-updated', handleLocalNoticeUpdate);
    };
  }, [userEmail]);

  useEffect(() => {
    if (isApprovedDrafter) {
      fetchMyDrafts();
    }
  }, [isApprovedDrafter, userEmail]);

  const handleSubmitNoticeDraft = async (e) => {
    e.preventDefault();
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) {
      setSubmitStatus({ type: 'error', text: 'Title and description content are required.' });
      return;
    }

    setSubmitting(true);
    setSubmitStatus({ type: '', text: '' });

    const newStatus = isAdmin ? 'published' : 'pending';
    const payload = {
      title: noticeForm.title.trim(),
      category: noticeForm.category || 'Event',
      society: noticeForm.society.trim() || null,
      venue: noticeForm.venue.trim() || null,
      content: noticeForm.content.trim(),
      link_url: noticeForm.link_url.trim() || null,
      event_date: noticeForm.event_date ? new Date(noticeForm.event_date).toISOString() : null,
      active_from: noticeForm.active_from ? new Date(noticeForm.active_from).toISOString() : null,
      active_to: noticeForm.active_to ? new Date(noticeForm.active_to).toISOString() : null,
      status: newStatus,
      created_by_email: userEmail,
      created_by_name: user?.user_metadata?.full_name || userEmail.split('@')[0],
      created_at: new Date().toISOString()
    };

    try {
      if (!hasValidCredentials) {
        const localDrafts = JSON.parse(localStorage.getItem(`sscbs_user_drafts_${userEmail}`) || '[]');
        const mockDraft = { ...payload, id: `mock-${Date.now()}` };
        const updated = [mockDraft, ...localDrafts];
        localStorage.setItem(`sscbs_user_drafts_${userEmail}`, JSON.stringify(updated));
        setMyDrafts(updated);
        if (isAdmin) setNotices(prev => [mockDraft, ...prev]);
        setSubmitStatus({ type: 'success', text: isAdmin ? 'Notice published live!' : 'Notice draft submitted to Admin for approval!' });
        setTimeout(() => {
          setShowDraftModal(false);
          setNoticeForm({ title: '', category: 'Event', society: '', venue: '', content: '', link_url: '', event_date: '', active_from: '', active_to: '' });
        }, 1200);
        return;
      }

      const { data, error } = await supabase
        .from('notices')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setMyDrafts(prev => [data, ...prev]);
      }
      setSubmitStatus({ 
        type: 'success', 
        text: isAdmin ? 'Notice published live!' : 'Notice draft submitted successfully to Admin for approval!' 
      });
      fetchNotices(true);
      setTimeout(() => {
        setShowDraftModal(false);
        setNoticeForm({ title: '', category: 'Event', society: '', venue: '', content: '', link_url: '', event_date: '', active_from: '', active_to: '' });
      }, 1200);
    } catch (err) {
      console.error('Failed to submit notice draft:', err);
      setSubmitStatus({ type: 'error', text: err.message || 'Failed to submit notice draft. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatEventDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <section className="notice-board-container">
      <div className="notice-board-header">
        <div className="title-area">
          <h3>Campus Buzz & Notice Board</h3>
          <p className="notice-board-subtitle">Stay updated with the latest notices and activities across SSCBS.</p>
        </div>
        {isApprovedDrafter && (
          <button 
            className="btn-create-notice-draft"
            onClick={() => {
              setSubmitStatus({ type: '', text: '' });
              setShowDraftModal(true);
            }}
          >
            <span className="btn-icon">➕</span> Draft Campus Notice
          </button>
        )}
      </div>

      {/* Top New Notices Banner */}
      {newNoticesCount > 0 && (
        <div className="new-notices-banner">
          <div className="new-notices-banner-info">
            <span className="new-notice-pulse-dot"></span>
            <span className="new-notices-title">⚡ New notices!</span>
            <span className="new-notices-count">{newNoticesCount} new {newNoticesCount === 1 ? 'notice' : 'notices'} available</span>
          </div>
          <button className="btn-mark-seen" onClick={handleMarkAllSeen}>
            Mark as read ✓
          </button>
        </div>
      )}

      {/* Drafter Modal */}
      {showDraftModal && (
        <div className="notice-modal-backdrop" onClick={() => setShowDraftModal(false)}>
          <div className="notice-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="notice-modal-header">
              <h4>📢 Draft Campus Notice</h4>
              <button className="btn-modal-close" onClick={() => setShowDraftModal(false)}>✕</button>
            </div>
            {submitStatus.text && (
              <div className={`notice-alert ${submitStatus.type}`}>
                {submitStatus.text}
              </div>
            )}
            <form className="notice-draft-form" onSubmit={handleSubmitNoticeDraft}>
              <div className="form-row-2col">
                <label>
                  <span>Title *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Blood Donation Drive"
                    value={noticeForm.title}
                    onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  />
                </label>
                <label>
                  <span>Category</span>
                  <select
                    value={noticeForm.category}
                    onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value })}
                  >
                    <option value="Event">Event</option>
                    <option value="Session">Session</option>
                    <option value="Society">Society</option>
                    <option value="Academic">Academic</option>
                  </select>
                </label>
              </div>

              <div className="form-row-2col">
                <label>
                  <span>Society / Department Name</span>
                  <input
                    type="text"
                    placeholder="e.g. Rotaract"
                    value={noticeForm.society}
                    onChange={(e) => setNoticeForm({ ...noticeForm, society: e.target.value })}
                  />
                </label>
                <label>
                  <span>Venue</span>
                  <input
                    type="text"
                    placeholder="e.g. Auditorium, Room 408, Google Meet"
                    value={noticeForm.venue}
                    onChange={(e) => setNoticeForm({ ...noticeForm, venue: e.target.value })}
                  />
                </label>
              </div>

              <div className="form-row-2col">
                <label>
                  <span>Event Date & Time</span>
                  <input
                    type="datetime-local"
                    value={noticeForm.event_date}
                    onChange={(e) => setNoticeForm({ ...noticeForm, event_date: e.target.value })}
                  />
                </label>
                <label>
                  <span>Registration / Info Link URL</span>
                  <input
                    type="url"
                    placeholder="https://forms.gle/..."
                    value={noticeForm.link_url}
                    onChange={(e) => setNoticeForm({ ...noticeForm, link_url: e.target.value })}
                  />
                </label>
              </div>

              <div className="form-row-2col">
                <label>
                  <span>Display From (Optional)</span>
                  <input
                    type="datetime-local"
                    value={noticeForm.active_from}
                    onChange={(e) => setNoticeForm({ ...noticeForm, active_from: e.target.value })}
                  />
                </label>
                <label>
                  <span>Display Until (Optional)</span>
                  <input
                    type="datetime-local"
                    value={noticeForm.active_to}
                    onChange={(e) => setNoticeForm({ ...noticeForm, active_to: e.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>Notice Description / Details *</span>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide complete details about the event, rules, eligibility, or guidelines..."
                  value={noticeForm.content}
                  onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowDraftModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit-draft" disabled={submitting}>
                  {submitting ? 'Submitting Draft...' : isAdmin ? 'Publish Notice Live' : 'Submit Draft for Admin Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* My Submissions for Drafters (Auto-disappears 3 mins after first seen) */}
      {isApprovedDrafter && visibleMyDrafts.length > 0 && (
        <div className="my-drafts-section">
          <h4 className="my-drafts-title">📋 My Notice Submissions ({visibleMyDrafts.length})</h4>
          <div className="my-drafts-grid">
            {visibleMyDrafts.map((draft) => (
              <div key={draft.id} className={`my-draft-card ${draft.status || 'published'}`}>
                <div className="draft-card-head">
                  <span className="draft-title">{draft.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`draft-status-pill ${draft.status || 'published'}`}>
                      {draft.status === 'published' && '✅ Approved & Live'}
                      {draft.status === 'pending' && '⏳ Pending Review'}
                      {draft.status === 'rejected' && '❌ Declined'}
                    </span>
                    <button
                      type="button"
                      className="draft-dismiss-btn"
                      title="Dismiss notice status"
                      onClick={() => handleDismissDraft(draft.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {draft.society && <div className="draft-meta">Society: {draft.society}</div>}
                <div className="draft-date">Submitted: {formatDate(draft.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public Notices Feed */}
      {loading ? (
        <div className="notice-board-loading">
          <span className="notice-spinner"></span>
          <p>Fetching campus notices...</p>
        </div>
      ) : notices.length === 0 ? (
        <div className="notice-board-empty">
          <div className="empty-icon">📢</div>
          <p>No active notices found.</p>
        </div>
      ) : (
        <div className="notice-grid">
          {notices.map(notice => (
            <div key={notice.id} className="notice-card">
              <div className="notice-card-header">
                <div className="notice-header-left">
                  {notice.society ? (
                    <div className="notice-society">
                      <span className="society-avatar">
                        {notice.society.charAt(0).toUpperCase()}
                      </span>
                      <span className="society-name">{notice.society}</span>
                    </div>
                  ) : (
                    <span className="notice-badge-announcement">ANNOUNCEMENT</span>
                  )}
                  {isNoticeNew(notice) && (
                    <span className="notice-badge-new">NEW</span>
                  )}
                </div>
                <span className="notice-date">{formatDate(notice.created_at)}</span>
              </div>
              
              <h4 className="notice-title">{notice.title}</h4>
              
              {(notice.event_date || notice.venue) && (
                <div className="notice-details-row">
                  {notice.event_date && (
                    <div className="notice-event-time">
                      <span className="event-time-icon">📅</span>
                      <span className="event-time-value">{formatEventDate(notice.event_date)}</span>
                    </div>
                  )}
                  {notice.venue && (
                    <div className="notice-venue">
                      <span className="venue-icon">📍</span>
                      <span className="venue-value">{notice.venue}</span>
                    </div>
                  )}
                </div>
              )}
              
              {notice.content && (
                <p className={`notice-content ${compact ? 'compact' : 'full'}`}>
                  {compact && notice.content.length > 110
                    ? notice.content.slice(0, 110).trim() + '...'
                    : notice.content}
                </p>
              )}
              
              <div className="notice-card-footer">
                {compact && notice.content && notice.content.length > 110 && (
                  <button 
                    className="btn-read-full-notice" 
                    onClick={() => {
                      if (onNavigate) {
                        onNavigate('buzz');
                      }
                    }}
                  >
                    Read full notice →
                  </button>
                )}
                {notice.link_url && (
                  <a 
                    href={notice.link_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn-notice-action"
                  >
                    Link
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="arrow-icon">
                      <line x1="7" y1="17" x2="17" y2="7"></line>
                      <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
