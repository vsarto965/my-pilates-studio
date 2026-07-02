import { createServerSupabaseClient } from '@/lib/supabase-server'
import AdminAvvisoClient from '@/components/admin/AdminAvvisoClient'

export default async function AdminAvvisoPage() {
  const supabase = createServerSupabaseClient()

  const { data: avvisi } = await supabase
    .from('avviso')
    .select('*')
    .order('data_inizio', { ascending: false })

  const { data: admin } = await supabase
    .from('admin')
    .select('id')
    .limit(1)
    .single()

  return <AdminAvvisoClient avvisiIniziali={avvisi || []} adminId={admin?.id || ''} />
}
