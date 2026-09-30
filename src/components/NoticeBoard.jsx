import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import { isAdminEmail } from '../lib/admin';
import { trackNoticeEvent } from '../lib/analytics';
import { parseNoticeText, SAMPLE_WHATSAPP_NOTICE } from '../utils/noticeParser';
import { MOBILE_V2 } from '../lib/uiFlags';
import { useIsMobile } from '../hooks/useIsMobile';
import BottomSheet from './BottomSheet';
import './NoticeBoard.css';

export default function NoticeBoard({ onNavigate, compact = false }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [selectedCategory, setSelectedCategory] = useState('All');
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

  const filteredNotices = notices.filter(n => {
    if (selectedCategory === 'All') return true;
    return (n.category || '').toLowerCase() === selectedCategory.toLowerCase();
  });

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

  const [rawNoticeText, setRawNoticeText] = useState('');
  const [parseFeedback, setParseFeedback] = useState(null);

  const handleSmartAutoFillNotice = () => {
    if (!rawNoticeText.trim()) return;
    const parsed = parseNoticeText(rawNoticeText);
    if (!parsed) return;

    setNoticeForm(prev => ({
      ...prev,
      title: parsed.title || prev.title,
      society: parsed.society || prev.society,
      venue: parsed.venue || prev.venue,
      content: parsed.content || prev.content,
      link_url: parsed.link_url || prev.link_url,
      category: parsed.category || prev.category,
      event_date: parsed.event_date || prev.event_date,
      active_from: parsed.active_from || prev.active_from,
      active_to: parsed.active_to || prev.active_to,
    }));

    setParseFeedback({
      type: 'success',
      message: `Extracted ${parsed.extractedFields.length} fields successfully!`,
      fields: parsed.extractedFields
    });
  };

  const handleTrySampleNotice = () => {
    setRawNoticeText(SAMPLE_WHATSAPP_NOTICE);
    const parsed = parseNoticeText(SAMPLE_WHATSAPP_NOTICE);
    if (parsed) {
      setNoticeForm(prev => ({
        ...prev,
        title: parsed.title || prev.title,
        society: parsed.society || prev.society,
        venue: parsed.venue || prev.venue,
        content: parsed.content || prev.content,
        link_url: parsed.link_url || prev.link_url,
        category: parsed.category || prev.category,
        event_date: parsed.event_date || prev.event_date,
        active_from: parsed.active_from || prev.active_from,
        active_to: parsed.active_to || prev.active_to,
      }));
      setParseFeedback({
        type: 'success',
        message: 'Sample notice loaded & all fields auto-filled!',
        fields: parsed.extractedFields
      });
    }
  };

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

      const timeA = a.event_date ? new Date(a.event_date).getTime() : (a.active_from ? new Date(a.active_from).getTime() : Infinity);
      const timeB = b.event_date ? new Date(b.event_date).getTime() : (b.active_from ? new Date(b.active_from).getTime() : Infinity);

      if (timeA !== timeB) return timeA - timeB;

      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
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
        // 5-minute cache TTL (Realtime channel invalidates & forces refresh on new notices)
        if (cached && cachedTime && (Date.now() - Number(cachedTime)) < 300000) {
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
        .order('event_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

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
          setRawNoticeText('');
          setParseFeedback(null);
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
        setRawNoticeText('');
        setParseFeedback(null);
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
              setRawNoticeText('');
              setParseFeedback(null);
              setShowDraftModal(true);
            }}
          >
            <span className="btn-icon">➕</span> Draft Campus Notice
          </button>
        )}
      </div>

      {/* Category Filter Badges */}
      <div className="notice-filters">
        {['All', 'Event', 'Session', 'Society', 'Academic'].map(cat => (
          <button
            key={cat}
            type="button"
            className={`filter-badge ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Top New Notices Banner */}
      {newNoticesCount > 0 && (
        <div className="new-notices-banner">
          <div className="new-notices-banner-info">
            <span className="new-notice-pulse-dot"></span>
            <span className="new-notices-title">● {newNoticesCount} new since your last visit</span>
          </div>
          <button className="btn-mark-seen" onClick={handleMarkAllSeen}>
            Mark read
          </button>
        </div>
      )}

      {/* Drafter Modal (Desktop Dialog or Mobile BottomSheet Screen 16) */}
      {showDraftModal && (
        MOBILE_V2 && isMobile ? (
          <BottomSheet
            isOpen={showDraftModal}
            onClose={() => setShowDraftModal(false)}
            title="Draft a notice"
            fullHeight={true}
          >
            <div className="m-draft-body">
              {submitStatus.text && (
                <div className={`notice-alert ${submitStatus.type}`}>
                  {submitStatus.text}
                </div>
              )}

              {/* Quick Paste Card (Screen 16) */}
              <div className="m-quick-paste-card">
                <span className="m-quick-paste-title">Quick paste</span>
                <span className="m-quick-paste-desc">Paste a WhatsApp forward or circular and we'll fill the fields.</span>
                <textarea
                  rows={3}
                  placeholder="Paste message here…"
                  value={rawNoticeText}
                  onChange={(e) => setRawNoticeText(e.target.value)}
                  className="m-quick-paste-textarea"
                />
                <div className="m-quick-paste-btns">
                  <button
                    type="button"
                    className="m-btn-dark"
                    onClick={handleSmartAutoFillNotice}
                    disabled={!rawNoticeText.trim()}
                  >
                    Auto-fill
                  </button>
                  <button
                    type="button"
                    className="m-btn-outline"
                    onClick={handleTrySampleNotice}
                  >
                    Try a sample
                  </button>
                </div>
              </div>

              <form className="m-draft-form" onSubmit={handleSubmitNoticeDraft}>
                <div className="m-form-field">
                  <span className="m-label-cap">TITLE</span>
                  <input
                    type="text"
                    required
                    className="m-field-input"
                    placeholder="e.g. Blood Donation Drive"
                    value={noticeForm.title}
                    onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  />
                </div>

                <div className="m-form-field">
                  <span className="m-label-cap">CATEGORY</span>
                  <div className="m-pills-row">
                    {['Event', 'Session', 'Society', 'Academic'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`m-chip ${noticeForm.category === cat ? 'active' : ''}`}
                        onClick={() => setNoticeForm({ ...noticeForm, category: cat })}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="m-form-field">
                  <span className="m-label-cap">SOCIETY</span>
                  <input
                    type="text"
                    className="m-field-input"
                    placeholder="e.g. Rotaract"
                    value={noticeForm.society}
                    onChange={(e) => setNoticeForm({ ...noticeForm, society: e.target.value })}
                  />
                </div>

                <div className="m-form-field">
                  <span className="m-label-cap">VENUE</span>
                  <input
                    type="text"
                    className="m-field-input"
                    placeholder="e.g. Auditorium"
                    value={noticeForm.venue}
                    onChange={(e) => setNoticeForm({ ...noticeForm, venue: e.target.value })}
                  />
                </div>

                <div className="m-form-field">
                  <span className="m-label-cap">DATE & TIME</span>
                  <input
                    type="datetime-local"
                    className="m-field-input"
                    value={noticeForm.event_date}
                    onChange={(e) => setNoticeForm({ ...noticeForm, event_date: e.target.value })}
                  />
                </div>

                <div className="m-form-field">
                  <span className="m-label-cap">REGISTRATION / LINK URL</span>
                  <input
                    type="url"
                    className="m-field-input"
                    placeholder="https://..."
                    value={noticeForm.link_url}
                    onChange={(e) => setNoticeForm({ ...noticeForm, link_url: e.target.value })}
                  />
                </div>

                <div className="m-form-field">
                  <span className="m-label-cap">DESCRIPTION *</span>
                  <textarea
                    rows={3}
                    required
                    className="m-field-input m-textarea"
                    placeholder="Provide details about the event, rules, eligibility..."
                    value={noticeForm.content}
                    onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                  />
                </div>

                <div className="m-draft-submit-wrap">
                  <button type="submit" className="m-btn-primary" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit for approval'}
                  </button>
                </div>
              </form>
            </div>
          </BottomSheet>
        ) : (
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

            {/* 🪄 Smart WhatsApp & Announcement Auto-Fill Parser */}
            <div className="admin-notice-smart-parser">
              <div className="smart-parser-header">
                <div className="smart-parser-title">
                  <span className="smart-parser-icon">🪄</span>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Quick Paste & Auto-Fill</h4>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.3 }}>
                      Paste any WhatsApp forward, email, or circular to auto-fill all notice fields instantly.
                    </p>
                  </div>
                </div>
                {rawNoticeText && (
                  <button
                    type="button"
                    className="btn-clear-raw-text"
                    onClick={() => {
                      setRawNoticeText('');
                      setParseFeedback(null);
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="smart-parser-body">
                <textarea
                  rows={3}
                  placeholder="Paste raw WhatsApp message, circular text, or brochure details here..."
                  value={rawNoticeText}
                  onChange={(e) => setRawNoticeText(e.target.value)}
                  className="smart-parser-textarea"
                />

                <div className="smart-parser-actions">
                  <button
                    type="button"
                    className="btn-smart-autofill"
                    onClick={handleSmartAutoFillNotice}
                    disabled={!rawNoticeText.trim()}
                  >
                    <span className="btn-icon">⚡</span> Extract & Auto-Fill Fields
                  </button>
                  <button
                    type="button"
                    className="btn-try-sample"
                    onClick={handleTrySampleNotice}
                    title="Load sample WhatsApp notice"
                  >
                    💡 Try Sample Notice
                  </button>
                </div>

                {parseFeedback && (
                  <div className={`smart-parser-feedback ${parseFeedback.type}`}>
                    <div className="feedback-message">
                      <strong>{parseFeedback.message}</strong>
                    </div>
                    {parseFeedback.fields && parseFeedback.fields.length > 0 && (
                      <div className="extracted-fields-tags">
                        {parseFeedback.fields.map((field, idx) => (
                          <span key={idx} className="field-tag">✓ {field}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="notice-form-divider">
              <span>REVIEW & TWEAK NOTICE DETAILS</span>
            </div>

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
      ))}

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
      ) : filteredNotices.length === 0 ? (
        <div className="notice-board-empty">
          <div className="empty-icon">📢</div>
          <p>No active notices found in this category.</p>
        </div>
      ) : (
        <div className="notice-grid">
          {filteredNotices.map(notice => (
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
                    onClick={() => trackNoticeEvent('link_clicked', { title: notice.title, url: notice.link_url })}
                  >
                    {notice.category === 'Event' ? 'Register →' : 'Open link ↗'}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Action Button (Screen 15) */}
      {(isApprovedDrafter || isAdmin) && (
        <button
          className="m-fab"
          onClick={() => {
            setSubmitStatus({ type: '', text: '' });
            setRawNoticeText('');
            setParseFeedback(null);
            setShowDraftModal(true);
          }}
          aria-label="Draft notice"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Draft notice</span>
        </button>
      )}
    </section>
  );
}
