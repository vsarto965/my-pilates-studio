import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { format } from 'date-fns'

export default async function IscrittoLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: iscritto } = await supabase
    .from('iscritto')
    .select('id, nome, cognome, stato')
    .eq('auth_user_id', user.id)
    .single()

  if (!iscritto) redirect('/login')

  // Avvisi attualmente nel loro periodo di validità (solo per iscritti attivi)
  const oggi = format(new Date(), 'yyyy-MM-dd')
  let avvisi: { id: string; testo: string }[] = []
  if (iscritto.stato === 'attivo') {
    const { data } = await supabase
      .from('avviso')
      .select('*')
      .lte('data_inizio', oggi)
      .gte('data_fine', oggi)
      .order('data_inizio')
    avvisi = data || []
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white text-xs font-semibold">M</div>
            <span className="font-medium text-sm">My Pilates Studio</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Ciao, {iscritto.nome}</span>
            <a href="/login" className="text-xs text-gray-400 hover:text-gray-700">Esci</a>
          </div>
        </div>
      </nav>
      <main className="max-w-2xl mx-auto px-4 py-6">
        {avvisi && avvisi.length > 0 && (
          <div className="space-y-2 mb-4">
            {avvisi.map(a => (
              <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 flex items-start gap-2">
                <span className="flex-shrink-0">📢</span>
                <span>{a.testo}</span>
              </div>
            ))}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
