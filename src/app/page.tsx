import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function Home() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Controlla se è admin cercando per email
  const { data: admin } = await supabase
    .from('admin')
    .select('id')
    .eq('email', user.email ?? '')
    .maybeSingle()

  if (admin) redirect('/admin/calendario')
  else redirect('/iscritto/calendario')
}
