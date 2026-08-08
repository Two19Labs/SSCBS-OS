import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTimetable } from '../context/TimetableContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import timetablesData from '../data/timetables.json';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function parseTimeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getISTTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5));
}

export function useNotificationEngine() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { getTimetable } = useTimetable();

  const firedAlertsRef = useRef(new Set());

  // Load fired alerts history from localStorage to avoid duplicates across page reloads
  useEffect(() => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const saved = localStorage.getItem(`sscbs_fired_alerts_${todayStr}`);
      if (saved) {
        firedAlertsRef.current = new Set(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  const markAlertFired = (alertKey) => {
    firedAlertsRef.current.add(alertKey);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      localStorage.setItem(`sscbs_fired_alerts_${todayStr}`, JSON.stringify(Array.from(firedAlertsRef.current)));
    } catch (e) {}
  };

  // 1. Timetable Schedule & Event Ticker (Runs every 20 seconds)
  useEffect(() => {
    if (!user) return;

    const checkScheduleAndEvents = async () => {
      const now = getISTTime();
      const currentDay = DAYS[now.getDay() - 1] || 'Sunday';
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const todayDateStr = now.toISOString().split('T')[0];

      // Fetch user profile settings
      const meta = user.user_metadata || {};
      const course = meta.course || localStorage.getItem('sscbs_user_course') || 'BMS';
      const semester = meta.semester || localStorage.getItem('sscbs_user_semester') || 'Semester 1';
      const section = meta.section || localStorage.getItem('sscbs_user_section') || 'Section A';

      const userSchedule = getTimetable ? getTimetable(course, semester, section) : null;
      const todayClasses = userSchedule && userSchedule[currentDay] ? userSchedule[currentDay] : [];

      // ── [#1] Upcoming Class Countdown (10 mins before start) ──
      todayClasses.forEach((period) => {
        if (!period || !period.start || period.isBreak || period.subject === 'No Class' || period.subject === 'Break') return;

        const startMin = parseTimeToMinutes(period.start);
        const diffMins = startMin - currentMinutes;

        // Trigger alert when diff is between 9 and 10 minutes
        if (diffMins >= 9 && diffMins <= 10) {
          const alertKey = `class_10m_${todayDateStr}_${period.start}_${period.subject}`;
          if (!firedAlertsRef.current.has(alertKey)) {
            markAlertFired(alertKey);
            addNotification({
              id: alertKey,
              type: 'class',
              category: 'Class Schedule',
              title: `⏰ Class in 10 minutes`,
              body: `${period.subject} starts at ${period.start} in Room ${period.room || 'TBA'}`,
              actionType: 'view_room',
              actionData: { room: period.room, subject: period.subject },
            });
          }
        }
      });

      // ── [#4] Free Slot / Study Gap Alert (10 mins before gap starts) ──
      // Check for gaps >= 60 mins between classes
      if (todayClasses.length >= 2) {
        for (let i = 0; i < todayClasses.length - 1; i++) {
          const currentPeriod = todayClasses[i];
          const nextPeriod = todayClasses[i + 1];

          if (
            currentPeriod && currentPeriod.end &&
            nextPeriod && nextPeriod.start &&
            !nextPeriod.isBreak && nextPeriod.subject !== 'No Class'
          ) {
            const currentEndMin = parseTimeToMinutes(currentPeriod.end);
            const nextStartMin = parseTimeToMinutes(nextPeriod.start);
            const gapLength = nextStartMin - currentEndMin;

            if (gapLength >= 60) {
              const diffMins = currentEndMin - currentMinutes;
              if (diffMins >= 9 && diffMins <= 10) {
                const alertKey = `gap_10m_${todayDateStr}_${currentPeriod.end}`;
                if (!firedAlertsRef.current.has(alertKey)) {
                  markAlertFired(alertKey);
                  addNotification({
                    id: alertKey,
                    type: 'gap',
                    category: 'Study Assistant',
                    title: `☕ Free Gap Starting in 10 mins`,
                    body: `You have a ${Math.round(gapLength / 60)}h free slot after ${currentPeriod.end}. Click to find an empty room!`,
                    actionType: 'empty_room',
                    actionData: { gapLength },
                  });
                }
              }
            }
          }
        }
      }

      // ── [#15] Notice Event Starting Soon (15 mins before event date/time) ──
      try {
        if (hasValidCredentials) {
          const { data: notices } = await supabase
            .from('notices')
            .select('id, title, venue, event_date, society, status')
            .filter('status', 'eq', 'published')
            .not('event_date', 'is', null);

          if (notices && notices.length > 0) {
            notices.forEach((notice) => {
              if (!notice.event_date) return;
              const eventTime = new Date(notice.event_date).getTime();
              const nowTime = Date.now();
              const diffMinutes = Math.round((eventTime - nowTime) / (60 * 1000));

              if (diffMinutes >= 14 && diffMinutes <= 15) {
                const alertKey = `event_15m_${notice.id}`;
                if (!firedAlertsRef.current.has(alertKey)) {
                  markAlertFired(alertKey);
                  addNotification({
                    id: alertKey,
                    type: 'event',
                    category: 'Notice Board',
                    title: `🎟️ Event Starting in 15 mins`,
                    body: `"${notice.title}" by ${notice.society || 'College'} is starting at ${notice.venue || 'Campus'}!`,
                    actionType: 'read_notice',
                    actionData: { noticeId: notice.id, title: notice.title },
                  });
                }
              }
            });
          }
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
              .select('id, user_email, competition_name, title')
              .eq('id', app.post_id)
              .single();

            if (post && post.user_email === userEmail && app.applicant_email !== userEmail) {
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
          if (!app || app.applicant_email !== userEmail) return;

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
        const { data: myPosts } = await supabase
          .from('squad_posts')
          .select('id, title, competition_name')
          .eq('user_email', userEmail);

        if (myPosts && myPosts.length > 0) {
          const postIds = myPosts.map(p => p.id);
          const postMap = {};
          myPosts.forEach(p => { postMap[p.id] = p.competition_name || p.title || 'Team'; });

          // Fetch pending applications for user's posts
          const { data: incomingApps } = await supabase
            .from('squad_applications')
            .select('*')
            .in('post_id', postIds)
            .eq('status', 'pending');

          if (incomingApps && incomingApps.length > 0) {
            incomingApps.forEach(app => {
              if (app.applicant_email !== userEmail) {
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
          .select('*')
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
