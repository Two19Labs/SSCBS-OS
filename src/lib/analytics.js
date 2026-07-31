import { supabase, hasValidCredentials } from './supabaseClient';

export const FEATURE_NAMES = {
  home: 'Home Dashboard',
  timetable: 'Timetable',
  'find-prof': 'Find My Professor',
  'team-finder': 'Team Finder & Compete Hub',
  waiver: 'Waiver Tool',
  gpa: 'GPA Calculator',
  buzz: 'Campus Buzz',
  profile: 'Profile Page',
  admin: 'Admin Console'
};

const LOCAL_ANALYTICS_KEY = 'sscbs_analytics_daily_v5';

function getLocalAnalyticsMap() {
  try {
    const raw = localStorage.getItem(LOCAL_ANALYTICS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveLocalAnalyticsMap(map) {
  try {
    localStorage.setItem(LOCAL_ANALYTICS_KEY, JSON.stringify(map));
  } catch (e) {
    // ignore local storage errors
  }
}

function getTabSessionId() {
  if (typeof window === 'undefined') return 'server_session';
  let sid = sessionStorage.getItem('sscbs_tab_session_id');
  if (!sid) {
    sid = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    sessionStorage.setItem('sscbs_tab_session_id', sid);
  }
  return sid;
}

let globalCurrentUser = null;
let globalCurrentView = 'home';
let activePresenceChannel = null;
const presenceSubscribers = new Set();
let latestPresenceMap = {};
let presenceHeartbeatTimer = null;
let dbPresencePollingTimer = null;
let lastTrackedView = null;
let lastTrackTime = 0;

function broadcastPresenceToSubscribers() {
  const list = Object.values(latestPresenceMap);
  presenceSubscribers.forEach(cb => {
    try { cb(list); } catch (e) {}
  });
}

function getPresencePayload() {
  const sessionId = getTabSessionId();
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  if (!globalCurrentUser || !globalCurrentUser.email) {
    return {
      id: 'guest_' + sessionId,
      session_id: sessionId,
      name: 'Guest Student',
      email: 'guest_' + sessionId.substring(0, 7) + '@sscbs.du.ac.in',
      course: 'Visitor',
      semester: 'N/A',
      section: 'N/A',
      currentView: globalCurrentView || 'home',
      viewLabel: FEATURE_NAMES[globalCurrentView] || 'Home Dashboard',
      device: isMobile ? '📱 Mobile' : '💻 Desktop',
      lastPing: Date.now()
    };
  }

  const userId = String(globalCurrentUser.id || globalCurrentUser.email || 'anon');

  return {
    id: userId,
    session_id: sessionId,
    name: globalCurrentUser.user_metadata?.full_name || globalCurrentUser.email.split('@')[0] || 'Student',
    email: globalCurrentUser.email,
    course: globalCurrentUser.user_metadata?.course || 'N/A',
    semester: globalCurrentUser.user_metadata?.semester ? String(globalCurrentUser.user_metadata.semester) : 'N/A',
    section: globalCurrentUser.user_metadata?.section || 'N/A',
    currentView: globalCurrentView || 'home',
    viewLabel: FEATURE_NAMES[globalCurrentView] || 'Home Dashboard',
    device: isMobile ? '📱 Mobile' : '💻 Desktop',
    lastPing: Date.now()
  };
}

async function fetchActivePresenceFromDB() {
  if (!hasValidCredentials) return [];
  try {
    const cutoff = new Date(Date.now() - 60000).toISOString();
    const { data, error } = await supabase
      .from('active_presence')
      .select('*')
      .gte('last_ping', cutoff);

    if (!error && Array.isArray(data)) {
      return data.map(item => ({
        id: item.user_id || item.session_id,
        session_id: item.session_id,
        name: item.name,
        email: item.email,
        course: item.course || 'N/A',
        semester: item.semester || 'N/A',
        section: item.section || 'N/A',
        currentView: item.current_view,
        viewLabel: item.view_label || FEATURE_NAMES[item.current_view] || 'Home Dashboard',
        device: item.device,
        lastPing: new Date(item.last_ping).getTime()
      }));
    }
  } catch (e) {}
  return [];
}

function updateLocalAndState(remoteList = []) {
  try {
    const payload = getPresencePayload();
    const now = Date.now();
    const merged = {};

    // 1. Local Storage active sessions (60s drift tolerance across browser tabs)
    const raw = localStorage.getItem('sscbs_online_presence_v5');
    let localMap = raw ? JSON.parse(raw) : {};
    if (typeof localMap !== 'object' || !localMap) localMap = {};

    if (payload) {
      localMap[payload.session_id] = payload;
    }

    const cleanLocalMap = {};
    Object.keys(localMap).forEach(sid => {
      if (Math.abs(now - (localMap[sid].lastPing || 0)) < 60000) {
        cleanLocalMap[sid] = localMap[sid];
        merged[sid] = localMap[sid];
      }
    });
    localStorage.setItem('sscbs_online_presence_v5', JSON.stringify(cleanLocalMap));

    // 2. Extract active WebSocket presence from activePresenceChannel directly
    if (activePresenceChannel && typeof activePresenceChannel.presenceState === 'function') {
      try {
        const state = activePresenceChannel.presenceState();
        if (state) {
          Object.values(state).forEach(presences => {
            if (Array.isArray(presences)) {
              presences.forEach(p => {
                if (p && p.email) {
                  const sid = p.session_id || p.id || p.email;
                  merged[sid] = {
                    ...p,
                    lastPing: now
                  };
                }
              });
            }
          });
        }
      } catch (e) {}
    }

    // 3. Merge active WebSocket presence list passed via events
    if (Array.isArray(remoteList)) {
      remoteList.forEach(item => {
        if (item && item.email) {
          const sid = item.session_id || item.id || item.email;
          merged[sid] = {
            ...item,
            lastPing: now
          };
        }
      });
    }

    // 4. Group by user email (1 active presence card per student showing latest page)
    const userMap = {};
    Object.values(merged).forEach(p => {
      if (!p || !p.email) return;
      if (Math.abs(now - (p.lastPing || 0)) > 60000) return;

      const existing = userMap[p.email];
      if (!existing || (p.lastPing || 0) >= (existing.lastPing || 0)) {
        userMap[p.email] = p;
      }
    });

    latestPresenceMap = userMap;
    broadcastPresenceToSubscribers();
  } catch (e) {
    // ignore sync errors
  }
}

let lastDbPingTime = 0;

function sendPresencePing() {
  const payload = getPresencePayload();
  if (!payload) return;

  // 1. Immediate local memory & storage update
  updateLocalAndState([]);

  // 2. Track over WebSocket ONLY on view change or every 60 seconds
  const now = Date.now();
  if (hasValidCredentials && activePresenceChannel) {
    if (lastTrackedView !== payload.currentView || (now - lastTrackTime) > 60000) {
      lastTrackedView = payload.currentView;
      lastTrackTime = now;
      try {
        activePresenceChannel.track(payload).catch(() => {});
      } catch (e) {}
    }
  }
}

function initGlobalPresenceTracker() {
  if (!presenceHeartbeatTimer) {
    // Lightweight local ping timer every 10 seconds for tab freshness
    presenceHeartbeatTimer = setInterval(() => {
      sendPresencePing();
    }, 10000);
  }

  // Setup Singleton Supabase Realtime Channel if not yet created
  if (hasValidCredentials && !activePresenceChannel) {
    try {
      const sid = getTabSessionId();
      activePresenceChannel = supabase.channel('sscbs-online-presence-v7', {
        config: { presence: { key: sid } }
      });

      const handlePresenceSync = () => {
        try {
          const state = activePresenceChannel.presenceState();
          const onlineList = [];
          if (state) {
            Object.values(state).forEach(presences => {
              if (Array.isArray(presences)) {
                presences.forEach(p => {
                  if (p && p.name && p.email) onlineList.push(p);
                });
              }
            });
          }
          updateLocalAndState(onlineList);
        } catch (e) {}
      };

      activePresenceChannel
        .on('presence', { event: 'sync' }, handlePresenceSync)
        .on('presence', { event: 'join' }, handlePresenceSync)
        .on('presence', { event: 'leave' }, handlePresenceSync)
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            sendPresencePing();
          }
        });
    } catch (err) {
      console.warn('Realtime presence notice:', err);
    }
  }
}

export function subscribeToPresence(user, currentView, onPresenceSync) {
  if (user && user.email) {
    globalCurrentUser = user;
  }
  if (currentView) {
    globalCurrentView = currentView;
  }

  if (onPresenceSync) {
    presenceSubscribers.add(onPresenceSync);
    try { onPresenceSync(Object.values(latestPresenceMap)); } catch (e) {}
  }

  initGlobalPresenceTracker();
  sendPresencePing();

  return () => {
    if (onPresenceSync) {
      presenceSubscribers.delete(onPresenceSync);
    }
  };
}

const recentLogMap = new Map();

export async function logFeatureView(featureId, user) {
  if (!featureId || featureId === 'admin' || !FEATURE_NAMES[featureId]) return;

  const now = Date.now();
  const lastTime = recentLogMap.get(featureId) || 0;
  if (now - lastTime < 3000) {
    // Session debounce: prevent double logging within 3 seconds for exact same feature
    return;
  }
  recentLogMap.set(featureId, now);

  const nowDate = new Date();
  const dateStr = nowDate.toISOString().split('T')[0];
  const hourKey = `${dateStr}-${nowDate.getHours().toString().padStart(2, '0')}`;

  // 1. Record in client LocalStorage immediately
  try {
    const localMap = getLocalAnalyticsMap();
    if (!localMap[dateStr]) {
      localMap[dateStr] = {
        visits: { home: 0, timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, profile: 0, total: 0 },
        hourly: {}
      };
    }
    if (!localMap[dateStr].visits) {
      localMap[dateStr].visits = { home: 0, timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, profile: 0, total: 0 };
    }
    if (!localMap[dateStr].hourly) {
      localMap[dateStr].hourly = {};
    }
    if (!localMap[dateStr].hourly[hourKey]) {
      localMap[dateStr].hourly[hourKey] = { home: 0, timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, profile: 0, total: 0 };
    }

    localMap[dateStr].visits[featureId] = (localMap[dateStr].visits[featureId] || 0) + 1;
    localMap[dateStr].visits.total = (localMap[dateStr].visits.total || 0) + 1;

    localMap[dateStr].hourly[hourKey][featureId] = (localMap[dateStr].hourly[hourKey][featureId] || 0) + 1;
    localMap[dateStr].hourly[hourKey].total = (localMap[dateStr].hourly[hourKey].total || 0) + 1;

    saveLocalAnalyticsMap(localMap);
  } catch (e) {
    // Non-blocking
  }

  // 2. Attempt remote Supabase insertion
  if (hasValidCredentials) {
    try {
      supabase
        .from('analytics_events')
        .insert([{
          user_id: user?.id || null,
          feature_id: featureId,
          event_type: 'visit',
          created_at: new Date().toISOString()
        }])
        .then(() => {})
        .catch(() => {});
    } catch (e) {
      // Completely non-blocking
    }
  }
}

/**
 * Log a feature action - mapped to logFeatureView for visit-only tracking
 */
export async function logFeatureClick(featureId, user) {
  if (featureId === 'admin') return;
  return logFeatureView(featureId, user);
}

/**
 * 📈 Fetch REAL analytics data combining Supabase DB events, system_configs, and local logs.
 * Supports hourly breakdown for daysCount = 1 (Last 24 Hours) as well as daily breakdown for 7, 30, 90 days.
 */
export async function fetchAnalyticsData(daysCount = 7) {
  const emptyFeatureSet = () => ({ home: 0, timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, profile: 0, total: 0 });

  if (daysCount === 1) {
    // ----------------------------------------------------
    // HOURLY BREAKDOWN FOR LAST 24 HOURS (24 hourly slots)
    // ----------------------------------------------------
    const slots = [];
    const now = new Date();

    for (let i = 23; i >= 0; i--) {
      const slotDate = new Date(now.getTime() - i * 3600 * 1000);
      const dateStr = slotDate.toISOString().split('T')[0];
      const hourNum = slotDate.getHours();
      const hourKey = `${dateStr}-${hourNum.toString().padStart(2, '0')}`;
      const timeLabel = slotDate.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      const fullLabel = `${slotDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timeLabel}`;

      const dFloor = new Date(slotDate);
      dFloor.setMinutes(0, 0, 0);
      const startMs = dFloor.getTime();
      const endMs = startMs + 3600000;

      slots.push({
        key: hourKey,
        dateStr,
        hourNum,
        startMs,
        endMs,
        label: timeLabel,
        fullLabel
      });
    }

    const slotMapVisits = slots.map(() => emptyFeatureSet());
    const localCounts = slots.map(() => emptyFeatureSet());
    const configCounts = slots.map(() => emptyFeatureSet());
    const dbCounts = slots.map(() => emptyFeatureSet());

    // A. Load from LocalStorage
    const localMap = getLocalAnalyticsMap();
    slots.forEach((slot, idx) => {
      const day = localMap[slot.dateStr];
      if (day) {
        if (day.hourly && day.hourly[slot.key]) {
          const h = day.hourly[slot.key];
          Object.keys(localCounts[idx]).forEach(feat => {
            if (feat !== 'admin' && feat !== 'total') {
              localCounts[idx][feat] = Number(h[feat]) || 0;
            }
          });
        } else if (day.visits || typeof day === 'object') {
          // Fallback for daily summaries without hourly tags: allocate to current hour slot if match date
          const v = day.visits || day;
          const isLatestSlotForDay = (idx === slots.length - 1) || (idx < slots.length - 1 && slots[idx + 1].dateStr !== slot.dateStr);
          if (isLatestSlotForDay) {
            Object.keys(localCounts[idx]).forEach(feat => {
              if (feat !== 'admin' && feat !== 'total') {
                localCounts[idx][feat] = Number(v[feat]) || 0;
              }
            });
          }
        }
      }
    });

    // B. Load from Supabase system_configs & analytics_events
    if (hasValidCredentials) {
      try {
        const { data: configData } = await supabase
          .from('system_configs')
          .select('value')
          .eq('key', 'analytics_events_v2')
          .maybeSingle();

        if (configData?.value && typeof configData.value === 'object') {
          const eventsMap = configData.value;
          slots.forEach((slot, idx) => {
            const day = eventsMap[slot.dateStr];
            if (day) {
              if (day.hourly && day.hourly[slot.key]) {
                const h = day.hourly[slot.key];
                Object.keys(configCounts[idx]).forEach(feat => {
                  if (feat !== 'admin' && feat !== 'total') {
                    configCounts[idx][feat] = Number(h[feat]) || 0;
                  }
                });
              } else if (day.visits || typeof day === 'object') {
                const v = day.visits || day;
                const isLatestSlotForDay = (idx === slots.length - 1) || (idx < slots.length - 1 && slots[idx + 1].dateStr !== slot.dateStr);
                if (isLatestSlotForDay) {
                  Object.keys(configCounts[idx]).forEach(feat => {
                    if (feat !== 'admin' && feat !== 'total') {
                      configCounts[idx][feat] = Number(v[feat]) || 0;
                    }
                  });
                }
              }
            }
          });
        }

        // Query analytics_events table directly using created_at timestamp
        const startIso = new Date(slots[0].startMs).toISOString();
        const { data: dbEvents } = await supabase
          .from('analytics_events')
          .select('feature_id, created_at')
          .gte('created_at', startIso);

        if (Array.isArray(dbEvents) && dbEvents.length > 0) {
          dbEvents.forEach(evt => {
            if (!evt.created_at || !evt.feature_id || evt.feature_id === 'admin') return;
            const evtMs = new Date(evt.created_at).getTime();
            const targetSlotIdx = slots.findIndex(s => evtMs >= s.startMs && evtMs < s.endMs);
            if (targetSlotIdx >= 0 && dbCounts[targetSlotIdx][evt.feature_id] !== undefined) {
              dbCounts[targetSlotIdx][evt.feature_id] += 1;
            }
          });
        }
      } catch (e) {
        console.warn('Analytics fetch notice (hourly):', e);
      }
    }

    // Aggregate single accurate visit count per slot/feature using Math.max(db, local, config)
    slots.forEach((slot, idx) => {
      const slotVisits = slotMapVisits[idx];
      let slotTotal = 0;
      Object.keys(slotVisits).forEach(feat => {
        if (feat !== 'total') {
          const dbVal = dbCounts[idx][feat] || 0;
          const localVal = localCounts[idx][feat] || 0;
          const configVal = configCounts[idx][feat] || 0;
          const finalVal = Math.max(dbVal, localVal, configVal);
          slotVisits[feat] = finalVal;
          slotTotal += finalVal;
        }
      });
      slotVisits.total = slotTotal;
    });

    const totalsVisits = emptyFeatureSet();
    slots.forEach((slot, idx) => {
      const vSlot = slotMapVisits[idx];
      Object.keys(totalsVisits).forEach(feat => {
        if (feat !== 'total') {
          totalsVisits[feat] += vSlot[feat];
        }
      });
      totalsVisits.total += vSlot.total;
    });

    const buildSeries = () => ({
      home: slots.map((s, idx) => slotMapVisits[idx].home),
      timetable: slots.map((s, idx) => slotMapVisits[idx].timetable),
      'find-prof': slots.map((s, idx) => slotMapVisits[idx]['find-prof']),
      waiver: slots.map((s, idx) => slotMapVisits[idx].waiver),
      gpa: slots.map((s, idx) => slotMapVisits[idx].gpa),
      buzz: slots.map((s, idx) => slotMapVisits[idx].buzz),
      profile: slots.map((s, idx) => slotMapVisits[idx].profile)
    });

    const visits = {
      totals: { ...totalsVisits, grandTotal: totalsVisits.total },
      series: buildSeries()
    };

    const topKey = Object.keys(totalsVisits)
      .filter(k => k !== 'total' && k !== 'admin')
      .sort((a, b) => totalsVisits[b] - totalsVisits[a])[0] || 'timetable';

    return {
      dateLabels: slots.map(s => s.label),
      fullLabels: slots.map(s => s.fullLabel),
      visits,
      clicks: visits,
      combined: visits,
      series: visits.series,
      totals: visits.totals,
      topFeatureName: FEATURE_NAMES[topKey] || 'Timetable',
      topFeatureCount: totalsVisits[topKey] || 0
    };
  }

  // ----------------------------------------------------
  // DAILY BREAKDOWN FOR 7, 30, 90 DAYS
  // ----------------------------------------------------
  const dateList = [];
  const dateMapVisits = {};
  const localCounts = {};
  const configCounts = {};
  const dbCounts = {};
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dateList.push({ dateStr, label: monthDay });
    dateMapVisits[dateStr] = emptyFeatureSet();
    localCounts[dateStr] = emptyFeatureSet();
    configCounts[dateStr] = emptyFeatureSet();
    dbCounts[dateStr] = emptyFeatureSet();
  }

  // A. Load from LocalStorage
  const localMap = getLocalAnalyticsMap();
  dateList.forEach(({ dateStr }) => {
    if (localMap[dateStr]) {
      const day = localMap[dateStr];
      const v = day.visits || day;
      Object.keys(localCounts[dateStr]).forEach(feat => {
        if (feat !== 'admin' && feat !== 'total') {
          localCounts[dateStr][feat] = Number(v[feat]) || 0;
        }
      });
    }
  });

  // B. Load from Supabase system_configs & analytics_events
  if (hasValidCredentials) {
    try {
      const { data: configData } = await supabase
        .from('system_configs')
        .select('value')
        .eq('key', 'analytics_events_v2')
        .maybeSingle();

      if (configData?.value && typeof configData.value === 'object') {
        const eventsMap = configData.value;
        dateList.forEach(({ dateStr }) => {
          if (eventsMap[dateStr]) {
            const day = eventsMap[dateStr];
            const v = day.visits || day;
            Object.keys(configCounts[dateStr]).forEach(feat => {
              if (feat !== 'admin' && feat !== 'total') {
                configCounts[dateStr][feat] = Number(v[feat]) || 0;
              }
            });
          }
        });
      }

      // Query analytics_events table directly
      const startDateStr = dateList[0]?.dateStr;
      if (startDateStr) {
        const { data: dbEvents } = await supabase
          .from('analytics_events')
          .select('feature_id, created_at')
          .gte('created_at', `${startDateStr}T00:00:00.000Z`);

        if (Array.isArray(dbEvents) && dbEvents.length > 0) {
          dbEvents.forEach(evt => {
            const evtDate = evt.created_at?.split('T')[0];
            const feat = evt.feature_id;
            if (evtDate && dbCounts[evtDate] && feat && feat !== 'admin' && dbCounts[evtDate][feat] !== undefined) {
              dbCounts[evtDate][feat] += 1;
            }
          });
        }
      }
    } catch (e) {
      console.warn('Analytics fetch notice:', e);
    }
  }

  // Aggregate single accurate visit count using Math.max(db, local, config) per date/feature
  dateList.forEach(({ dateStr }) => {
    const dayVisits = dateMapVisits[dateStr];
    let dayTotal = 0;
    Object.keys(dayVisits).forEach(feat => {
      if (feat !== 'total') {
        const dbVal = dbCounts[dateStr]?.[feat] || 0;
        const localVal = localCounts[dateStr]?.[feat] || 0;
        const configVal = configCounts[dateStr]?.[feat] || 0;
        const finalVal = Math.max(dbVal, localVal, configVal);
        dayVisits[feat] = finalVal;
        dayTotal += finalVal;
      }
    });
    dayVisits.total = dayTotal;
  });

  const totalsVisits = emptyFeatureSet();
  dateList.forEach(({ dateStr }) => {
    const vDay = dateMapVisits[dateStr];
    Object.keys(totalsVisits).forEach(feat => {
      if (feat !== 'total') {
        totalsVisits[feat] += vDay[feat];
      }
    });
    totalsVisits.total += vDay.total;
  });

  const buildSeries = (dMap) => ({
    home: dateList.map(d => dMap[d.dateStr].home),
    timetable: dateList.map(d => dMap[d.dateStr].timetable),
    'find-prof': dateList.map(d => dMap[d.dateStr]['find-prof']),
    waiver: dateList.map(d => dMap[d.dateStr].waiver),
    gpa: dateList.map(d => dMap[d.dateStr].gpa),
    buzz: dateList.map(d => dMap[d.dateStr].buzz),
    profile: dateList.map(d => dMap[d.dateStr].profile)
  });

  const visits = {
    totals: { ...totalsVisits, grandTotal: totalsVisits.total },
    series: buildSeries(dateMapVisits)
  };

  const topKey = Object.keys(totalsVisits)
    .filter(k => k !== 'total' && k !== 'admin')
    .sort((a, b) => totalsVisits[b] - totalsVisits[a])[0] || 'timetable';

  return {
    dateLabels: dateList.map(d => d.label),
    fullLabels: dateList.map(d => d.label),
    visits,
    clicks: visits,
    combined: visits,
    series: visits.series,
    totals: visits.totals,
    topFeatureName: FEATURE_NAMES[topKey] || 'Timetable',
    topFeatureCount: totalsVisits[topKey] || 0
  };
}
