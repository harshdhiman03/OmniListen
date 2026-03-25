import { createClient } from '@supabase/supabase-js';

// Using the backend environment variable since this is a server-side route
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// We use the SECRET service_role key here because we need to query user vectors securely
// securely from the server side without worrying about active client sessions.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase credentials missing from Next.js environment variables. Check .env.local.");
}

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
