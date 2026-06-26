'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setReady(true)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
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

  if (!ready) return null

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
          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            <input type="text" style={{ display: 'none' }} />
            <input type="password" style={{ display: 'none' }} />
            <div>
              <label className="label">Email</label>