'use client'
import { useRef, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const passwordRef = useRef<HTMLInputElement>(null)
  const password2Ref = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [fatto, setFatto] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // La sessione è già stata impostata dalla API route /api/auth/confirm
    // Verifichiamo solo che esista una sessione valida
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setPronto(true)
      } else {
        // Nessuna sessione: link scaduto o non valido
        setPronto(false)
        toast.error('Link scaduto o non valido. Richiedi un nuovo link.')
        setTimeout(() => { window.location.href = '/login' }, 3000)
      }
    })
  }, [])

  async function handleReset() {
    const password = passwordRef.current?.value || ''
    const password2 = password2Ref.current?.value || ''
    if (!password || password.length < 6) {
      toast.error('La password deve essere di almeno 6 caratteri')
      return
    }
    if (password !== password2) {
      toast.error('Le password non coincidono')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setFatto(true)
      toast.success('Password aggiornata!')
      setTimeout(() => { window.location.href = '/login' }, 2500)
    } catch (err: any) {
      toast.error('Errore: ' + err.message)
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
          <p className="text-sm text-gray-500 mt-1">Nuova password</p>
        </div>

        {/* Attesa verifica sessione */}
        {!pronto && !fatto && (
          <div className="card shadow-sm text-center py-6">
            <p className="text-sm text-gray-500">Verifica in corso...</p>
          </div>
        )}

        {/* Form nuova password */}
        {pronto && !fatto && (
          <div className="card shadow-sm">
            <p className="text-sm text-gray-600 mb-4">
              Scegli una nuova password per il tuo account.
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">Nuova password</label>
                <input
                  ref={passwordRef}
                  type="password"
                  className="input"
                  placeholder="Minimo 6 caratteri"
                  defaultValue=""
                />
              </div>
              <div>
                <label className="label">Conferma password</label>
                <input
                  ref={password2Ref}
                  type="password"
                  className="input"
                  placeholder="Ripeti la password"
                  defaultValue=""
                />
              </div>
              <button
                onClick={handleReset}
                disabled={loading}
                className="btn-primary w-full">
                {loading ? 'Salvataggio...' : 'Salva nuova password'}
              </button>
            </div>
          </div>
        )}

        {/* Conferma */}
        {fatto && (
          <div className="card shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto text-green-600 text-xl">
              ✓
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Password aggiornata!</p>
              <p className="text-sm text-gray-500 mt-1">Verrai reindirizzato al login...</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
