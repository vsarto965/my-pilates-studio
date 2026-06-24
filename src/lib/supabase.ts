import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/index'

// Client lato browser (componenti React client-side)
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
