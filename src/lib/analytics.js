import { supabase, hasValidCredentials } from './supabaseClient';

export const FEATURE_NAMES = {
  home: 'Home Dashboard',
  timetable: 'Timetable',
  'find-prof': 'Find My Professor',
  waiver: 'Waiver Tool',
  gpa: 'GPA Calculator',
  buzz: 'Campus Buzz',
  profile: 'Profile Page'
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

    // 1. Local Storage active sessions (60s drift tolerance)
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

    // 5. Asynchronously fetch DB presence rows in background without overwriting active WebSocket state
    if (hasValidCredentials) {
      fetchActivePresenceFromDB().then(dbList => {
        if (Array.isArray(dbList) && dbList.length > 0) {
          let updated = false;
          dbList.forEach(item => {
            if (item && item.email) {
              const existing = latestPresenceMap[item.email];
              if (!existing || (item.lastPing || 0) > (existing.lastPing || 0)) {
                latestPresenceMap[item.email] = item;
                updated = true;
              }
            }
          });
          if (updated) broadcastPresenceToSubscribers();
        }
      }).catch(() => {});
    }
  } catch (e) {
    // ignore sync errors
  }
}

function sendPresencePing() {
  const payload = getPresencePayload();
  if (!payload) return;

  // 1. Immediate local memory & storage update
  updateLocalAndState([]);

  // 2. Track over WebSocket ONLY on view change or every 25 seconds
  const now = Date.now();
  if (hasValidCredentials && activePresenceChannel) {
    if (lastTrackedView !== payload.currentView || (now - lastTrackTime) > 25000) {
      lastTrackedView = payload.currentView;
      lastTrackTime = now;
      try {
        activePresenceChannel.track(payload).catch(() => {});
      } catch (e) {}
    }
  }

  // 3. Database HTTP active_presence upsert every 1 second
  if (hasValidCredentials) {
    try {
      supabase.from('active_presence').upsert({
        session_id: payload.session_id,
        user_id: payload.id,
        name: payload.name,
        email: payload.email,
        course: payload.course,
        semester: payload.semester,
        section: payload.section,
        current_view: payload.currentView,
        view_label: payload.viewLabel,
        device: payload.device,
        last_ping: new Date().toISOString()
      }).then(() => {}).catch(() => {});
    } catch (e) {}
  }
}

function initGlobalPresenceTracker() {
  if (!presenceHeartbeatTimer) {
    presenceHeartbeatTimer = setInterval(() => {
      sendPresencePing();
    }, 1000);
  }

  if (!dbPresencePollingTimer) {
    dbPresencePollingTimer = setInterval(() => {
      updateLocalAndState([]);
    }, 1000);
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

  const dateStr = new Date().toISOString().split('T')[0];

  // 1. Record in client LocalStorage immediately
  try {
    const localMap = getLocalAnalyticsMap();
    if (!localMap[dateStr]) {
      localMap[dateStr] = {
        visits: { home: 0, timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, profile: 0, total: 0 }
      };
    }
    if (!localMap[dateStr].visits) {
      localMap[dateStr].visits = { home: 0, timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, profile: 0, total: 0 };
    }
    localMap[dateStr].visits[featureId] = (localMap[dateStr].visits[featureId] || 0) + 1;
    localMap[dateStr].visits.total = (localMap[dateStr].visits.total || 0) + 1;
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

      supabase
        .from('system_configs')
        .select('value')
        .eq('key', 'analytics_events_v2')
        .maybeSingle()
        .then(async ({ data }) => {
          let eventsMap = data?.value || {};
          if (typeof eventsMap !== 'object' || !eventsMap) eventsMap = {};
          if (!eventsMap[dateStr]) {
            eventsMap[dateStr] = {
              visits: { home: 0, timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, profile: 0, total: 0 }
            };
          }
          if (!eventsMap[dateStr].visits) {
            eventsMap[dateStr].visits = { home: 0, timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, profile: 0, total: 0 };
          }

          eventsMap[dateStr].visits[featureId] = (eventsMap[dateStr].visits[featureId] || 0) + 1;
          eventsMap[dateStr].visits.total = (eventsMap[dateStr].visits.total || 0) + 1;

          await supabase.from('system_configs').upsert({
            key: 'analytics_events_v2',
            value: eventsMap,
            updated_at: new Date().toISOString()
          }).catch(() => {});
        })
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
 * Tracks ONLY Visits for the 7 student-facing pages/tools with zero double-counting.
 */
export async function fetchAnalyticsData(daysCount = 7) {
  const dateList = [];
  const emptyFeatureSet = () => ({ home: 0, timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, profile: 0, total: 0 });

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
    visits,
    clicks: visits,
    combined: visits,
    series: visits.series,
    totals: visits.totals,
    topFeatureName: FEATURE_NAMES[topKey] || 'Timetable',
    topFeatureCount: totalsVisits[topKey] || 0
  };
}
