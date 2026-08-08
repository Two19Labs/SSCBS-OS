import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  deviceNotificationsEnabled: false,
  markAsRead: () => {},
  markAllAsRead: () => {},
  deleteNotification: () => {},
  addNotification: () => {},
  toggleDeviceNotifications: async () => {},
  permissionState: 'default',
});

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const userEmail = user?.email || 'guest';
  const storageKey = `sscbs_notifications_${userEmail}`;
  const deviceKey = `sscbs_device_notif_enabled_${userEmail}`;

  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse notifications from localStorage:', e);
    }
    return [];
  });

  const [deviceNotificationsEnabled, setDeviceNotificationsEnabled] = useState(() => {
    try {
      return localStorage.getItem(deviceKey) === 'true';
    } catch (e) {
      return false;
    }
  });

  const [permissionState, setPermissionState] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  // Re-load notifications when user changes
  useEffect(() => {
    if (!userEmail) return;
    try {
      const saved = localStorage.getItem(storageKey);
      setNotifications(saved ? JSON.parse(saved) : []);
      const devState = localStorage.getItem(deviceKey) === 'true';
      setDeviceNotificationsEnabled(devState);
    } catch (e) {
      console.warn('Failed to switch notification state for user:', e);
    }
  }, [userEmail]);

  // Persist notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    } catch (e) {
      console.warn('Failed to save notifications:', e);
    }
  }, [notifications, storageKey]);

  // Sync with Supabase table if available
  useEffect(() => {
    if (!user || !hasValidCredentials) return;

    async function fetchCloudNotifications() {
      try {
        const { data, error } = await supabase
          .from('user_notifications')
          .select('id, user_email, type, category, title, body, action_type, action_data, read, created_at')
          .eq('user_email', user.email)
          .order('created_at', { ascending: false })
          .limit(40);

        if (!error && data && data.length > 0) {
          setNotifications(data);
        }
      } catch (err) {
        // Fallback gracefully to localStorage
      }
    }

    fetchCloudNotifications();
  }, [user]);

  // Unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Toggle device OS notifications (Opt-In)
  const toggleDeviceNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Desktop/Mobile OS notifications are not supported in this browser.');
      return false;
    }

    if (deviceNotificationsEnabled) {
      // Disable
      setDeviceNotificationsEnabled(false);
      localStorage.setItem(deviceKey, 'false');
      return false;
    } else {
      // Request permission
      let perm = Notification.permission;
      if (perm !== 'granted') {
        perm = await Notification.requestPermission();
        setPermissionState(perm);
      }

      if (perm === 'granted') {
        setDeviceNotificationsEnabled(true);
        localStorage.setItem(deviceKey, 'true');
        
        // Show test native notification
        try {
          new Notification('🔔 Device Alerts Enabled!', {
            body: 'You will now receive class countdowns, team requests, and event alerts directly on your device.',
            icon: '/sscbs_logo.png'
          });
        } catch (e) {}
        return true;
      } else {
        alert('Notification permission was blocked. Please enable notifications in your browser site settings.');
        setDeviceNotificationsEnabled(false);
        localStorage.setItem(deviceKey, 'false');
        return false;
      }
    }
  }, [deviceNotificationsEnabled, deviceKey]);

  // Add notification function
  const addNotification = useCallback((item) => {
    const newId = item.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newNotif = {
      id: newId,
      type: item.type || 'info', // 'class', 'gap', 'team_req', 'team_accepted', 'team_declined', 'event'
      category: item.category || 'General',
      title: item.title,
      body: item.body,
      actionType: item.actionType || null, // 'view_room', 'empty_room', 'read_notice', 'team_action'
      actionData: item.actionData || null,
      created_at: new Date().toISOString(),
      read: false,
    };

    setNotifications(prev => {
      // Prevent duplicate by unique ID
      const exists = prev.some(n => n.id === newId);
      if (exists) return prev;

      // Trigger Device OS Push if user opted-in & permission granted
      if (deviceNotificationsEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(item.title, {
            body: item.body,
            icon: '/sscbs_logo.png',
            tag: newId,
          });
        } catch (e) {
          console.warn('Native notification failed:', e);
        }
      }

      return [newNotif, ...prev].slice(0, 50); // Keep max 50 items
    });

    // Persist to Supabase if credentials valid
    if (user && hasValidCredentials) {
      supabase.from('user_notifications').insert([{
        id: newNotif.id,
        user_email: user.email,
        type: newNotif.type,
        category: newNotif.category,
        title: newNotif.title,
        body: newNotif.body,
        action_type: newNotif.actionType,
        action_data: newNotif.actionData,
        read: false,
      }]).then();
    }
  }, [deviceNotificationsEnabled, user]);

  const markAsRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    if (user && hasValidCredentials) {
      supabase.from('user_notifications').update({ read: true }).eq('id', id).then();
    }
  }, [user]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (user && hasValidCredentials) {
      supabase.from('user_notifications').update({ read: true }).eq('user_email', user.email).then();
    }
  }, [user]);

  const deleteNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (user && hasValidCredentials) {
      supabase.from('user_notifications').delete().eq('id', id).then();
    }
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        deviceNotificationsEnabled,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        addNotification,
        toggleDeviceNotifications,
        permissionState,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
