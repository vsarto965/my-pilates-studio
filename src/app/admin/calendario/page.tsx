import { createServerSupabaseClient } from '@/lib/supabase-server'
import AdminCalendarioClient from '@/components/admin/AdminCalendarioClient'

export default async function AdminCalendarioPage() {
  const supabase = createServerSupabaseClient()

  // Carica slot del mese corrente e successivo
  const oggi = new Date()
  const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1)
    .toISOString().split('T')[0]
  const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 2, 0)
    .toISOString().split('T')[0]

  const { data: slots } = await supabase
    .from('slot')
    .select(`*, prenotazioni:prenotazione(id, stato, iscritto:iscritto(id, nome, cognome, email))`)
    .gte('data', inizioMese)
    .lte('data', fineMese)
    .neq('stato', 'cancellato')
    .order('data')
    .order('ora_inizio')

  const { data: admin } = await supabase
    .from('admin')
    .select('id')
    .limit(1)
    .single()

  return <AdminCalendarioClient slotsIniziali={slots || []} adminId={admin?.id || ''} />
}
