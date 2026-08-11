import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTimetable } from '../context/TimetableContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import timetablesData from '../data/timetables.json';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const PERIOD_TIME_MAP = {
  1: { start: '09:00', end: '10:00', startLabel: '9:00 AM' },
  2: { start: '10:00', end: '11:00', startLabel: '10:00 AM' },
  3: { start: '11:00', end: '12:00', startLabel: '11:00 AM' },
  0: { start: '12:00', end: '13:00', startLabel: '12:00 PM', isBreak: true },
  4: { start: '13:00', end: '14:00', startLabel: '1:00 PM' },
  5: { start: '14:00', end: '15:00', startLabel: '2:00 PM' },
  6: { start: '15:00', end: '16:00', startLabel: '3:00 PM' },
  7: { start: '16:00', end: '17:00', startLabel: '4:00 PM' },
};

function parseTimeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getISTDateComponents() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const map = {};
  parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });

  const rawHour = parseInt(map.hour, 10);
  const hours = rawHour === 24 ? 0 : rawHour;
  const minutes = parseInt(map.minute, 10);

  return {
    dayName: map.weekday,
    currentMinutes: hours * 60 + minutes,
    todayDateStr: `${map.year}-${map.month}-${map.day}`,
  };
}

export function useNotificationEngine() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { getTimetable } = useTimetable();

  const firedAlertsRef = useRef(new Set());

  // Load fired alerts history from localStorage to avoid duplicates across page reloads
  useEffect(() => {
    try {
      const { todayDateStr } = getISTDateComponents();
      const saved = localStorage.getItem(`sscbs_fired_alerts_${todayDateStr}`);
      if (saved) {
        firedAlertsRef.current = new Set(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  const markAlertFired = (alertKey) => {
    firedAlertsRef.current.add(alertKey);
    try {
      const { todayDateStr } = getISTDateComponents();
      localStorage.setItem(`sscbs_fired_alerts_${todayDateStr}`, JSON.stringify(Array.from(firedAlertsRef.current)));
    } catch (e) {}
  };

  // 1. Timetable Schedule & Event Ticker (Runs every 20 seconds)
  useEffect(() => {
    if (!user) return;

    const checkScheduleAndEvents = async () => {
      const { dayName: currentDay, currentMinutes, todayDateStr } = getISTDateComponents();

      // Fetch user profile settings
      const meta = user.user_metadata || {};
      const course = meta.course || localStorage.getItem('sscbs_user_course') || 'BMS';
      const semester = meta.semester || localStorage.getItem('sscbs_user_semester') || 'Semester 1';
      const section = meta.section || localStorage.getItem('sscbs_user_section') || 'Section A';

      const userSchedule = getTimetable ? getTimetable(course, semester, section) : null;
      const todayClasses = userSchedule && userSchedule[currentDay] ? userSchedule[currentDay] : [];

      // ── [#1] Upcoming Class Countdown (5 Minutes Before Class) ──
      todayClasses.forEach((periodItem) => {
        if (!periodItem) return;
        const periodNum = periodItem.period !== undefined ? periodItem.period : periodItem.id;
        const slot = PERIOD_TIME_MAP[periodNum] || {};

        const start = periodItem.start || slot.start;
        const startLabel = periodItem.startLabel || slot.startLabel || start;
        const isBreak = periodItem.isBreak || slot.isBreak;
        const subject = (periodItem.subject || '').trim();

        // Skip breaks & empty slots
        if (
          !start ||
          isBreak ||
          ['Free', 'No Class', 'Break', '-', 'Infinity Hour', 'Infinity Hour (Break)'].includes(subject)
        ) {
          return;
        }

        const startMin = parseTimeToMinutes(start);
        const diffMins = startMin - currentMinutes;

        // Catch-up window: Class starting in <= 5 mins OR started in last 2 mins
        if (diffMins >= -2 && diffMins <= 5) {
          const alertKey = `class_5m_${todayDateStr}_P${periodNum}_${start}_${subject}`;
          if (!firedAlertsRef.current.has(alertKey)) {
            markAlertFired(alertKey);

            let titleText = `⏰ Class Starting in ${diffMins} mins`;
            if (diffMins <= 0) {
              titleText = `⏰ Class Started (${startLabel})`;
            } else if (diffMins <= 2) {
              titleText = `⏰ Class Starting NOW (${startLabel})`;
            }

            addNotification({
              id: alertKey,
              type: 'class',
              category: 'Class Schedule',
              title: titleText,
              body: `${subject} starts ${diffMins <= 0 ? 'now' : `soon (${startLabel})`} in Room ${periodItem.room || 'TBA'}`,
              actionType: 'view_room',
              actionData: { room: periodItem.room, subject: subject },
            });
          }
        }
      });

      // ── [#15] Notice Event Reminders (15 Minutes Before Event Start) ──
      try {
        let publishedNotices = [];

        if (hasValidCredentials) {
          const { data: notices } = await supabase
            .from('notices')
            .select('id, title, venue, event_date, society, status')
            .filter('status', 'eq', 'published')
            .not('event_date', 'is', null);

          if (notices) publishedNotices = notices;
        }

        // Merge with local cached notices if present
        try {
          const cached = sessionStorage.getItem('sscbs_cached_notices');
          if (cached) {
            const parsed = JSON.parse(cached);
            parsed.forEach(cn => {
              if (cn.event_date && (cn.status === 'published' || !cn.status) && !publishedNotices.some(n => n.id === cn.id)) {
                publishedNotices.push(cn);
              }
            });
          }
        } catch (e) {}

        if (publishedNotices.length > 0) {
          publishedNotices.forEach((notice) => {
            if (!notice.event_date) return;
            const eventTime = new Date(notice.event_date).getTime();
            if (isNaN(eventTime)) return;

            const nowTime = Date.now();
            const diffMinutes = Math.round((eventTime - nowTime) / (60 * 1000));

            // Catch-up window: Event starting in <= 15 mins OR started in last 5 mins
            if (diffMinutes >= -5 && diffMinutes <= 15) {
              const alertKey = `event_15m_${notice.id}`;
              if (!firedAlertsRef.current.has(alertKey)) {
                markAlertFired(alertKey);

                let eventTitle = `🎟️ Event Starting in ${diffMinutes} mins`;
                let eventBody = `"${notice.title}" by ${notice.society || 'College'} starts in ${diffMinutes} minutes at ${notice.venue || 'Campus'}!`;

                if (diffMinutes <= 0 && diffMinutes >= -5) {
                  const eventTimeFormatted = new Date(notice.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  eventTitle = `🎟️ Event Starting NOW (${eventTimeFormatted})`;
                  eventBody = `"${notice.title}" by ${notice.society || 'College'} is starting now at ${notice.venue || 'Campus'}!`;
                } else if (diffMinutes <= 3) {
                  eventTitle = `🎟️ Event Starting NOW`;
                }

                addNotification({
                  id: alertKey,
                  type: 'event',
                  category: 'Notice Board',
                  title: eventTitle,
                  body: eventBody,
                  actionType: 'read_notice',
                  actionData: { noticeId: notice.id, title: notice.title },
                });
              }
            }
          });
        }
      } catch (err) {
        console.warn('Notice event check warning:', err);
      }
    };

    checkScheduleAndEvents();
    const interval = setInterval(checkScheduleAndEvents, 20000); // Ticker cycle: 20 seconds
    return () => clearInterval(interval);
  }, [user, getTimetable, addNotification]);

  // 2. Realtime Supabase Listener for Team Finder Requests (#6, #7, #8)
  useEffect(() => {
    if (!user || !user.email || !hasValidCredentials) return;

    const userEmail = user.email;

    // Subscribe to squad_applications table
    const channel = supabase
      .channel('squad_app_notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'squad_applications' },
        async (payload) => {
          const app = payload.new;
          if (!app || !app.post_id) return;

          // Fetch the post to check if current user is the host
          try {
            const { data: post } = await supabase
              .from('squad_posts')
              .select('id, user_id, created_by_email, user_email, competition_name, title')
              .eq('id', app.post_id)
              .single();

            const isHost = post && (
              (post.created_by_email && post.created_by_email.toLowerCase() === userEmail.toLowerCase()) ||
              (post.user_id && post.user_id === user?.id) ||
              (post.user_email && post.user_email.toLowerCase() === userEmail.toLowerCase())
            );

            if (isHost && app.applicant_email?.toLowerCase() !== userEmail.toLowerCase()) {
              const postTitle = post.competition_name || post.title || 'Team';
              addNotification({
                id: `team_req_${app.id}`,
                type: 'team_req',
                category: 'Team Finder',
                title: `📥 New Team Application`,
                body: `${app.applicant_name || 'A student'} requested to join your team for "${postTitle}"`,
                actionType: 'team_action',
                actionData: { appId: app.id, postId: post.id, applicantName: app.applicant_name, applicantEmail: app.applicant_email },
              });
            }
          } catch (e) {}
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'squad_applications' },
        async (payload) => {
          const app = payload.new;
          if (!app || app.applicant_email?.toLowerCase() !== userEmail.toLowerCase()) return;

          try {
            const { data: post } = await supabase
              .from('squad_posts')
              .select('id, competition_name, title')
              .eq('id', app.post_id)
              .single();

            const postTitle = post ? (post.competition_name || post.title || 'Team') : 'Team';

            if (app.status === 'accepted') {
              addNotification({
                id: `team_accepted_${app.id}`,
                type: 'team_accepted',
                category: 'Team Finder',
                title: `🎉 Application Accepted!`,
                body: `Your request to join "${postTitle}" was accepted by the team host!`,
                actionType: 'team_view',
                actionData: { postId: app.post_id },
              });
            } else if (app.status === 'declined') {
              addNotification({
                id: `team_declined_${app.id}`,
                type: 'team_declined',
                category: 'Team Finder',
                title: `ℹ️ Application Status`,
                body: `Your request to join "${postTitle}" was declined.`,
                actionType: 'team_view',
                actionData: { postId: app.post_id },
              });
            }
          } catch (e) {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, addNotification]);

  // 3. Periodic Smart Polling for Team Finder Applications & Status Updates
  useEffect(() => {
    if (!user || !user.email || !hasValidCredentials) return;

    const userEmail = user.email;

    const pollTeamFinderNotifications = async () => {
      try {
        // A. Fetch squad posts created by current user
        const { data: myPostsData } = await supabase
          .from('squad_posts')
          .select('id, title, competition_name, created_by_email, user_id, user_email')
          .or(`created_by_email.ilike."${userEmail}",user_email.ilike."${userEmail}",user_id.eq."${user.id}"`);

        const myPosts = myPostsData || [];

        if (myPosts.length > 0) {
          const postIds = myPosts.map(p => p.id);
          const postMap = {};
          myPosts.forEach(p => { postMap[p.id] = p.competition_name || p.title || 'Team'; });

          // Fetch pending applications for user's posts
          const { data: incomingApps } = await supabase
            .from('squad_applications')
            .select('id, post_id, applicant_name, applicant_email, status, created_at')
            .in('post_id', postIds)
            .eq('status', 'pending');

          if (incomingApps && incomingApps.length > 0) {
            incomingApps.forEach(app => {
              if (app.applicant_email?.toLowerCase() !== userEmail.toLowerCase()) {
                const notifKey = `team_req_${app.id}`;
                if (!firedAlertsRef.current.has(notifKey)) {
                  markAlertFired(notifKey);
                  const postTitle = postMap[app.post_id] || 'Team';
                  addNotification({
                    id: notifKey,
                    type: 'team_req',
                    category: 'Team Finder',
                    title: `📥 New Team Application`,
                    body: `${app.applicant_name || 'A student'} requested to join your team for "${postTitle}"`,
                    actionType: 'team_action',
                    actionData: { appId: app.id, postId: app.post_id, applicantName: app.applicant_name, applicantEmail: app.applicant_email },
                  });
                }
              }
            });
          }
        }

        // B. Fetch applications submitted by user to check for accept / decline updates
        const { data: mySubmittedApps } = await supabase
          .from('squad_applications')
          .select('id, post_id, applicant_email, status, updated_at')
          .eq('applicant_email', userEmail)
          .in('status', ['accepted', 'declined']);

        if (mySubmittedApps && mySubmittedApps.length > 0) {
          const postIds = [...new Set(mySubmittedApps.map(a => a.post_id))];
          const { data: posts } = await supabase
            .from('squad_posts')
            .select('id, title, competition_name')
            .in('id', postIds);

          const postMap = {};
          if (posts) posts.forEach(p => { postMap[p.id] = p.competition_name || p.title || 'Team'; });

          mySubmittedApps.forEach(app => {
            const notifKey = `team_${app.status}_${app.id}`;
            if (!firedAlertsRef.current.has(notifKey)) {
              markAlertFired(notifKey);
              const postTitle = postMap[app.post_id] || 'Team';

              if (app.status === 'accepted') {
                addNotification({
                  id: notifKey,
                  type: 'team_accepted',
                  category: 'Team Finder',
                  title: `🎉 Application Accepted!`,
                  body: `Your request to join "${postTitle}" was accepted by the team host!`,
                  actionType: 'team_view',
                  actionData: { postId: app.post_id },
                });
              } else if (app.status === 'declined') {
                addNotification({
                  id: notifKey,
                  type: 'team_declined',
                  category: 'Team Finder',
                  title: `ℹ️ Application Status`,
                  body: `Your request to join "${postTitle}" was declined.`,
                  actionType: 'team_view',
                  actionData: { postId: app.post_id },
                });
              }
            }
          });
        }
      } catch (err) {
        console.warn('Error polling Team Finder notifications:', err);
      }
    };

    pollTeamFinderNotifications();
    const interval = setInterval(pollTeamFinderNotifications, 15000); // Polls every 15s
    return () => clearInterval(interval);
  }, [user, addNotification]);
}
