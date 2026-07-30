const { createClient } = require('c:/Users/adity/Downloads/SSCBS OS/node_modules/@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://vsmxgcncmhxwwmnyicna.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXhnY25jbWh4d3dtbnlpY25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0OTQxNDksImV4cCI6MjA5OTA3MDE0OX0.Kh8emr9ZpNiGBdEOG4QQ08kjmPGWdYUA4aUWoDeWkik';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function syncTimetableToSupabase() {
  console.log('Reading src/data/timetables.json...');
  const raw = fs.readFileSync('src/data/timetables.json', 'utf8');
  const timetablesData = JSON.parse(raw);

  console.log('Upserting timetable into Supabase system_configs table...');
  const { data, error } = await supabase
    .from('system_configs')
    .upsert({
      key: 'timetable',
      value: timetablesData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

  if (error) {
    console.error('Supabase Sync Error:', error);
  } else {
    console.log('SUCCESS! Timetable synced to Supabase system_configs successfully for ALL USERS!');
  }
}

syncTimetableToSupabase();
