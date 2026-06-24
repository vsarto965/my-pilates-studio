import { createServerSupabaseClient } from '@/lib/supabase-server'
import IscrittoCalendarioClient from '@/components/iscritto/IscrittoCalendarioClient'

export default async function IscrittoCalendarioPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: iscritto } = await supabase
    .from('iscritto')
    .select('*')
    .eq('auth_user_id', user!.id)
    .single()

  // Tesserino attivo
  const { data: tesserino } = await supabase
    .from('tesserino')
    .select('*')
    .eq('iscritto_id', iscritto!.id)
    .eq('stato', 'attivo')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Slot dei prossimi 60 giorni
  const oggi = new Date().toISOString().split('T')[0]
  const fra60 = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
  const { data: slots } = await supabase
    .from('slot')
    .select('*')
    .gte('data', oggi)
    .lte('data', fra60)
    .eq('stato', 'disponibile')
    .order('data').order('ora_inizio')

  // Prenotazioni attive dell'iscritto
  const { data: prenotazioni } = await supabase
    .from('prenotazione')
    .select('*, slot:slot(*)')
    .eq('iscritto_id', iscritto!.id)
    .eq('stato', 'confermata')
    .gte('slot.data', oggi)

  return (
    <IscrittoCalendarioClient
      iscritto={iscritto!}
      tesserino={tesserino || null}
      slotsDisponibili={slots || []}
      prenotazioniAttive={prenotazioni || []}
    />
  )
}
