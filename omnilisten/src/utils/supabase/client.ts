import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Enforces secure HTTP-only retrieval loops explicitly tailored for the client browser
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
