import { createServerSupabaseClient } from '@/lib/supabase-server'
import ListinoClient from '@/components/admin/ListinoClient'

export default async function ListinoPage() {
  const supabase = createServerSupabaseClient()
  const { data: listino } = await supabase
    .from('listino')
    .select('*')
    .order('livello')
    .order('lezioni')
  return <ListinoClient listinoIniziale={listino || []} />
}
