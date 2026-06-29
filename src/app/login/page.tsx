'use client'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Vista = 'login' | 'reset_richiesta' | 'reset_inviata'

export default function LoginPage() {
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const emailResetRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [vista, setVista] = useState<Vista>('login')
  const supabase = createClient()

  async function handleLogin() {
    const email = emailRef.current?.value || ''
    const password = passwordRef.current?.value || ''
    if (!email || !password) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (email.toLowerCase() === 'volo211965@gmail.com') {
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

  async function handleRichiestaReset() {
    const email = emailResetRef.current?.value || ''
    if (!email) { toast.error('Inserisci la tua email'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setVista('reset_inviata')
    } catch (err: any) {
      toast.error('Errore nell\'invio: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white font-semibold text-lg mb-3">
            M
          </div>
          <h1 className="text-xl font-medium text-gray-900">My Pilates Studio</h1>
          <p className="text-sm text-gray-500 mt-1">
            {vista === 'login' && 'Accedi al tuo account'}
            {vista === 'reset_richiesta' && 'Recupera la password'}
            {vista === 'reset_inviata' && 'Email inviata'}
          </p>
        </div>

        {/* Form login */}
        {vista === 'login' && (
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
              <button
                onClick={() => setVista('reset_richiesta')}
                className="w-full text-center text-xs text-brand-600 hover:text-brand-800 transition-colors pt-1"
              >
                Password dimenticata?
              </button>
            </div>
          </div>
        )}

        {/* Form richiesta reset */}
        {vista === 'reset_richiesta' && (
          <div className="card shadow-sm">
            <p className="text-sm text-gray-600 mb-4">
              Inserisci la tua email. Ti invieremo un link per scegliere una nuova password.
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  ref={emailResetRef}
                  type="text"
                  inputMode="email"
                  className="input"
                  placeholder="tua@email.it"
                  defaultValue=""
                />
              </div>
              <button
                onClick={handleRichiestaReset}
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Invio in corso...' : 'Invia link di reset'}
              </button>
              <button
                onClick={() => setVista('login')}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← Torna al login
              </button>
            </div>
          </div>
        )}

        {/* Conferma invio */}
        {vista === 'reset_inviata' && (
          <div className="card shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto text-green-600 text-xl">
              ✓
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Email inviata!</p>
              <p className="text-sm text-gray-500 mt-1">
                Controlla la tua casella di posta e clicca il link per impostare una nuova password.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Non trovi l'email? Controlla anche la cartella spam.
              </p>
            </div>
            <button
              onClick={() => setVista('login')}
              className="w-full text-center text-xs text-brand-600 hover:text-brand-800 transition-colors"
            >
              ← Torna al login
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Non hai ancora un account? Contatta la palestra.
        </p>
      </div>
    </div>
  )
}
