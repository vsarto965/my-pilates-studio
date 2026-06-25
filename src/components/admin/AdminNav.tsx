'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin/calendario', label: 'Calendario' },
  { href: '/admin/tesserini', label: 'Iscritti' },
  { href: '/admin/listino', label: 'Listino' },
  { href: '/admin/fatture', label: 'Fatture' },
]

export default function AdminNav({ email }: { email: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white text-xs font-semibold">M</div>
            <span className="font-medium text-sm">My Pilates Studio</span>
          </div>
          <div className="flex gap-1">
            {NAV.map(n => (
              <Link key={n.href} href={n.href}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm transition-colors',
                  pathname.startsWith(n.href)
                    ? 'bg-brand-50 text-brand-800 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                )}>
                {n.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-brand-50 text-brand-800 px-2 py-0.5 rounded-full font-medium">Admin</span>
          <button onClick={logout} className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
            Esci
          </button>
        </div>
      </div>
    </nav>
  )
}
