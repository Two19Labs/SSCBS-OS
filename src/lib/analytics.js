import { supabase, hasValidCredentials } from './supabaseClient';

export const FEATURE_NAMES = {
  home: 'Home Dashboard',
  timetable: 'Timetable',
  'find-prof': 'Find My Professor',
  waiver: 'Waiver Tool',
  gpa: 'GPA Calculator',
  buzz: 'Campus Buzz',
  profile: 'Profile',
  admin: 'Admin Console'
};

/**
 * 🟢 Real-Time Presence Subscription via Supabase WebSockets
 * Completely safe, non-blocking presence tracker
 */
export function subscribeToPresence(user, currentView, onPresenceSync) {
  if (!user || !user.email || !hasValidCredentials) {
    if (onPresenceSync) onPresenceSync([]);
    return () => {};
  }

  const userId = String(user.id || user.email || 'anon');
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const userPayload = {
    id: userId,
    name: user.user_metadata?.full_name || user.email.split('@')[0] || 'Student',
    email: user.email,
    course: user.user_metadata?.course || 'N/A',
    semester: user.user_metadata?.semester ? String(user.user_metadata.semester) : 'N/A',
    section: user.user_metadata?.section || 'N/A',
    currentView: currentView || 'home',
    viewLabel: FEATURE_NAMES[currentView] || 'Home Dashboard',
    device: isMobile ? '📱 Mobile' : '💻 Desktop',
    lastPing: Date.now()
  };

  let channel = null;

  try {
    channel = supabase.channel('sscbs-online-presence-v2', {
      config: { presence: { key: userId } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        try {
          const state = channel.presenceState();
          const onlineList = [];
          if (state) {
            Object.values(state).forEach((presences) => {
              if (Array.isArray(presences)) {
                presences.forEach((p) => {
                  if (p && p.name) onlineList.push(p);
                });
              }
            });
          }
          if (onPresenceSync) onPresenceSync(onlineList);
        } catch (e) {
          // ignore sync errors
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && channel) {
          channel.track(userPayload).catch(() => {});
        }
      });

    return () => {
      try {
        if (channel) {
          channel.untrack().catch(() => {});
          supabase.removeChannel(channel).catch(() => {});
        }
      } catch (e) {
        // ignore cleanup errors
      }
    };
  } catch (err) {
    console.warn('Presence subscription non-blocking warning:', err);
    if (onPresenceSync) onPresenceSync([]);
    return () => {};
  }
}

/**
 * 📊 Log a real feature view/launch event to Supabase
 * Completely non-blocking and safe
 */
export async function logFeatureView(featureId, user) {
  if (!featureId || !hasValidCredentials || !user) return;

  try {
    const dateStr = new Date().toISOString().split('T')[0];

    // Safely attempt logging to analytics_events
    supabase
      .from('analytics_events')
      .insert([{
        user_id: user.id || null,
        feature_id: featureId,
        created_at: new Date().toISOString()
      }])
      .then(() => {})
      .catch(() => {});

    // Safely attempt logging aggregate to system_configs
    supabase
      .from('system_configs')
      .select('value')
      .eq('key', 'analytics_events_daily')
      .maybeSingle()
      .then(async ({ data }) => {
        let eventsMap = data?.value || {};
        if (typeof eventsMap !== 'object') eventsMap = {};
        if (!eventsMap[dateStr]) {
          eventsMap[dateStr] = { timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, total: 0 };
        }

        eventsMap[dateStr][featureId] = (eventsMap[dateStr][featureId] || 0) + 1;
        eventsMap[dateStr].total = (eventsMap[dateStr].total || 0) + 1;

        await supabase.from('system_configs').upsert({
          key: 'analytics_events_daily',
          value: eventsMap,
          updated_at: new Date().toISOString()
        }).catch(() => {});
      })
      .catch(() => {});
  } catch (e) {
    // Completely non-blocking
  }
}

/**
 * 📈 Fetch REAL analytics data from Supabase for line graph rendering
 */
export async function fetchAnalyticsData(daysCount = 7) {
  const dateList = [];
  const dateMap = {};
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dateList.push({ dateStr, label: monthDay });
    dateMap[dateStr] = {
      timetable: 0,
      'find-prof': 0,
      waiver: 0,
      gpa: 0,
      buzz: 0,
      total: 0
    };
  }

  if (hasValidCredentials) {
    try {
      const { data } = await supabase
        .from('system_configs')
        .select('value')
        .eq('key', 'analytics_events_daily')
        .maybeSingle();

      if (data?.value && typeof data.value === 'object') {
        const eventsMap = data.value;
        dateList.forEach(({ dateStr }) => {
          if (eventsMap[dateStr]) {
            dateMap[dateStr] = {
              timetable: Number(eventsMap[dateStr].timetable) || 0,
              'find-prof': Number(eventsMap[dateStr]['find-prof']) || 0,
              waiver: Number(eventsMap[dateStr].waiver) || 0,
              gpa: Number(eventsMap[dateStr].gpa) || 0,
              buzz: Number(eventsMap[dateStr].buzz) || 0,
              total: Number(eventsMap[dateStr].total) || 0
            };
          }
        });
      }
    } catch (e) {
      console.warn('Analytics fetch notice:', e);
    }
  }

  const totals = { timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, grandTotal: 0 };
  dateList.forEach(({ dateStr }) => {
    const dayData = dateMap[dateStr];
    totals.timetable += dayData.timetable;
    totals['find-prof'] += dayData['find-prof'];
    totals.waiver += dayData.waiver;
    totals.gpa += dayData.gpa;
    totals.buzz += dayData.buzz;
    totals.grandTotal += dayData.total;
  });

  const series = {
    timetable: dateList.map(d => dateMap[d.dateStr].timetable),
    'find-prof': dateList.map(d => dateMap[d.dateStr]['find-prof']),
    waiver: dateList.map(d => dateMap[d.dateStr].waiver),
    gpa: dateList.map(d => dateMap[d.dateStr].gpa),
    buzz: dateList.map(d => dateMap[d.dateStr].buzz),
    total: dateList.map(d => dateMap[d.dateStr].total)
  };

  const topKey = Object.keys(totals)
    .filter(k => k !== 'grandTotal')
    .sort((a, b) => totals[b] - totals[a])[0] || 'timetable';

  return {
    dateLabels: dateList.map(d => d.label),
    series,
    totals,
    topFeatureName: FEATURE_NAMES[topKey] || 'Timetable',
    topFeatureCount: totals[topKey] || 0
  };
}
