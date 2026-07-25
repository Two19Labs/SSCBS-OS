import React, { useState, useEffect } from 'react';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import './NoticeBoard.css';

export default function NoticeBoard() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  const sortNotices = (list) => {
    return [...list].sort((a, b) => {
      const orderA = a.display_order ?? 0;
      const orderB = b.display_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  };

  const getDefaultCampusNotices = () => [];

  const filterActiveNotices = (rawNotices) => {
    const now = new Date();
    return (rawNotices || []).filter(notice => {
      if (notice.active_from && new Date(notice.active_from) > now) {
        return false;
      }
      if (notice.active_to && new Date(notice.active_to) < now) {
        return false;
      }
      return true;
    });
  };

  const fetchNotices = async () => {
    try {
      setLoading(true);
      if (!hasValidCredentials) {
        setNotices(filterActiveNotices(sortNotices(getDefaultCampusNotices())));
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading notices from Supabase:', error);
        setNotices(filterActiveNotices(sortNotices(getDefaultCampusNotices())));
      } else {
        setNotices(filterActiveNotices(sortNotices(data || [])));
      }
    } catch (err) {
      console.error('Failed to fetch notices:', err);
      setNotices(filterActiveNotices(sortNotices(getDefaultCampusNotices())));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();

    if (hasValidCredentials) {
      // Set up real-time listener for updates
      const channel = supabase
        .channel('public:notices')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
          fetchNotices();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  const formatDate = (isoString) => {
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
      </div>

      {loading ? (
        <div className="notice-board-loading">
          <span className="notice-spinner"></span>
          <p>Fetching campus notices...</p>
        </div>
      ) : notices.length === 0 ? (
        <div className="notice-board-empty">
          <div className="empty-icon">📢</div>
          <p>No notices found.</p>
        </div>
      ) : (
        <div className="notice-grid">
          {notices.map(notice => (
            <div key={notice.id} className="notice-card">
              <div className="notice-card-header">
                <span className="notice-date">{formatDate(notice.created_at)}</span>
              </div>
              
              <h4 className="notice-title">{notice.title}</h4>
              
              {notice.society && (
                <div className="notice-society">
                  <span className="society-avatar">
                    {notice.society.charAt(0).toUpperCase()}
                  </span>
                  <span className="society-name">{notice.society}</span>
                </div>
              )}
              
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
              
              <p className="notice-content">{notice.content}</p>
              
              {notice.link_url && (
                <div className="notice-card-footer">
                  <a 
                    href={notice.link_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn-notice-action"
                  >
                    Learn More
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="arrow-icon">
                      <line x1="7" y1="17" x2="17" y2="7"></line>
                      <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
