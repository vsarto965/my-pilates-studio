'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Iscritto {
  id: string
  nome: string
  cognome: string
  email: string
  codice_fiscale?: string
}

interface Fattura {
  id: string
  numero?: string
  anno: number
  iscritto: Iscritto
  iscritto_id: string
  tesserino_id?: string
  descrizione: string
  importo_imponibile: number
  aliquota_iva: number
  importo_iva: number
  importo_totale: number
  stato: 'bozza' | 'emessa' | 'annullata'
  emessa_at?: string
  created_at: string
}

interface Studio {
  id: string
  nome: string
  indirizzo: string
  cap: string
  citta: string
  provincia: string
  partita_iva: string
  codice_fiscale: string
  email: string
  telefono: string
  iva_default: number
}

interface Props {
  fattureIniziali: Fattura[]
  studioIniziale: Studio | null
}

const STATO_LABEL: Record<string, string> = {
  bozza: 'Bozza',
  emessa: 'Emessa',
  annullata: 'Annullata',
}

const STATO_COLORE: Record<string, string> = {
  bozza: 'bg-amber-100 text-amber-800',
  emessa: 'bg-green-100 text-green-800',
  annullata: 'bg-red-100 text-red-800',
}

export default function AdminFattureClient({ fattureIniziali, studioIniziale }: Props) {
  const [fatture, setFatture] = useState<Fattura[]>(fattureIniziali)
  const [studio, setStudio] = useState<Studio | null>(studioIniziale)
  const [showStudio, setShowStudio] = useState(false)
  const [showNuovaFattura, setShowNuovaFattura] = useState(false)
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [loading, setLoading] = useState<string | null>(null)
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null)
  const [formStudio, setFormStudio] = useState<Studio>(
    studioIniziale || {
      id: '', nome: '', indirizzo: '', cap: '', citta: '', provincia: '',
      partita_iva: '', codice_fiscale: '', email: '', telefono: '', iva_default: 22,
    }
  )
  const [formNuova, setFormNuova] = useState({
    iscritto_id: '',
    descrizione: '',
    importo_imponibile: '',
    aliquota_iva: String(studioIniziale?.iva_default || 22),
  })
  const [cercaIscritto, setCercaIscritto] = useState('')
  const [iscrittiRisultati, setIscrittiRisultati] = useState<Iscritto[]>([])

  const supabase = createClient()

  const fattureFiltrate = fatture.filter(f =>
    filtroStato === 'tutti' ? true : f.stato === filtroStato
  )

  async function cercaIscritti(q: string) {
    setCercaIscritto(q)
    if (q.length < 2) { setIscrittiRisultati([]); return }
    const { data } = await supabase
      .from('iscritto')
      .select('id, nome, cognome, email, codice_fiscale')
      .or(`nome.ilike.%${q}%,cognome.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(5)
    setIscrittiRisultati(data || [])
  }

  function selezionaIscritto(iscritto: Iscritto) {
    setFormNuova(f => ({ ...f, iscritto_id: iscritto.id }))
    setCercaIscritto(`${iscritto.nome} ${iscritto.cognome}`)
    setIscrittiRisultati([])
  }

  function calcolaTotali(imponibile: string, aliquota: string) {
    const imp = parseFloat(imponibile) || 0
    const ali = parseFloat(aliquota) || 0
    const iva = Math.round(imp * ali) / 100
    return { iva: iva.toFixed(2), totale: (imp + iva).toFixed(2) }
  }

  const { iva, totale } = calcolaTotali(formNuova.importo_imponibile, formNuova.aliquota_iva)

  async function salvaNuovaFattura() {
    if (!formNuova.iscritto_id) { toast.error('Seleziona un iscritto'); return }
    if (!formNuova.descrizione) { toast.error('Inserisci una descrizione'); return }
    if (!formNuova.importo_imponibile || parseFloat(formNuova.importo_imponibile) <= 0) {
      toast.error('Inserisci un importo valido'); return
    }
    setLoading('nuova')
    try {
      const imp = parseFloat(formNuova.importo_imponibile)
      const ali = parseFloat(formNuova.aliquota_iva)
      const ivaCalc = Math.round(imp * ali) / 100
      const { data, error } = await supabase.from('fattura').insert({
        iscritto_id: formNuova.iscritto_id,
        descrizione: formNuova.descrizione,
        importo_imponibile: imp,
        aliquota_iva: ali,
        importo_iva: ivaCalc,
        importo_totale: imp + ivaCalc,
        stato: 'bozza',
        anno: new Date().getFullYear(),
      }).select(`*, iscritto:iscritto(id, nome, cognome, email, codice_fiscale)`).single()
      if (error) throw error
      setFatture(prev => [data as Fattura, ...prev])
      toast.success('Fattura in bozza creata')
      setShowNuovaFattura(false)
      setFormNuova({ iscritto_id: '', descrizione: '', importo_imponibile: '', aliquota_iva: String(studio?.iva_default || 22) })
      setCercaIscritto('')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(null)
    }
  }

  async function emettiFattura(fattura: Fattura) {
    if (!confirm(`Emettere la fattura per ${fattura.iscritto.nome} ${fattura.iscritto.cognome}?\nQuesta azione assegnerà il numero definitivo e non potrà essere modificata.`)) return
    setLoading(fattura.id)
    try {
      const { data, error } = await supabase.rpc('emetti_fattura', { p_fattura_id: fattura.id })
      if (error) throw error
      setFatture(prev => prev.map(f => f.id === fattura.id ? { ...f, ...data, iscritto: f.iscritto } : f))
      toast.success(`Fattura ${data.numero} emessa!`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(null)
    }
  }

  async function scaricaPdf(fattura: Fattura) {
    setLoadingPdf(fattura.id)
    try {
      const res = await fetch(`/api/fatture/${fattura.id}/pdf`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Errore generazione PDF')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fattura.numero
        ? `fattura-${fattura.numero.replace('/', '-')}.pdf`
        : `fattura-bozza.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoadingPdf(null)
    }
  }

  async function salvaStudio() {
    setLoading('studio')
    try {
      const { error } = await supabase
        .from('studio')
        .update(formStudio)
        .eq('id', formStudio.id)
      if (error) throw error
      setStudio(formStudio)
      toast.success('Dati studio salvati')
      setShowStudio(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold">Fatture</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {fatture.filter(f => f.stato === 'bozza').length} in bozza · {fatture.filter(f => f.stato === 'emessa').length} emesse
        </p>
      </div>

      {/* Bottoni azione */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => { setShowStudio(true); setShowNuovaFattura(false) }}
          className="btn-secondary text-xs px-3 py-2.5 flex items-center justify-center gap-1.5">
          ⚙ Dati studio
        </button>
        <button
          onClick={() => { setShowNuovaFattura(true); setShowStudio(false) }}
          className="btn-primary text-xs px-3 py-2.5 flex items-center justify-center gap-1.5">
          + Nuova fattura
        </button>
      </div>

      {/* Form nuova fattura */}
      {showNuovaFattura && (
        <div className="card" id="form-fattura">
          <h3 className="font-medium text-sm mb-4">Nuova fattura</h3>
          <div className="space-y-3">
            <div className="relative">
              <label className="label">Iscritto</label>
              <input type="text" className="input" placeholder="Cerca per nome o email..."
                value={cercaIscritto} onChange={e => cercaIscritti(e.target.value)} autoComplete="off" />
              {iscrittiRisultati.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {iscrittiRisultati.map(i => (
                    <button key={i.id} onClick={() => selezionaIscritto(i)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors">
                      <div className="text-sm font-medium">{i.nome} {i.cognome}</div>
                      <div className="text-xs text-gray-400">{i.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="label">Descrizione</label>
              <input type="text" className="input" placeholder="es. Tesserino 10 lezioni - Base"
                value={formNuova.descrizione} onChange={e => setFormNuova(f => ({ ...f, descrizione: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Imponibile (€)</label>
                <input type="number" className="input" placeholder="0.00" step="0.01" min="0"
                  value={formNuova.importo_imponibile} onChange={e => setFormNuova(f => ({ ...f, importo_imponibile: e.target.value }))} />
              </div>
              <div>
                <label className="label">IVA (%)</label>
                <input type="number" className="input" placeholder="22" step="0.01" min="0"
                  value={formNuova.aliquota_iva} onChange={e => setFormNuova(f => ({ ...f, aliquota_iva: e.target.value }))} />
              </div>
            </div>
            {formNuova.importo_imponibile && (
              <div className="bg-gray-50 rounded px-3 py-2 text-xs space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>IVA {formNuova.aliquota_iva}%</span>
                  <span>€ {iva}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-700">
                  <span>Totale</span>
                  <span>€ {totale}</span>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={salvaNuovaFattura} disabled={loading === 'nuova'} className="btn-primary flex-1">
                {loading === 'nuova' ? 'Salvataggio...' : 'Crea bozza'}
              </button>
              <button onClick={() => setShowNuovaFattura(false)} className="btn-secondary">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* Form dati studio */}
      {showStudio && (
        <div className="card">
          <h3 className="font-medium text-sm mb-4">⚙ Dati studio</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Nome studio</label>
              <input type="text" className="input" value={formStudio.nome}
                onChange={e => setFormStudio(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <label className="label">Indirizzo</label>
              <input type="text" className="input" value={formStudio.indirizzo}
                onChange={e => setFormStudio(f => ({ ...f, indirizzo: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">CAP</label>
                <input type="text" className="input" value={formStudio.cap}
                  onChange={e => setFormStudio(f => ({ ...f, cap: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Città</label>
                <input type="text" className="input" value={formStudio.citta}
                  onChange={e => setFormStudio(f => ({ ...f, citta: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Provincia</label>
                <input type="text" className="input" maxLength={2} value={formStudio.provincia}
                  onChange={e => setFormStudio(f => ({ ...f, provincia: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="label">IVA default (%)</label>
                <input type="number" className="input" value={formStudio.iva_default}
                  onChange={e => setFormStudio(f => ({ ...f, iva_default: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="label">Partita IVA</label>
              <input type="text" className="input" value={formStudio.partita_iva}
                onChange={e => setFormStudio(f => ({ ...f, partita_iva: e.target.value }))} />
            </div>
            <div>
              <label className="label">Codice Fiscale</label>
              <input type="text" className="input" value={formStudio.codice_fiscale}
                onChange={e => setFormStudio(f => ({ ...f, codice_fiscale: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={formStudio.email}
                onChange={e => setFormStudio(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Telefono</label>
              <input type="text" className="input" value={formStudio.telefono}
                onChange={e => setFormStudio(f => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={salvaStudio} disabled={loading === 'studio'} className="btn-primary flex-1">
                {loading === 'studio' ? 'Salvataggio...' : 'Salva'}
              </button>
              <button onClick={() => setShowStudio(false)} className="btn-secondary">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* Filtri stato */}
      <div className="flex gap-2 flex-wrap">
        {['tutti', 'bozza', 'emessa', 'annullata'].map(s => (
          <button key={s} onClick={() => setFiltroStato(s)}
            className={cn('px-3 py-1.5 rounded text-xs font-medium border transition-colors capitalize',
              filtroStato === s ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            )}>
            {s === 'tutti' ? 'Tutte' : STATO_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Lista fatture come card (mobile-friendly) */}
      {fattureFiltrate.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">Nessuna fattura</p>
      ) : (
        <div className="space-y-2">
          {fattureFiltrate.map(f => (
            <div key={f.id} className="card p-4">
              {/* Riga 1: numero + stato */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">
                  {f.numero || <span className="text-gray-400 italic font-normal text-xs">bozza</span>}
                </span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATO_COLORE[f.stato])}>
                  {STATO_LABEL[f.stato]}
                </span>
              </div>
              {/* Riga 2: iscritto */}
              <div className="mb-1">
                <span className="text-sm font-medium">{f.iscritto.nome} {f.iscritto.cognome}</span>
                <span className="text-xs text-gray-400 ml-2">{f.iscritto.email}</span>
              </div>
              {/* Riga 3: descrizione + totale */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 flex-1 mr-2 truncate">{f.descrizione}</span>
                <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                  € {Number(f.importo_totale).toFixed(2)}
                </span>
              </div>
              {/* Azioni */}
              {(f.stato === 'bozza' || f.stato === 'emessa') && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                  {f.stato === 'bozza' && (
                    <button
                      onClick={() => emettiFattura(f)}
                      disabled={loading === f.id}
                      className="flex-1 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors font-medium">
                      {loading === f.id ? '...' : '✓ Emetti'}
                    </button>
                  )}
                  {f.stato === 'emessa' && (
                    <button
                      onClick={() => scaricaPdf(f)}
                      disabled={loadingPdf === f.id}
                      className="flex-1 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-colors font-medium">
                      {loadingPdf === f.id ? '...' : '↓ Scarica PDF'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
