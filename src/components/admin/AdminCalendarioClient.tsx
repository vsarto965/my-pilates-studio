'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Slot, FormSlot, Livello } from '@/types'
import { formatData, formatGiornoCompleto, formatOra, LIVELLO_LABEL, LIVELLO_COLORE, cn } from '@/lib/utils'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, getDaysInMonth, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

interface Props { slotsIniziali: Slot[]; adminId: string }

const LIVELLI: Livello[] = ['base', 'intermedio', 'avanzato']
const DOW = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const DOW_LABELS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

interface Orario { ora_inizio: string; ora_fine: string }

interface FormGeneratore {
  data_inizio: string
  data_fine: string
  giorni: number[]
  orari: Orario[]
  livello: Livello
  posti_max: number
  note: string
}

export default function AdminCalendarioClient({ slotsIniziali, adminId }: Props) {
  const [slots, setSlots] = useState<Slot[]>(slotsIniziali)
  const [meseCorrente, setMeseCorrente] = useState(new Date())
  const [giornoSelezionato, setGiornoSelezionato] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showForm, setShowForm] = useState(false)
  const [showGeneratore, setShowGeneratore] = useState(false)
  const [editSlot, setEditSlot] = useState<Slot | null>(null)
  const [showDettaglio, setShowDettaglio] = useState<Slot | null>(null)
  const [prenotazioniDettaglio, setPrenotazioniDettaglio] = useState<any[]>([])
  const [loadingDettaglio, setLoadingDettaglio] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMese, setLoadingMese] = useState(false)
  // Tiene traccia dei mesi già scaricati dal database (formato 'yyyy-MM'), per non richiederli ogni volta
  const mesiCaricatiRef = useRef<Set<string>>(new Set([
    format(new Date(), 'yyyy-MM'),
    format(addMonths(new Date(), 1), 'yyyy-MM'),
  ]))
  const [form, setForm] = useState<FormSlot>({
    data: format(new Date(), 'yyyy-MM-dd'),
    ora_inizio: '09:00',
    ora_fine: '10:00',
    livello: 'base',
    posti_max: 4,
  })
  const oggiStr = format(new Date(), 'yyyy-MM-dd')
  const [formGen, setFormGen] = useState<FormGeneratore>({
    data_inizio: oggiStr,
    data_fine: oggiStr,
    giorni: [1, 2, 3, 4, 5],
    orari: [{ ora_inizio: '09:00', ora_fine: '10:00' }],
    livello: 'base',
    posti_max: 4,
    note: '',
  })

  const supabase = createClient()
  const slotsDelGiorno = slots.filter(s => s.data === giornoSelezionato)

  // Ogni volta che l'admin cambia mese nel calendario, se quel mese non è ancora stato
  // scaricato dal database, lo richiede e aggiunge gli slot a quelli già in memoria.
  useEffect(() => {
    const chiaveMese = format(meseCorrente, 'yyyy-MM')
    if (mesiCaricatiRef.current.has(chiaveMese)) return
    mesiCaricatiRef.current.add(chiaveMese)

    async function caricaSlotDelMese() {
      setLoadingMese(true)
      try {
        const inizioMese = format(startOfMonth(meseCorrente), 'yyyy-MM-dd')
        const fineMese = format(endOfMonth(meseCorrente), 'yyyy-MM-dd')
        const { data, error } = await supabase
          .from('slot')
          .select(`*, prenotazioni:prenotazione(id, stato, iscritto:iscritto(id, nome, cognome, email))`)
          .gte('data', inizioMese)
          .lte('data', fineMese)
          .neq('stato', 'cancellato')
          .order('data')
          .order('ora_inizio')
        if (error) throw error
        setSlots(prev => {
          const mappa = new Map(prev.map(s => [s.id, s]))
          for (const s of data || []) mappa.set(s.id, s)
          return Array.from(mappa.values())
        })
      } catch {
        toast.error('Errore caricamento slot del mese')
      } finally {
        setLoadingMese(false)
      }
    }
    caricaSlotDelMese()
  }, [meseCorrente])

  const statusGiorno = useCallback((dataStr: string) => {
    const ss = slots.filter(s => s.data === dataStr)
    if (!ss.length) return null
    if (ss.every(s => s.posti_occupati >= s.posti_max)) return 'pieno'
    if (ss.some(s => s.posti_occupati > 0)) return 'parziale'
    return 'libero'
  }, [slots])

  async function apriDettaglio(slot: Slot) {
    setShowDettaglio(slot)
    setShowForm(false)
    setShowGeneratore(false)
    setLoadingDettaglio(true)
    try {
      const { data, error } = await supabase
        .from('prenotazione')
        .select(`id, stato, prenotata_at, iscritto:iscritto(id, nome, cognome, email, telefono)`)
        .eq('slot_id', slot.id)
        .neq('stato', 'cancellata')
        .order('prenotata_at')
      if (error) throw error
      setPrenotazioniDettaglio(data || [])
    } catch {
      toast.error('Errore caricamento prenotazioni')
    } finally {
      setLoadingDettaglio(false)
    }
  }

  function apriFormNuovo() {
    setEditSlot(null)
    setShowDettaglio(null)
    setShowGeneratore(false)
    setForm({ data: giornoSelezionato, ora_inizio: '09:00', ora_fine: '10:00', livello: 'base', posti_max: 4 })
    setShowForm(true)
    // Su mobile: scroll verso il form
    setTimeout(() => {
      document.getElementById('pannello-laterale')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function apriGeneratore() {
    setShowForm(false)
    setShowDettaglio(null)
    setShowGeneratore(true)
    setTimeout(() => {
      document.getElementById('pannello-laterale')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function apriFormModifica(slot: Slot) {
    setEditSlot(slot)
    setForm({ data: slot.data, ora_inizio: formatOra(slot.ora_inizio), ora_fine: formatOra(slot.ora_fine), livello: slot.livello, posti_max: slot.posti_max, note: slot.note })
    setShowForm(true)
    setShowDettaglio(null)
    setShowGeneratore(false)
    setTimeout(() => {
      document.getElementById('pannello-laterale')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
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

  async function generaSlotMultipli() {
    if (!formGen.data_inizio || !formGen.data_fine) { toast.error('Seleziona data inizio e fine'); return }
    if (formGen.giorni.length === 0) { toast.error('Seleziona almeno un giorno della settimana'); return }
    if (formGen.orari.length === 0) { toast.error('Inserisci almeno un orario'); return }
    if (formGen.data_inizio < oggiStr) { toast.error('La data di inizio non può essere nel passato'); return }
    if (formGen.data_fine < formGen.data_inizio) { toast.error('La data di fine deve essere successiva alla data di inizio'); return }

    setLoading(true)
    try {
      const nuoviSlots: object[] = []
      let dataCorrente = new Date(formGen.data_inizio)
      const dataFine = new Date(formGen.data_fine)
      while (dataCorrente <= dataFine) {
        const dowCorrente = dataCorrente.getDay()
        if (formGen.giorni.includes(dowCorrente)) {
          const dataStr = format(dataCorrente, 'yyyy-MM-dd')
          for (const orario of formGen.orari) {
            nuoviSlots.push({
              data: dataStr, ora_inizio: orario.ora_inizio, ora_fine: orario.ora_fine,
              livello: formGen.livello, posti_max: formGen.posti_max,
              posti_occupati: 0, stato: 'disponibile', creato_da: adminId,
              note: formGen.note || null,
            })
          }
        }
        dataCorrente = addDays(dataCorrente, 1)
      }
      if (nuoviSlots.length === 0) { toast.error('Nessuno slot generato: controlla i giorni selezionati nel range di date'); return }
      const { data, error } = await supabase.from('slot').insert(nuoviSlots).select()
      if (error) throw error
      setSlots(prev => [...prev, ...(data || [])])
      toast.success(`${nuoviSlots.length} slot generati con successo!`)
      setShowGeneratore(false)
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
    const corrente = prenotazioniDettaglio.find(p => p.id === prenotazioneId)
    const nuovoStato = corrente?.stato === stato ? 'confermata' : stato
    const { error } = await supabase.from('prenotazione').update({ stato: nuovoStato }).eq('id', prenotazioneId)
    if (error) { toast.error(error.message); return }
    setPrenotazioniDettaglio(prev => prev.map(p => p.id === prenotazioneId ? { ...p, stato: nuovoStato } : p))
    toast.success(nuovoStato === 'presente' ? 'Segnata presente' : nuovoStato === 'assente' ? 'Segnata assente' : 'Presenza rimossa')
  }

  function toggleGiorno(dow: number) {
    setFormGen(f => ({
      ...f,
      giorni: f.giorni.includes(dow) ? f.giorni.filter(g => g !== dow) : [...f.giorni, dow].sort()
    }))
  }

  function aggiungiOrario() {
    if (formGen.orari.length >= 5) return
    setFormGen(f => ({ ...f, orari: [...f.orari, { ora_inizio: '09:00', ora_fine: '10:00' }] }))
  }

  function rimuoviOrario(idx: number) {
    setFormGen(f => ({ ...f, orari: f.orari.filter((_, i) => i !== idx) }))
  }

  function aggiornaOrario(idx: number, campo: keyof Orario, valore: string) {
    setFormGen(f => ({
      ...f,
      orari: f.orari.map((o, i) => i === idx ? { ...o, [campo]: valore } : o)
    }))
  }

  function selectDay(d: number) {
    const dataStr = format(new Date(meseCorrente.getFullYear(), meseCorrente.getMonth(), d), 'yyyy-MM-dd')
    setGiornoSelezionato(dataStr)
    setShowForm(false)
    setShowDettaglio(null)
    setShowGeneratore(false)
  }

  const primoGiorno = startOfMonth(meseCorrente)
  const numGiorni = getDaysInMonth(meseCorrente)
  const offsetInizio = primoGiorno.getDay()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">

        {/* Calendario */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setMeseCorrente(m => subMonths(m, 1))} className="btn-secondary px-3 py-1.5 text-sm">‹</button>
            <span className="font-medium text-sm capitalize">
              {format(meseCorrente, 'MMMM yyyy', { locale: it })}
              {loadingMese && <span className="text-gray-400 font-normal"> · caricamento...</span>}
            </span>
            <button onClick={() => setMeseCorrente(m => addMonths(m, 1))} className="btn-secondary px-3 py-1.5 text-sm">›</button>
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
                <button key={d} onClick={() => selectDay(d)}
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

        {/* Slot del giorno */}
        <div className="card">
          {/* Header: titolo + bottoni su righe separate su mobile */}
          <div className="mb-4">
            <h2 className="font-medium text-sm capitalize mb-3">{formatGiornoCompleto(giornoSelezionato)}</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={apriGeneratore}
                className="btn-secondary text-xs px-3 py-2.5 flex items-center justify-center gap-1.5">
                <span>⚡</span> Genera multipli
              </button>
              <button onClick={apriFormNuovo}
                className="btn-primary text-xs px-3 py-2.5 flex items-center justify-center gap-1.5">
                <span>+</span> Nuovo slot
              </button>
            </div>
          </div>

          {slotsDelGiorno.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">Nessuno slot per questo giorno</p>
          ) : (
            <div className="space-y-2">
              {slotsDelGiorno.map(slot => (
                <div key={slot.id}
                  onClick={() => apriDettaglio(slot)}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-colors',
                    showDettaglio?.id === slot.id ? 'border-brand-200 bg-brand-50' : 'border-gray-100 hover:bg-gray-50'
                  )}>
                  {/* Riga superiore: orario + badge livello */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">
                      {formatOra(slot.ora_inizio)}–{formatOra(slot.ora_fine)}
                    </span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', LIVELLO_COLORE[slot.livello])}>
                      {LIVELLO_LABEL[slot.livello]}
                    </span>
                  </div>
                  {slot.note && (
                    <div className="text-xs text-gray-500 mb-2 italic">📝 {slot.note}</div>
                  )}
                  {/* Riga inferiore: posti + azioni */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: slot.posti_max }).map((_, i) => (
                          <span key={i} className={cn('w-3 h-3 rounded-sm',
                            i < slot.posti_occupati ? 'bg-brand-600' : 'bg-green-200')} />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">{slot.posti_occupati}/{slot.posti_max}</span>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => apriFormModifica(slot)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
                        title="Modifica">
                        ✎
                      </button>
                      <button
                        onClick={() => eliminaSlot(slot)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                        title="Elimina">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Colonna destra (form / dettaglio) */}
      <div className="space-y-4" id="pannello-laterale">

        {/* Form genera slot multipli */}
        {showGeneratore && (
          <div className="card">
            <h3 className="font-medium text-sm mb-4">⚡ Genera slot multipli</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Data inizio</label>
                  <input type="date" className="input" min={oggiStr} value={formGen.data_inizio}
                    onChange={e => setFormGen(f => ({ ...f, data_inizio: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Data fine</label>
                  <input type="date" className="input" min={formGen.data_inizio} value={formGen.data_fine}
                    onChange={e => setFormGen(f => ({ ...f, data_fine: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Giorni della settimana</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {[1,2,3,4,5,6,0].map(dow => (
                    <button key={dow} type="button"
                      onClick={() => toggleGiorno(dow)}
                      className={cn('px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                        formGen.giorni.includes(dow)
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      )}>
                      {DOW_LABELS[dow].slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Orari</label>
                  {formGen.orari.length < 5 && (
                    <button type="button" onClick={aggiungiOrario}
                      className="text-xs text-brand-600 hover:text-brand-800 font-medium">
                      + Aggiungi orario
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {formGen.orari.map((orario, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="time" className="input flex-1" value={orario.ora_inizio}
                        onChange={e => aggiornaOrario(idx, 'ora_inizio', e.target.value)} />
                      <span className="text-gray-400 text-xs">→</span>
                      <input type="time" className="input flex-1" value={orario.ora_fine}
                        onChange={e => aggiornaOrario(idx, 'ora_fine', e.target.value)} />
                      {formGen.orari.length > 1 && (
                        <button type="button" onClick={() => rimuoviOrario(idx)}
                          className="text-gray-400 hover:text-red-500 text-sm px-1">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Livello</label>
                  <select className="input" value={formGen.livello}
                    onChange={e => setFormGen(f => ({ ...f, livello: e.target.value as Livello }))}>
                    {LIVELLI.map(l => <option key={l} value={l}>{LIVELLO_LABEL[l]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Posti max</label>
                  <select className="input" value={formGen.posti_max}
                    onChange={e => setFormGen(f => ({ ...f, posti_max: Number(e.target.value) }))}>
                    {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Note (opzionale)</label>
                <input type="text" className="input" value={formGen.note}
                  onChange={e => setFormGen(f => ({ ...f, note: e.target.value }))} />
              </div>

              {formGen.data_inizio && formGen.data_fine && formGen.giorni.length > 0 && (() => {
                let count = 0
                let d = new Date(formGen.data_inizio)
                const fine = new Date(formGen.data_fine)
                while (d <= fine) {
                  if (formGen.giorni.includes(d.getDay())) count++
                  d = addDays(d, 1)
                }
                const totale = count * formGen.orari.length
                return totale > 0 ? (
                  <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
                    Verranno creati <span className="font-semibold text-gray-700">{totale} slot</span>
                    {' '}({count} {count === 1 ? 'giorno' : 'giorni'} × {formGen.orari.length} {formGen.orari.length === 1 ? 'orario' : 'orari'})
                  </div>
                ) : null
              })()}

              <div className="flex gap-2 pt-1">
                <button onClick={generaSlotMultipli} disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Generazione...' : 'Genera slot'}
                </button>
                <button onClick={() => setShowGeneratore(false)} className="btn-secondary">Annulla</button>
              </div>
            </div>
          </div>
        )}

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

        {/* Dettaglio slot */}
        {showDettaglio && !showForm && !showGeneratore && (
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
                <div className="text-xl font-medium">{showDettaglio.posti_occupati}/{showDettaglio.posti_max}</div>
                <div className="text-xs text-gray-500">posti occupati</div>
              </div>
            </div>
            {showDettaglio.note && (
              <div className="text-xs text-gray-500 italic mb-3 pb-3 border-b border-gray-100">📝 {showDettaglio.note}</div>
            )}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-gray-500 uppercase">Iscritti prenotati</h4>
              {loadingDettaglio && <span className="text-xs text-gray-400">Caricamento...</span>}
            </div>
            {!loadingDettaglio && prenotazioniDettaglio.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">Nessuna prenotazione</p>
            )}
            {!loadingDettaglio && prenotazioniDettaglio.length > 0 && (
              <div className="divide-y divide-gray-50">
                {prenotazioniDettaglio.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 py-3">
                    <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-800 text-xs font-medium flex-shrink-0">
                      {p.iscritto?.nome?.[0]}{p.iscritto?.cognome?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{p.iscritto?.nome} {p.iscritto?.cognome}</div>
                      <div className="text-xs text-gray-400 truncate">{p.iscritto?.email}</div>
                      {p.iscritto?.telefono && (
                        <div className="text-xs text-gray-400">{p.iscritto.telefono}</div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => aggiornaPresenza(p.id, 'presente')} title="Presente"
                        className={cn('px-2 py-1 rounded text-xs font-medium border transition-colors',
                          p.stato === 'presente' ? 'bg-green-100 border-green-300 text-green-800' : 'border-gray-200 text-gray-400 hover:bg-green-50')}>
                        ✓
                      </button>
                      <button onClick={() => aggiornaPresenza(p.id, 'assente')} title="Assente"
                        className={cn('px-2 py-1 rounded text-xs font-medium border transition-colors',
                          p.stato === 'assente' ? 'bg-red-100 border-red-300 text-red-800' : 'border-gray-200 text-gray-400 hover:bg-red-50')}>
                        ✗
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => apriFormModifica(showDettaglio)} className="btn-secondary w-full mt-3 text-xs">
              ✎ Modifica slot
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
