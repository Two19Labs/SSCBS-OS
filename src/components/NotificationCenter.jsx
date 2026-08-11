import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import {
  BellIcon,
  CalendarIcon,
  DoorIcon,
  TrophyIcon,
  MegaphoneIcon,
  CheckIcon,
  CloseIcon,
  RefreshIcon,
  ShieldIcon,
  UserIcon,
} from './icons';
import './NotificationCenter.css';

export default function NotificationCenter({ onNavigate }) {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    deviceNotificationsEnabled,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    toggleDeviceNotifications,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'class', 'team', 'event'
  const [actionLoading, setActionLoading] = useState({});

  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle Team Application Accept / Decline directly inside Notification card
  const handleTeamAction = async (notifId, actionData, newStatus) => {
    const appId = typeof actionData === 'object' ? actionData?.appId : actionData;
    const postId = typeof actionData === 'object' ? actionData?.postId : null;
    const applicantEmail = typeof actionData === 'object' ? actionData?.applicantEmail : null;

    setActionLoading(prev => ({ ...prev, [notifId]: true }));

    try {
      if (hasValidCredentials && appId) {
        await supabase
          .from('squad_applications')
          .update({ status: newStatus })
          .eq('id', appId);

        if (newStatus === 'accepted' && postId && applicantEmail) {
          const { data: post } = await supabase
            .from('squad_posts')
            .select('id, accepted_emails, initial_open_spots, spots_left')
            .eq('id', postId)
            .single();

          if (post) {
            const currentAccepted = Array.isArray(post.accepted_emails) ? post.accepted_emails : [];
            const appEmailLower = applicantEmail.toLowerCase();
            const newAcceptedEmails = currentAccepted.some(e => e?.toLowerCase() === appEmailLower)
              ? currentAccepted
              : [...currentAccepted, applicantEmail];

            const initialOpen = parseInt(post.initial_open_spots, 10) || (currentAccepted.length + (parseInt(post.spots_left, 10) || 0)) || 1;
            const newOpenSpots = Math.max(0, initialOpen - newAcceptedEmails.length);
            const isNowOpen = newOpenSpots > 0;

            await supabase
              .from('squad_posts')
              .update({
                accepted_emails: newAcceptedEmails,
                initial_open_spots: initialOpen,
                spots_left: newOpenSpots,
                is_open: isNowOpen,
              })
              .eq('id', postId);
          }
        }
      }

      // Mark notification as read
      markAsRead(notifId);
    } catch (err) {
      console.error('Failed to update application status:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [notifId]: false }));
    }
  };

  const handleActionClick = (notif) => {
    markAsRead(notif.id);
    setIsOpen(false);

    if (!onNavigate) return;

    const actionType = notif.actionType || notif.action_type;

    if (actionType === 'view_room' || notif.type === 'class') {
      onNavigate('home');
    } else if (actionType === 'empty_room' || notif.type === 'gap') {
      onNavigate('empty-room');
    } else if (actionType === 'read_notice' || notif.type === 'event') {
      onNavigate('buzz');
    } else if (actionType === 'team_view' || notif.type?.startsWith('team_')) {
      onNavigate('team-finder');
    } else {
      onNavigate('home');
    }
  };

  // Filter items
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'class') return n.type === 'class' || n.type === 'gap';
    if (filter === 'team') return n.type?.startsWith('team_');
    if (filter === 'event') return n.type === 'event';
    return true;
  });

  const getCategoryIcon = (type) => {
    switch (type) {
      case 'class':
        return <CalendarIcon size={18} />;
      case 'gap':
        return <DoorIcon size={18} />;
      case 'team_req':
      case 'team_accepted':
      case 'team_declined':
        return <TrophyIcon size={18} />;
      case 'event':
        return <MegaphoneIcon size={18} />;
      default:
        return <BellIcon size={18} />;
    }
  };

  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Just now';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="notif-center-wrapper" ref={dropdownRef}>
      {/* ── Bell Button ── */}
      <button
        className={`notif-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="Notifications Hub"
        title="Notifications Hub"
      >
        <BellIcon size={20} />
        {unreadCount > 0 && (
          <span className="notif-badge-pill">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Flyout Panel ── */}
      {isOpen && (
        <div className="notif-dropdown-panel animate-fade-in">
          {/* Header */}
          <div className="notif-panel-header">
            <div className="notif-header-title">
              <span className="notif-title-text">Notifications</span>
              {unreadCount > 0 && <span className="notif-count-tag">{unreadCount} new</span>}
            </div>

            <div className="notif-header-actions">
              {unreadCount > 0 && (
                <button className="notif-mark-read-btn" onClick={markAllAsRead}>
                  Mark all read
                </button>
              )}
              <button
                className="notif-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <CloseIcon size={16} />
              </button>
            </div>
          </div>

          {/* Opt-In Device OS Notifications Banner */}
          <div className="notif-device-toggle-bar">
            <div className="notif-toggle-info">
              <span className="notif-toggle-title">Device OS Alerts</span>
              <span className="notif-toggle-sub">
                {deviceNotificationsEnabled ? 'Active (Phone/Desktop Push)' : 'Opt-in for desktop/phone alerts'}
              </span>
            </div>
            <label className="notif-switch">
              <input
                type="checkbox"
                checked={deviceNotificationsEnabled}
                onChange={toggleDeviceNotifications}
              />
              <span className="notif-slider round"></span>
            </label>
          </div>

          {/* Filter Pills */}
          <div className="notif-filter-bar">
            {[
              { id: 'all', label: 'All' },
              { id: 'class', label: 'Classes' },
              { id: 'team', label: 'Team Finder' },
              { id: 'event', label: 'Events' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`notif-filter-pill ${filter === tab.id ? 'active' : ''}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="notif-list-container">
            {filteredNotifications.length === 0 ? (
              <div className="notif-empty-state">
                <BellIcon size={32} className="notif-empty-icon" />
                <p className="notif-empty-title">All caught up!</p>
                <p className="notif-empty-desc">
                  No notifications right now. Class countdowns, event alerts, and team requests will appear here.
                </p>
              </div>
            ) : (
              filteredNotifications.map(notif => {
                const actionData = notif.actionData || notif.action_data;
                return (
                  <div
                    key={notif.id}
                    className={`notif-card-item ${notif.read ? 'read' : 'unread'} notif-type-${notif.type}`}
                    onClick={() => handleActionClick(notif)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="notif-card-main">
                      <span className={`notif-type-icon icon-${notif.type}`}>
                        {getCategoryIcon(notif.type)}
                      </span>

                      <div className="notif-card-content">
                        <div className="notif-card-top flex-between">
                          <span className="notif-card-category">{notif.category || 'Alert'}</span>
                          <span className="notif-card-time">{formatTimeAgo(notif.created_at)}</span>
                        </div>

                        <h4 className="notif-card-title">{notif.title}</h4>
                        <p className="notif-card-body">{notif.body}</p>

                        {/* Action buttons */}
                        <div className="notif-card-actions">
                          {notif.type === 'team_req' && actionData?.appId ? (
                            <div className="notif-team-actions">
                              <button
                                className="notif-btn notif-btn-accept"
                                disabled={actionLoading[notif.id]}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTeamAction(notif.id, actionData, 'accepted');
                                }}
                              >
                                <CheckIcon size={14} /> Accept
                              </button>
                              <button
                                className="notif-btn notif-btn-decline"
                                disabled={actionLoading[notif.id]}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTeamAction(notif.id, actionData, 'declined');
                                }}
                              >
                                <CloseIcon size={14} /> Decline
                              </button>
                            </div>
                          ) : (
                            <button
                              className="notif-btn notif-btn-action"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActionClick(notif);
                              }}
                            >
                              {notif.type === 'class' && 'Find Room'}
                              {notif.type === 'gap' && 'Find Empty Room'}
                              {notif.type === 'event' && 'Read Notice'}
                              {notif.type?.startsWith('team_') && 'Open Team Finder'}
                              {!['class', 'gap', 'event'].includes(notif.type) && !notif.type?.startsWith('team_') && 'View Details'}
                            </button>
                          )}

                          {!notif.read && (
                            <button
                              className="notif-btn-read-toggle"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notif.id);
                              }}
                              title="Mark as read"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      className="notif-card-dismiss"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      title="Remove notification"
                      aria-label="Remove notification"
                    >
                      <CloseIcon size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
