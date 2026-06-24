import { createServerSupabaseClient } from '@/lib/supabase-server'
import TesseriniClient from '@/components/admin/TesseriniClient'

export default async function TesseriniPage() {
  const supabase = createServerSupabaseClient()

  const { data: iscritti } = await supabase
    .from('iscritto')
    .select(`*, tesserini:tesserino(*)`)
    .neq('stato', 'eliminato')
    .order('cognome')

  const { data: listino } = await supabase
    .from('listino')
    .select('*')
    .eq('attivo', true)
    .order('livello').order('lezioni')

  return <TesseriniClient iscrittiIniziali={iscritti || []} listino={listino || []} />
}
