'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Slot, FormSlot, Livello } from '@/types'
import { formatData, formatGiornoCompleto, formatOra, LIVELLO_LABEL, LIVELLO_COLORE, cn } from '@/lib/utils'
import { format, addMonths, subMonths, startOfMonth, getDaysInMonth, getDay, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

interface Props { slotsIniziali: Slot[]; adminId: string }

const LIVELLI: Livello[] = ['base', 'intermedio', 'avanzato']
const DOW = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

export default function AdminCalendarioClient({ slotsIniziali, adminId }: Props) {
  const [slots, setSlots] = useState<Slot[]>(slotsIniziali)
  const [meseCorrente, setMeseCorrente] = useState(new Date())
  const [giornoSelezionato, setGiornoSelezionato] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showForm, setShowForm] = useState(false)
  const [editSlot, setEditSlot] = useState<Slot | null>(null)
  const [showDettaglio, setShowDettaglio] = useState<Slot | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormSlot>({
    data: format(new Date(), 'yyyy-MM-dd'),
    ora_inizio: '09:00',
    ora_fine: '10:00',
    livello: 'base',
    posti_max: 4,
  })
  const supabase = createClient()

  const slotsDelGiorno = slots.filter(s => s.data === giornoSelezionato)

  const statusGiorno = useCallback((dataStr: string) => {
    const ss = slots.filter(s => s.data === dataStr)
    if (!ss.length) return null
    if (ss.every(s => s.posti_occupati >= s.posti_max)) return 'pieno'
    if (ss.some(s => s.posti_occupati > 0)) return 'parziale'
    return 'libero'
  }, [slots])

  function apriFormNuovo() {
    setEditSlot(null)
    setForm({ data: giornoSelezionato, ora_inizio: '09:00', ora_fine: '10:00', livello: 'base', posti_max: 4 })
    setShowForm(true)
  }

  function apriFormModifica(slot: Slot) {
    setEditSlot(slot)
    setForm({ data: slot.data, ora_inizio: formatOra(slot.ora_inizio), ora_fine: formatOra(slot.ora_fine), livello: slot.livello, posti_max: slot.posti_max, note: slot.note })
    setShowForm(true)
    setShowDettaglio(null)
  }

  async function salvaSlot() {
    if (!form.data || !form.ora_inizio || !form.ora_fine) return
    setLoading(true)
    try {
      if (editSlot) {
        const { data, error } = await supabase.from('slot').update({
          data: form.data, ora_inizio: form.ora_inizio, ora_fine: form.ora_fine,
          livello: form.livello, posti_max: form.posti_max, note: form.note,
        }).eq('id', editSlot.id).select().single()
        if (error) throw error
        setSlots(prev => prev.map(s => s.id === editSlot.id ? { ...s, ...data } : s))
        toast.success('Slot aggiornato')
      } else {
        const { data, error } = await supabase.from('slot').insert({
          ...form, creato_da: adminId, posti_occupati: 0, stato: 'disponibile',
        }).select().single()
        if (error) throw error
        setSlots(prev => [...prev, data])
        toast.success('Slot pubblicato')
      }
      setShowForm(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function eliminaSlot(slot: Slot) {
    if (slot.posti_occupati > 0) { toast.error('Impossibile eliminare: ci sono prenotazioni attive'); return }
    if (!confirm('Eliminare questo slot?')) return
    const { error } = await supabase.from('slot').update({ stato: 'cancellato' }).eq('id', slot.id)
    if (error) { toast.error(error.message); return }
    setSlots(prev => prev.filter(s => s.id !== slot.id))
    setShowDettaglio(null)
    toast.success('Slot eliminato')
  }

  async function aggiornaPresenza(prenotazioneId: string, stato: 'presente' | 'assente') {
    const { error } = await supabase.from('prenotazione').update({ stato }).eq('id', prenotazioneId)
    if (error) { toast.error(error.message); return }
    // Ricarica slot dettaglio
    const { data } = await supabase.from('slot').select(`*, prenotazioni:prenotazione(id, stato, iscritto:iscritto(id, nome, cognome))`).eq('id', showDettaglio!.id).single()
    if (data) { setShowDettaglio(data); setSlots(prev => prev.map(s => s.id === data.id ? data : s)) }
    toast.success('Presenza aggiornata')
  }

  // Render calendario
  const primoGiorno = startOfMonth(meseCorrente)
  const numGiorni = getDaysInMonth(meseCorrente)
  const offsetInizio = getDay(primoGiorno)
  const oggiStr = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Colonna sinistra: calendario + slot del giorno */}
      <div className="lg:col-span-2 space-y-4">

        {/* Calendario */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setMeseCorrente(m => subMonths(m, 1))} className="btn-secondary px-2 py-1 text-xs">‹</button>
            <span className="font-medium text-sm capitalize">{format(meseCorrente, 'MMMM yyyy', { locale: it })}</span>
            <button onClick={() => setMeseCorrente(m => addMonths(m, 1))} className="btn-secondary px-2 py-1 text-xs">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {DOW.map(d => <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>)}
            {Array.from({ length: offsetInizio }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: numGiorni }).map((_, i) => {
              const d = i + 1
              const dataStr = format(new Date(meseCorrente.getFullYear(), meseCorrente.getMonth(), d), 'yyyy-MM-dd')
              const status = statusGiorno(dataStr)
              const isOggi = dataStr === oggiStr
              const isSel = dataStr === giornoSelezionato
              return (
                <button key={d} onClick={() => { setGiornoSelezionato(dataStr); setShowForm(false) }}
                  className={cn('relative flex flex-col items-center py-1 rounded-lg text-sm transition-colors border',
                    isSel ? 'bg-brand-50 border-brand-200 text-brand-800 font-medium' :
                    isOggi ? 'border-blue-200 text-blue-700' : 'border-transparent hover:bg-gray-50 text-gray-700'
                  )}>
                  {d}
                  {status && (
                    <span className={cn('w-1.5 h-1.5 rounded-full mt-0.5',
                      status === 'libero' ? 'bg-green-500' :
                      status === 'parziale' ? 'bg-amber-500' : 'bg-red-500'
                    )} />
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
            {[['bg-green-500','Libero'],['bg-amber-500','Parziale'],['bg-red-500','Pieno']].map(([c,l]) => (
              <div key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${c}`} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Slot del giorno selezionato */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-sm capitalize">{formatGiornoCompleto(giornoSelezionato)}</h2>
            <button onClick={apriFormNuovo} className="btn-primary text-xs px-3 py-1.5">+ Nuovo slot</button>
          </div>
          {slotsDelGiorno.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">Nessuno slot per questo giorno</p>
          ) : (
            <div className="space-y-2">
              {slotsDelGiorno.map(slot => (
                <div key={slot.id}
                  onClick={() => { setShowDettaglio(slot); setShowForm(false) }}
                  className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    showDettaglio?.id === slot.id ? 'border-brand-200 bg-brand-50' : 'border-gray-100 hover:bg-gray-50'
                  )}>
                  <span className="text-sm font-medium min-w-[100px]">
                    {formatOra(slot.ora_inizio)}–{formatOra(slot.ora_fine)}
                  </span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', LIVELLO_COLORE[slot.livello])}>
                    {LIVELLO_LABEL[slot.livello]}
                  </span>
                  <div className="flex gap-1 ml-auto">
                    {Array.from({ length: slot.posti_max }).map((_, i) => (
                      <span key={i} className={cn('w-2.5 h-2.5 rounded-sm',
                        i < slot.posti_occupati ? 'bg-brand-600' : 'bg-green-200')} />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">{slot.posti_occupati}/{slot.posti_max}</span>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => apriFormModifica(slot)} className="p-1 text-gray-400 hover:text-gray-700 rounded">✎</button>
                    <button onClick={() => eliminaSlot(slot)} className="p-1 text-gray-400 hover:text-red-600 rounded">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Colonna destra: form / dettaglio */}
      <div className="space-y-4">
        {/* Form nuovo/modifica slot */}
        {showForm && (
          <div className="card">
            <h3 className="font-medium text-sm mb-4">{editSlot ? 'Modifica slot' : 'Nuovo slot'}</h3>
            <div className="space-y-3">
              <div><label className="label">Data</label>
                <input type="date" className="input" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Inizio</label>
                  <input type="time" className="input" value={form.ora_inizio} onChange={e => setForm(f => ({ ...f, ora_inizio: e.target.value }))} /></div>
                <div><label className="label">Fine</label>
                  <input type="time" className="input" value={form.ora_fine} onChange={e => setForm(f => ({ ...f, ora_fine: e.target.value }))} /></div>
              </div>
              <div><label className="label">Livello</label>
                <select className="input" value={form.livello} onChange={e => setForm(f => ({ ...f, livello: e.target.value as Livello }))}>
                  {LIVELLI.map(l => <option key={l} value={l}>{LIVELLO_LABEL[l]}</option>)}
                </select></div>
              <div><label className="label">Posti (max 4)</label>
                <select className="input" value={form.posti_max} onChange={e => setForm(f => ({ ...f, posti_max: Number(e.target.value) }))}>
                  {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select></div>
              <div><label className="label">Note (opzionale)</label>
                <input type="text" className="input" value={form.note || ''} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>
              <div className="flex gap-2 pt-1">
                <button onClick={salvaSlot} disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Salvataggio...' : editSlot ? 'Salva' : 'Pubblica'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Annulla</button>
              </div>
            </div>
          </div>
        )}

        {/* Dettaglio slot con presenze */}
        {showDettaglio && !showForm && (
          <div className="card">
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-100">
              <div>
                <div className="text-xs text-gray-500 mb-1">{formatData(showDettaglio.data)}</div>
                <div className="font-medium">{formatOra(showDettaglio.ora_inizio)}–{formatOra(showDettaglio.ora_fine)}</div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block', LIVELLO_COLORE[showDettaglio.livello])}>
                  {LIVELLO_LABEL[showDettaglio.livello]}
                </span>
              </div>
              <div className="text-right">
                <div className="text-lg font-medium">{showDettaglio.posti_occupati}/{showDettaglio.posti_max}</div>
                <div className="text-xs text-gray-500">posti</div>
              </div>
            </div>

            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Iscritti prenotati</h4>
            {!showDettaglio.prenotazioni?.length ? (
              <p className="text-sm text-gray-400 py-3 text-center">Nessuna prenotazione</p>
            ) : (
              <div className="space-y-2">
                {(showDettaglio.prenotazioni as any[]).filter(p => p.stato !== 'cancellata').map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-brand-800 text-xs font-medium flex-shrink-0">
                      {p.iscritto?.nome?.[0]}{p.iscritto?.cognome?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.iscritto?.nome} {p.iscritto?.cognome}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => aggiornaPresenza(p.id, 'presente')}
                        className={cn('px-2 py-1 rounded text-xs font-medium border transition-colors',
                          p.stato === 'presente' ? 'bg-green-100 border-green-300 text-green-800' : 'border-gray-200 text-gray-500 hover:bg-green-50')}>
                        ✓
                      </button>
                      <button
                        onClick={() => aggiornaPresenza(p.id, 'assente')}
                        className={cn('px-2 py-1 rounded text-xs font-medium border transition-colors',
                          p.stato === 'assente' ? 'bg-red-100 border-red-300 text-red-800' : 'border-gray-200 text-gray-500 hover:bg-red-50')}>
                        ✗
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => apriFormModifica(showDettaglio)} className="btn-secondary w-full mt-3 text-xs">Modifica slot</button>
          </div>
        )}
      </div>
    </div>
  )
}
