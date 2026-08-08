const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY environment variables.');
  console.error('Set them in your shell before running this script.');
  process.exit(1);
}

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
