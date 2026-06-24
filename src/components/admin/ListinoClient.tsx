'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Listino, Livello } from '@/types'
import { formatEuro, LIVELLO_LABEL, LIVELLO_COLORE, formatDataBreve, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const LIVELLI: Livello[] = ['base', 'intermedio', 'avanzato']

export default function ListinoClient({ listinoIniziale }: { listinoIniziale: Listino[] }) {
  const [listino, setListino] = useState(listinoIniziale)
  const [editId, setEditId] = useState<string | null>(null)
  const [showNuovo, setShowNuovo] = useState(false)
  const [form, setForm] = useState({ livello: 'base' as Livello, lezioni: 10, prezzo: 0, descrizione: '' })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function salva() {
    if (!form.prezzo || !form.lezioni) { toast.error('Compila tutti i campi'); return }
    setLoading(true)
    try {
      if (editId) {
        const { data, error } = await supabase.from('listino').update(form).eq('id', editId).select().single()
        if (error) throw error
        setListino(prev => prev.map(l => l.id === editId ? data : l))
        toast.success('Voce aggiornata')
        setEditId(null)
      } else {
        const { data, error } = await supabase.from('listino').insert({ ...form, attivo: true, valido_dal: new Date().toISOString().split('T')[0] }).select().single()
        if (error) throw error
        setListino(prev => [...prev, data])
        toast.success('Voce aggiunta')
        setShowNuovo(false)
      }
    } catch (err: any) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  async function toggleAttivo(voce: Listino) {
    const { error } = await supabase.from('listino').update({ attivo: !voce.attivo }).eq('id', voce.id)
    if (error) { toast.error(error.message); return }
    setListino(prev => prev.map(l => l.id === voce.id ? { ...l, attivo: !l.attivo } : l))
  }

  function avviaModifica(voce: Listino) {
    setEditId(voce.id)
    setForm({ livello: voce.livello, lezioni: voce.lezioni, prezzo: voce.prezzo, descrizione: voce.descrizione || '' })
    setShowNuovo(false)
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-medium">Listino prezzi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Le voci attive sono proposte all'admin nella creazione dei tesserini</p>
        </div>
        <button onClick={() => { setShowNuovo(true); setEditId(null); setForm({ livello: 'base', lezioni: 10, prezzo: 0, descrizione: '' }) }} className="btn-primary">+ Aggiungi</button>
      </div>

      {/* Form nuovo/modifica */}
      {(showNuovo || editId) && (
        <div className="card border-brand-100">
          <h3 className="font-medium text-sm mb-3">{editId ? 'Modifica voce' : 'Nuova voce'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Livello</label>
              <select className="input" value={form.livello} onChange={e => setForm(f => ({ ...f, livello: e.target.value as Livello }))}>
                {LIVELLI.map(l => <option key={l} value={l}>{LIVELLO_LABEL[l]}</option>)}
              </select></div>
            <div><label className="label">N. lezioni</label>
              <input type="number" className="input" min={1} value={form.lezioni} onChange={e => setForm(f => ({ ...f, lezioni: Number(e.target.value) }))} /></div>
            <div><label className="label">Prezzo (€)</label>
              <input type="number" className="input" step="0.01" min={0} value={form.prezzo} onChange={e => setForm(f => ({ ...f, prezzo: Number(e.target.value) }))} /></div>
            <div><label className="label">Descrizione</label>
              <input type="text" className="input" value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={salva} disabled={loading} className="btn-primary">{loading ? '...' : 'Salva'}</button>
            <button onClick={() => { setEditId(null); setShowNuovo(false) }} className="btn-secondary">Annulla</button>
          </div>
        </div>
      )}

      {/* Tabella listino */}
      <div className="card divide-y divide-gray-50">
        {listino.map(voce => (
          <div key={voce.id} className={cn('flex items-center gap-3 py-3', !voce.attivo && 'opacity-50')}>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', LIVELLO_COLORE[voce.livello])}>
              {LIVELLO_LABEL[voce.livello]}
            </span>
            <span className="text-sm font-medium">{voce.lezioni} lezioni</span>
            <span className="text-sm text-gray-500 flex-1">{voce.descrizione}</span>
            <span className="font-medium text-sm">{formatEuro(voce.prezzo)}</span>
            <span className="text-xs text-gray-400">dal {formatDataBreve(voce.valido_dal)}</span>
            <div className="flex gap-1">
              <button onClick={() => avviaModifica(voce)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-50 text-sm" title="Modifica">✎</button>
              <button onClick={() => toggleAttivo(voce)} className={cn('p-1.5 rounded-md text-sm transition-colors', voce.attivo ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50')} title={voce.attivo ? 'Disattiva' : 'Attiva'}>
                {voce.attivo ? '●' : '○'}
              </button>
            </div>
          </div>
        ))}
        {listino.length === 0 && <p className="text-center text-gray-400 text-sm py-6">Nessuna voce nel listino</p>}
      </div>
    </div>
  )
}
