// AppleTree Family — Supabase Client
// Replace the environment variables in .env.local before use

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client (for use in Client Components)
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Singleton for convenience
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// ─── Type helpers ─────────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      users: { Row: import('./types').User }
      trees: { Row: import('./types').Tree }
      members: { Row: import('./types').Member }
      relationships: { Row: import('./types').Relationship }
    }
  }
}
