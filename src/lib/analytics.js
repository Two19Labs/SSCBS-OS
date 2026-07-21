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

let globalPresenceChannel = null;

/**
 * 🟢 Real-Time Presence Subscription via Supabase WebSockets
 * Tracks active users live across all devices and browsers globally
 */
export function subscribeToPresence(user, currentView, onPresenceSync) {
  if (!user || !hasValidCredentials) {
    if (onPresenceSync) onPresenceSync([]);
    return () => {};
  }

  const isMobile = window.innerWidth <= 768;
  const userPayload = {
    id: user.id || user.email,
    name: user.user_metadata?.full_name || user.email.split('@')[0],
    email: user.email,
    course: user.user_metadata?.course || 'N/A',
    semester: user.user_metadata?.semester ? String(user.user_metadata.semester) : 'N/A',
    section: user.user_metadata?.section || 'N/A',
    currentView: currentView || 'home',
    viewLabel: FEATURE_NAMES[currentView] || 'Home Dashboard',
    device: isMobile ? '📱 Mobile' : '💻 Desktop',
    lastPing: Date.now()
  };

  try {
    // If channel exists, track updated payload (e.g. view changed)
    if (globalPresenceChannel) {
      globalPresenceChannel.track(userPayload);
      return () => {};
    }

    globalPresenceChannel = supabase.channel('sscbs-online-presence-v1', {
      config: { presence: { key: userPayload.id } }
    });

    globalPresenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = globalPresenceChannel.presenceState();
        const onlineList = [];
        Object.values(state).forEach((presences) => {
          presences.forEach((p) => onlineList.push(p));
        });

        if (onPresenceSync) {
          onPresenceSync(onlineList);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await globalPresenceChannel.track(userPayload);
        }
      });

    return () => {
      if (globalPresenceChannel) {
        globalPresenceChannel.untrack();
        supabase.removeChannel(globalPresenceChannel);
        globalPresenceChannel = null;
      }
    };
  } catch (err) {
    console.error('Supabase Realtime Presence Error:', err);
    if (onPresenceSync) onPresenceSync([]);
    return () => {};
  }
}

/**
 * 📊 Log a real feature view/launch event to Supabase
 */
export async function logFeatureView(featureId, user) {
  if (!featureId || !hasValidCredentials) return;

  const dateStr = new Date().toISOString().split('T')[0];

  try {
    // 1. Log individual event to analytics_events if table exists
    await supabase.from('analytics_events').insert([{
      user_id: user?.id || null,
      feature_id: featureId,
      created_at: new Date().toISOString()
    }]);
  } catch (e) {
    // Non-blocking fallback
  }

  try {
    // 2. Also aggregate into system_configs for instant queries
    const { data } = await supabase
      .from('system_configs')
      .select('value')
      .eq('key', 'analytics_events_daily')
      .maybeSingle();

    let eventsMap = data?.value || {};
    if (!eventsMap[dateStr]) {
      eventsMap[dateStr] = { timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, total: 0 };
    }

    eventsMap[dateStr][featureId] = (eventsMap[dateStr][featureId] || 0) + 1;
    eventsMap[dateStr].total = (eventsMap[dateStr].total || 0) + 1;

    await supabase.from('system_configs').upsert({
      key: 'analytics_events_daily',
      value: eventsMap,
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    // Fallback quietly if write permissions constrained
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

      if (data?.value) {
        const eventsMap = data.value;
        dateList.forEach(({ dateStr }) => {
          if (eventsMap[dateStr]) {
            dateMap[dateStr] = {
              timetable: eventsMap[dateStr].timetable || 0,
              'find-prof': eventsMap[dateStr]['find-prof'] || 0,
              waiver: eventsMap[dateStr].waiver || 0,
              gpa: eventsMap[dateStr].gpa || 0,
              buzz: eventsMap[dateStr].buzz || 0,
              total: eventsMap[dateStr].total || 0
            };
          }
        });
      }
    } catch (e) {
      console.error('Failed to fetch analytics from Supabase:', e);
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
