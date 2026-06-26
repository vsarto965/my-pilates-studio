'use client'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleLogin() {
    const email = emailRef.current?.value || ''
    const password = passwordRef.current?.value || ''
    if (!email || !password) {
      toast.error('Inserisci email e password')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (email === 'volo211965@gmail.com') {
        window.location.href = '/admin/calendario'
      } else {
        window.location.href = '/iscritto/calendario'
      }
    } catch (err: any) {
      toast.error(err.message === 'Invalid login credentials'
        ? 'Email o password non corretti'
        : 'Errore di accesso')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white font-semibold text-lg mb-3">
            M
          </div>
          <h1 className="text-xl font-medium text-gray-900">My Pilates Studio</h1>
          <p className="text-sm text-gray-500 mt-1">Accedi al tuo account</p>
        </div>
        <div className="card shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                ref={emailRef}
                type="text"
                inputMode="email"
                className="input"
                placeholder="tua@email.it"
                defaultValue=""
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                ref={passwordRef}
                type="password"
                className="input"
                placeholder="••••••••"
                defaultValue=""
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          Non hai ancora un account? Contatta la palestra.
        </p>
      </div>
    </div>
  )
}