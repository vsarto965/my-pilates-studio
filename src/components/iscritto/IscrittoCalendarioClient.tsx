'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Iscritto, Tesserino, Slot, Prenotazione } from '@/types'
import { formatGiornoCompleto, formatOra, formatDataBreve, formatEuro, LIVELLO_LABEL, LIVELLO_COLORE, STATO_TESSERINO_COLORE, puoCancellareConRestituzione, cn } from '@/lib/utils'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, getDaysInMonth, getDay } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

interface Props {
  iscritto: Iscritto
  tesserino: Tesserino | null
  slotsDisponibili: Slot[]
  prenotazioniAttive: Prenotazione[]
}

const DOW = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const ORE_CANCELLAZIONE = 24

export default function IscrittoCalendarioClient({ iscritto, tesserino: tessInit, slotsDisponibili: slotsIniziali, prenotazioniAttive: prenInit }: Props) {
  const [tesserino, setTesserino] = useState(tessInit)
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>(prenInit)
  const [slotsDisponibili, setSlotsDisponibili] = useState<Slot[]>(slotsIniziali)
  const [meseCorrente, setMeseCorrente] = useState(new Date())
  const [giornoSel, setGiornoSel] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showPrenotazioni, setShowPrenotazioni] = useState(false)
  const [conferma, setConferma] = useState<{ slot: Slot; tipo: 'prenota' | 'cancella'; prenotazioneId?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMese, setLoadingMese] = useState(false)
  const supabase = createClient()

  // La pagina carica inizialmente solo i prossimi 60 giorni: qui teniamo traccia
  // di quali mesi sono già stati scaricati, per richiedere gli altri quando l'iscritto
  // naviga il calendario con le freccette ‹ ›
  const mesiCaricatiRef = useRef<Set<string>>(new Set([
    format(new Date(), 'yyyy-MM'),
    format(addMonths(new Date(), 1), 'yyyy-MM'),
    format(addMonths(new Date(), 2), 'yyyy-MM'),
  ]))

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
          .select('*')
          .gte('data', inizioMese)
          .lte('data', fineMese)
          .eq('stato', 'disponibile')
          .order('data').order('ora_inizio')
        if (error) throw error
        setSlotsDisponibili(prev => {
          const mappa = new Map(prev.map(s => [s.id, s]))
          for (const s of data || []) mappa.set(s.id, s)
          return Array.from(mappa.values())
        })

        // Carica anche le prenotazioni confermate di questo iscritto in quel mese
        // (la query iniziale della pagina prende solo quelle future)
        const { data: prenMese, error: errPren } = await supabase
          .from('prenotazione')
          .select('*, slot:slot(*)')
          .eq('iscritto_id', iscritto.id)
          .eq('stato', 'confermata')
          .gte('slot.data', inizioMese)
          .lte('slot.data', fineMese)
        if (errPren) throw errPren
        setPrenotazioni(prev => {
          const mappa = new Map(prev.map(p => [p.id, p]))
          for (const p of prenMese || []) if (p.slot) mappa.set(p.id, p)
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

  const slotIds = new Set(slotsDisponibili.map(s => s.id))
  const prenSlotIds = new Set(prenotazioni.map(p => (p.slot as any)?.id || p.slot_id))

  const slotsGiorno = slotsDisponibili.filter(s => s.data === giornoSel)

  const statusGiorno = useCallback((dataStr: string) => {
    const ss = slotsDisponibili.filter(s => s.data === dataStr)
    if (!ss.length) return null
    if (ss.some(s => prenSlotIds.has(s.id))) return 'prenotato'
    if (ss.every(s => s.posti_occupati >= s.posti_max)) return 'pieno'
    if (ss.some(s => s.posti_occupati > 0)) return 'parziale'
    return 'libero'
  }, [slotsDisponibili, prenSlotIds])

  function isPrenotato(slot: Slot) {
    return prenotazioni.some(p => (p.slot as any)?.id === slot.id || p.slot_id === slot.id)
  }

  function getPrenotazione(slot: Slot) {
    return prenotazioni.find(p => (p.slot as any)?.id === slot.id || p.slot_id === slot.id)
  }

  async function eseguiPrenotazione() {
    if (!conferma || !tesserino) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('prenota_slot', {
        p_iscritto_id: iscritto.id,
        p_slot_id: conferma.slot.id,
        p_tesserino_id: tesserino.id,
      })
      if (error) throw error
      setPrenotazioni(prev => [...prev, { ...data, slot: conferma.slot }])
      setTesserino(t => t ? { ...t, lezioni_residue: t.lezioni_residue - 1 } : t)
      toast.success('Prenotazione confermata!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
      setConferma(null)
    }
  }

  async function eseguiCancellazione() {
    if (!conferma?.prenotazioneId) return
    setLoading(true)
    try {
      const { data: restituisce, error } = await supabase.rpc('cancella_prenotazione', {
        p_prenotazione_id: conferma.prenotazioneId,
        p_iscritto_id: iscritto.id,
      })
      if (error) throw error
      setPrenotazioni(prev => prev.filter(p => p.id !== conferma.prenotazioneId))
      if (restituisce) {
        setTesserino(t => t ? { ...t, lezioni_residue: t.lezioni_residue + 1 } : t)
        toast.success('Prenotazione cancellata — lezione restituita al tesserino')
      } else {
        toast.success('Prenotazione cancellata (lezione non restituita: meno di 24h allo slot)')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
      setConferma(null)
    }
  }

  // Prossima prenotazione
  const prossimaPrenotazione = prenotazioni
    .filter(p => p.slot)
    .sort((a, b) => ((a.slot as any)?.data || '').localeCompare((b.slot as any)?.data || ''))
    .find(p => ((p.slot as any)?.data || '') >= format(new Date(), 'yyyy-MM-dd'))

  const primoGiorno = startOfMonth(meseCorrente)
  const numGiorni = getDaysInMonth(meseCorrente)
  const offsetInizio = getDay(primoGiorno)
  const oggiStr = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="space-y-4">

      {/* Modal conferma */}
      {conferma && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm border border-gray-100">
            <h3 className="font-medium mb-2">{conferma.tipo === 'prenota' ? 'Conferma prenotazione' : 'Cancella prenotazione'}</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{formatOra(conferma.slot.ora_inizio)}–{formatOra(conferma.slot.ora_fine)}</strong> · <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', (LIVELLO_COLORE as Record<string, string>)[conferma.slot.livello])}>{(LIVELLO_LABEL as Record<string, string>)[conferma.slot.livello]}</span>
              <br /><br />
              {conferma.tipo === 'prenota'
                ? <>Verrà scalata <strong>1 lezione</strong> dal tesserino. Lezioni rimanenti: <strong>{(tesserino?.lezioni_residue || 1) - 1}</strong></>
                : puoCancellareConRestituzione(conferma.slot.data, conferma.slot.ora_inizio, ORE_CANCELLAZIONE)
                  ? <>Cancelli con più di {ORE_CANCELLAZIONE}h di anticipo: la lezione verrà <strong>restituita</strong> al tesserino.</>
                  : <>Meno di {ORE_CANCELLAZIONE}h allo slot: la lezione <strong>non verrà restituita</strong>.</>
              }
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConferma(null)} className="btn-secondary flex-1">Annulla</button>
              <button
                onClick={conferma.tipo === 'prenota' ? eseguiPrenotazione : eseguiCancellazione}
                disabled={loading}
                className={conferma.tipo === 'prenota' ? 'btn-primary flex-1' : 'btn-danger flex-1'}>
                {loading ? '...' : conferma.tipo === 'prenota' ? 'Conferma' : 'Cancella'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tesserino */}
      {tesserino ? (
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Il mio tesserino</div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', (LIVELLO_COLORE as Record<string, string>)[tesserino.livello])}>
                  {(LIVELLO_LABEL as Record<string, string>)[tesserino.livello]}
                </span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATO_TESSERINO_COLORE[tesserino.stato])}>
                  {tesserino.stato}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-medium">{tesserino.lezioni_residue}</div>
              <div className="text-xs text-gray-500">lezioni rimaste</div>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
            <div className="bg-brand-600 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.round(tesserino.lezioni_residue / tesserino.lezioni_totali * 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>{tesserino.lezioni_residue} di {tesserino.lezioni_totali} lezioni</span>
            <span>scade {formatDataBreve(tesserino.data_scadenza)}</span>
          </div>
        </div>
      ) : (
        <div className="card text-center py-4 text-sm text-gray-500">
          Nessun tesserino attivo — contatta la palestra
        </div>
      )}

      {/* Prossima lezione */}
      {prossimaPrenotazione && (
        <div className="card bg-brand-50 border-brand-100">
          <div className="text-xs text-brand-700 font-medium mb-1">Prossima lezione</div>
          <div className="flex items-center gap-3">
            <div>
              <div className="font-medium text-sm capitalize">
                {formatGiornoCompleto((prossimaPrenotazione.slot as any).data)}
              </div>
              <div className="text-sm text-gray-600">
                {formatOra((prossimaPrenotazione.slot as any).ora_inizio)}–{formatOra((prossimaPrenotazione.slot as any).ora_fine)}
                {' · '}
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', (LIVELLO_COLORE as Record<string, string>)[(prossimaPrenotazione.slot as any).livello])}>
                  {(LIVELLO_LABEL as Record<string, string>)[(prossimaPrenotazione.slot as any).livello]}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowPrenotazioni(!showPrenotazioni)}
              className="ml-auto btn-secondary text-xs px-2 py-1">
              Tutte ({prenotazioni.length})
            </button>
          </div>
        </div>
      )}

      {/* Lista prenotazioni */}
      {showPrenotazioni && prenotazioni.length > 0 && (
        <div className="card divide-y divide-gray-50">
          {prenotazioni.map(p => {
            const s = p.slot as any
            if (!s) return null
            return (
              <div key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1">
                  <div className="text-sm font-medium capitalize">{formatGiornoCompleto(s.data)}</div>
                  <div className="text-xs text-gray-500">{formatOra(s.ora_inizio)}–{formatOra(s.ora_fine)}</div>
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', (LIVELLO_COLORE as Record<string, string>)[s.livello])}>{(LIVELLO_LABEL as Record<string, string>)[s.livello]}</span>
                <button
                  onClick={() => setConferma({ slot: s, tipo: 'cancella', prenotazioneId: p.id })}
                  className="btn-danger text-xs px-2 py-1">
                  Cancella
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Calendario */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMeseCorrente(m => subMonths(m, 1))} className="btn-secondary px-2 py-1 text-xs">‹</button>
          <span className="font-medium text-sm capitalize">
            {format(meseCorrente, 'MMMM yyyy', { locale: it })}
            {loadingMese && <span className="text-gray-400 font-normal"> · caricamento...</span>}
          </span>
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
            const isSel = dataStr === giornoSel
            const isPast = dataStr < oggiStr
            return (
              <button key={d}
                onClick={() => setGiornoSel(dataStr)}
                className={cn('relative flex flex-col items-center py-1 rounded-lg text-sm transition-colors border',
                  isPast ? 'text-gray-300 border-transparent cursor-default' :
                  isSel ? 'bg-brand-50 border-brand-200 text-brand-800 font-medium' :
                  isOggi ? 'border-blue-200 text-blue-700' : 'border-transparent hover:bg-gray-50 text-gray-700'
                )}>
                {d}
                {status && (
                  <span className={cn('w-1.5 h-1.5 rounded-full mt-0.5',
                    status === 'prenotato' ? 'bg-brand-600' :
                    status === 'libero' ? 'bg-green-500' :
                    status === 'parziale' ? 'bg-amber-500' : 'bg-red-500'
                  )} />
                )}
              </button>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 flex-wrap">
          {[['bg-brand-600','Prenotato'],['bg-green-500','Disponibile'],['bg-amber-500','Quasi pieno'],['bg-red-500','Pieno']].map(([c,l]) => (
            <div key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-2 h-2 rounded-full ${c}`} />{l}
            </div>
          ))}
        </div>
      </div>

      {/* Slot del giorno */}
      <div className="card">
        <h2 className="font-medium text-sm capitalize mb-3">{formatGiornoCompleto(giornoSel)}</h2>
        {giornoSel < oggiStr && (
          <p className="text-xs text-gray-400 mb-3">Giorno passato — solo consultazione, nessuna azione disponibile</p>
        )}
        {slotsGiorno.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">Nessuno slot disponibile</p>
        ) : (
          <div className="space-y-2">
            {slotsGiorno.map(slot => {
              const prenotato = isPrenotato(slot)
              const pieno = !prenotato && slot.posti_occupati >= slot.posti_max
              const pren = getPrenotazione(slot)
              const passato = slot.data < oggiStr
              return (
                <div key={slot.id} className={cn('p-3 rounded-lg border transition-colors',
                  prenotato ? 'border-green-200 bg-green-50' :
                  pieno ? 'border-gray-100 opacity-60' : 'border-gray-100 hover:border-brand-200')}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">{formatOra(slot.ora_inizio)}–{formatOra(slot.ora_fine)}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', (LIVELLO_COLORE as Record<string, string>)[slot.livello])}>
                      {(LIVELLO_LABEL as Record<string, string>)[slot.livello]}
                    </span>
                    {prenotato && <span className="text-xs text-green-700 font-medium ml-auto">✓ Prenotato</span>}
                    {pieno && <span className="text-xs text-red-600 ml-auto">Pieno</span>}
                    {!prenotato && !pieno && <span className="text-xs text-gray-500 ml-auto">{slot.posti_max - slot.posti_occupati} post{slot.posti_max - slot.posti_occupati === 1 ? 'o' : 'i'} liberi</span>}
                  </div>
                  {slot.note && (
                    <div className="text-xs text-gray-500 mb-2 italic">📝 {slot.note}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {Array.from({ length: slot.posti_max }).map((_, i) => (
                        <span key={i} className={cn('w-2.5 h-2.5 rounded-sm',
                          i < slot.posti_occupati ? (prenotato && i === slot.posti_occupati - 1 ? 'bg-brand-600' : 'bg-red-300') : 'bg-green-200')} />
                      ))}
                    </div>
                    {!passato && prenotato && pren && (
                      <button
                        onClick={() => setConferma({ slot, tipo: 'cancella', prenotazioneId: pren.id })}
                        className="ml-auto btn-danger text-xs px-3 py-1">
                        Cancella
                      </button>
                    )}
                    {!passato && !prenotato && !pieno && tesserino && (
                      <button
                        onClick={() => setConferma({ slot, tipo: 'prenota' })}
                        className="ml-auto btn-primary text-xs px-3 py-1">
                        Prenota
                      </button>
                    )}
                    {!passato && !prenotato && !pieno && !tesserino && (
                      <span className="ml-auto text-xs text-gray-400">Nessun tesserino attivo</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
