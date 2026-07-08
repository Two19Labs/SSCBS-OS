import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are placeholders or missing
const isPlaceholder = !supabaseUrl || !supabaseAnonKey || 
  supabaseUrl.includes('your-project-id') || 
  supabaseAnonKey.includes('your-anon-public-key');

if (isPlaceholder) {
  console.warn(
    'Supabase URL or Anon Key is missing or using placeholder values. ' +
    'Authentication and cloud saving features will not work until you configure your .env file.'
  );
}

// Initialize the Supabase client
export const supabase = createClient(
  supabaseUrl && !supabaseUrl.includes('your-project-id') ? supabaseUrl : 'https://placeholder-project.supabase.co',
  supabaseAnonKey && !supabaseAnonKey.includes('your-anon-public-key') ? supabaseAnonKey : 'placeholder-key'
);

export const hasValidCredentials = !isPlaceholder;
