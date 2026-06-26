import { createServerSupabaseClient } from '@/lib/supabase-server'
import AdminFattureClient from '@/components/admin/AdminFattureClient'

export default async function AdminfatturePage() {
  const supabase = createServerSupabaseClient()

  const { data: fatture } = await supabase
    .from('fattura')
    .select(`
      *,
      iscritto:iscritto(id, nome, cognome, email, codice_fiscale)
    `)
    .order('created_at', { ascending: false })

  const { data: studio } = await supabase
  .from('public.studio')
    .select('*')
    .limit(1)
    .single()

  return (
    <AdminFattureClient
      fattureIniziali={fatture || []}
      studioIniziale={studio}
    />
  )
}