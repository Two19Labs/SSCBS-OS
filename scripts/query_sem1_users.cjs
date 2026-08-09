/**
 * SSCBS OS — Semester 1 Active Student Analysis
 * 
 * Strategy: Since user_progress requires authentication (RLS),
 * and we have 10,871 analytics events with 447 distinct user_ids,
 * we can cross-reference user_ids against the system_configs table
 * which stores analytics data, and derive semester info from the
 * active_presence or by querying the Supabase Auth Admin API.
 * 
 * Final approach: Use the REST API directly to query with admin headers
 * or use what's publicly available.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vsmxgcncmhxwwmnyicna.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXhnY25jbWh4d3dtbnlpY25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0OTQxNDksImV4cCI6MjA5OTA3MDE0OX0.Kh8emr9ZpNiGBdEOG4QQ08kjmPGWdYUA4aUWoDeWkik';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const now = Date.now();

  console.log('='.repeat(70));
  console.log('  SSCBS OS — Comprehensive Active User Analysis');
  console.log(`  Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  console.log('='.repeat(70));

  // Pull ALL analytics events (not just last 30 days) to get complete picture
  let allEvents = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  
  console.log('\n⏳ Fetching ALL analytics_events...');
  while (true) {
    const { data: events, error } = await supabase
      .from('analytics_events')
      .select('user_id, feature_id, event_type, created_at')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    
    if (error || !events || events.length === 0) break;
    allEvents = allEvents.concat(events);
    if (events.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`  Total analytics events (all time): ${allEvents.length}`);

  // Build user activity profiles
  const userProfiles = {};
  
  allEvents.forEach(ev => {
    if (!ev.user_id) return;
    
    if (!userProfiles[ev.user_id]) {
      userProfiles[ev.user_id] = {
        id: ev.user_id,
        totalEvents: 0,
        firstSeen: ev.created_at,
        lastSeen: ev.created_at,
        features: {},
        activeDays: new Set()
      };
    }
    
    const profile = userProfiles[ev.user_id];
    profile.totalEvents++;
    
    const evDate = ev.created_at?.split('T')[0];
    if (evDate) profile.activeDays.add(evDate);
    
    const evTime = new Date(ev.created_at).getTime();
    const firstTime = new Date(profile.firstSeen).getTime();
    const lastTime = new Date(profile.lastSeen).getTime();
    
    if (evTime < firstTime) profile.firstSeen = ev.created_at;
    if (evTime > lastTime) profile.lastSeen = ev.created_at;
    
    profile.features[ev.feature_id] = (profile.features[ev.feature_id] || 0) + 1;
  });

  const totalUsers = Object.keys(userProfiles).length;
  
  // Time-based activity classification
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const active30d = Object.values(userProfiles).filter(u => (now - new Date(u.lastSeen).getTime()) < THIRTY_DAYS);
  const active7d = Object.values(userProfiles).filter(u => (now - new Date(u.lastSeen).getTime()) < SEVEN_DAYS);
  const active1d = Object.values(userProfiles).filter(u => (now - new Date(u.lastSeen).getTime()) < ONE_DAY);

  // "Regular" users = 3+ distinct active days in last 30 days
  const thirtyDaysAgo = new Date(now - THIRTY_DAYS).toISOString().split('T')[0];
  const regularUsers = active30d.filter(u => {
    const recentDays = Array.from(u.activeDays).filter(d => d >= thirtyDaysAgo);
    return recentDays.length >= 3;
  });

  // "Power" users = 10+ events in last 30 days AND 5+ distinct days
  const powerUsers = active30d.filter(u => {
    const recentDays = Array.from(u.activeDays).filter(d => d >= thirtyDaysAgo);
    return u.totalEvents >= 10 && recentDays.length >= 5;
  });

  console.log('\n' + '─'.repeat(70));
  console.log('  📊 OVERALL PLATFORM ACTIVITY');
  console.log('─'.repeat(70));
  console.log(`  Total unique users (all time)     : ${totalUsers}`);
  console.log(`  Active users (last 24 hours)      : ${active1d.length}`);
  console.log(`  Active users (last 7 days)        : ${active7d.length}`);
  console.log(`  Active users (last 30 days)       : ${active30d.length}`);
  console.log(`  Regular users (3+ days in 30d)    : ${regularUsers.length}`);
  console.log(`  Power users (10+ events, 5+ days) : ${powerUsers.length}`);

  // Engagement metrics
  const avgEventsPerUser = active30d.length > 0 
    ? (active30d.reduce((s, u) => s + u.totalEvents, 0) / active30d.length).toFixed(1) 
    : 0;
  const avgDaysPerUser = active30d.length > 0
    ? (active30d.reduce((s, u) => s + u.activeDays.size, 0) / active30d.length).toFixed(1)
    : 0;

  console.log(`\n  Avg events per active user (30d)   : ${avgEventsPerUser}`);
  console.log(`  Avg active days per user (30d)     : ${avgDaysPerUser}`);

  // Feature popularity
  console.log('\n  📈 Feature Usage (All Time):');
  const featureTotals = {};
  allEvents.forEach(ev => {
    featureTotals[ev.feature_id] = (featureTotals[ev.feature_id] || 0) + 1;
  });
  Object.entries(featureTotals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([feat, count]) => {
      const pct = ((count / allEvents.length) * 100).toFixed(1);
      console.log(`    • ${feat.padEnd(15)} : ${String(count).padStart(6)} events (${pct}%)`);
    });

  // Daily activity trend (last 14 days)
  console.log('\n  📅 Daily Active Users (Last 14 Days):');
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * ONE_DAY);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    const dayUsers = new Set();
    allEvents.forEach(ev => {
      if (ev.user_id && ev.created_at?.startsWith(dateStr)) {
        dayUsers.add(ev.user_id);
      }
    });
    
    const bar = '█'.repeat(Math.min(50, dayUsers.size));
    console.log(`    ${dayLabel.padEnd(16)} : ${String(dayUsers.size).padStart(4)} users  ${bar}`);
  }

  // Registration trend (first-time users by week)
  console.log('\n  📥 New User Registrations (by week, based on first event):');
  const weekBuckets = {};
  Object.values(userProfiles).forEach(u => {
    const firstDate = new Date(u.firstSeen);
    // Get Monday of that week
    const day = firstDate.getDay();
    const diff = firstDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(firstDate.setDate(diff));
    const weekKey = monday.toISOString().split('T')[0];
    weekBuckets[weekKey] = (weekBuckets[weekKey] || 0) + 1;
  });
  
  Object.entries(weekBuckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)  // Last 8 weeks
    .forEach(([week, count]) => {
      const bar = '█'.repeat(Math.min(50, count));
      console.log(`    Week of ${week} : ${String(count).padStart(4)} new users  ${bar}`);
    });

  console.log('\n' + '─'.repeat(70));
  console.log('  ⚠️  NOTE ON SEMESTER 1 DATA');
  console.log('─'.repeat(70));
  console.log('  The analytics_events table does NOT store semester info.');
  console.log('  Semester data is stored in user_progress.settings (JSONB),');
  console.log('  which requires authenticated admin access (RLS policy).');
  console.log('');
  console.log('  To get semester-specific breakdowns, you would need to:');
  console.log('  1. Log into the SSCBS OS Admin Console (admin tab)');
  console.log('  2. View the Student Demographics panel');
  console.log('  3. Filter by Semester = 1');
  console.log('');
  console.log('  Alternatively, provide a Supabase service_role key to');
  console.log('  bypass RLS and query user_progress directly.');

  console.log('\n' + '='.repeat(70));
  console.log('  ✅ Report Complete');
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
