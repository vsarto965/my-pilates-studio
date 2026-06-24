import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function IscrittoLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: iscritto } = await supabase
    .from('iscritto')
    .select('id, nome, cognome')
    .eq('auth_user_id', user.id)
    .single()

  if (!iscritto) redirect('/login')

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
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
