'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Iscritto, Tesserino, Listino, Livello, TipoConsenso, FormRegistrazione } from '@/types'
import { formatDataBreve, formatEuro, iniziali, validaCF, LIVELLO_LABEL, LIVELLO_COLORE, STATO_TESSERINO_LABEL, STATO_TESSERINO_COLORE, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface IscrittoConTesserini extends Iscritto { tesserini: Tesserino[] }
interface Props { iscrittiIniziali: IscrittoConTesserini[]; listino: Listino[] }

const CONSENSI: { id: TipoConsenso; label: string; desc: string; obbligatorio: boolean }[] = [
  { id: 'contratto', label: 'Finalità contrattuali', desc: 'Gestione iscrizione, tesserino, prenotazioni e presenze (art. 6.1.b GDPR)', obbligatorio: true },
  { id: 'obblighi_legge', label: 'Obblighi di legge e fiscali', desc: 'Adempimenti fiscali e contabili, conservazione 10 anni (art. 6.1.c GDPR)', obbligatorio: true },
  { id: 'marketing', label: 'Comunicazioni promozionali', desc: 'Newsletter, offerte e nuovi corsi via email/SMS — revocabile in qualsiasi momento', obbligatorio: false },
  { id: 'terzi', label: 'Comunicazione a terzi', desc: 'Trasmissione a partner selezionati (assicurazioni sportive, ecc.) — revocabile', obbligatorio: false },
]

const LIVELLI: Livello[] = ['base', 'intermedio', 'avanzato']
const STEP_LABELS = ['Dati anagrafici', 'Privacy e consensi', 'Tesserino', 'Riepilogo']

interface FormModifica {
  nome: string
  cognome: string
  codice_fiscale: string
  email: string
  data_nascita: string
  telefono: string
}

export default function TesseriniClient({ iscrittiIniziali, listino }: Props) {
  const [iscritti, setIscritti] = useState(iscrittiIniziali)
  const [cerca, setCerca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showModifica, setShowModifica] = useState(false)
  const [showConfermaElimina, setShowConfermaElimina] = useState(false)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [iscrittoDettaglio, setIscrittoDettaglio] = useState<IscrittoConTesserini | null>(null)
  const supabase = createClient()

  const [formModifica, setFormModifica] = useState<FormModifica>({
    nome: '', cognome: '', codice_fiscale: '', email: '', data_nascita: '', telefono: '',
  })

  const [form, setForm] = useState<FormRegistrazione>({
    nome: '', cognome: '', codice_fiscale: '', email: '', data_nascita: '',
    telefono: '', password: '', livello: 'base', lezioni: 10, listino_id: '',
    data_inizio: new Date().toISOString().split('T')[0],
    data_scadenza: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    importo_pagato: 0, sconto: 0, nota_sconto: '',
    consensi: { contratto: false, obblighi_legge: false, marketing: false, terzi: false },
  })

  const iscrittiFiltrati = iscritti.filter(i =>
    `${i.nome} ${i.cognome} ${i.email} ${i.codice_fiscale}`.toLowerCase().includes(cerca.toLowerCase())
  )

  function tesserinoPrimario(i: IscrittoConTesserini) {
    return i.tesserini?.find(t => t.stato === 'attivo') || i.tesserini?.[0]
  }

  function apriModifica(i: IscrittoConTesserini) {
    setFormModifica({
      nome: i.nome,
      cognome: i.cognome,
      codice_fiscale: i.codice_fiscale,
      email: i.email,
      data_nascita: i.data_nascita,
      telefono: i.telefono || '',
    })
    setShowModifica(true)
    setShowConfermaElimina(false)
  }

  async function salvaModifica() {
    if (!iscrittoDettaglio) return
    if (!formModifica.nome.trim() || !formModifica.cognome.trim()) { toast.error('Nome e cognome obbligatori'); return }
    if (!formModifica.email.includes('@')) { toast.error('Email non valida'); return }
    if (!validaCF(formModifica.codice_fiscale)) { toast.error('Codice fiscale non valido'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('iscritto')
        .update({
          nome: formModifica.nome.trim(),
          cognome: formModifica.cognome.trim(),
          codice_fiscale: formModifica.codice_fiscale.toUpperCase().trim(),
          email: formModifica.email.trim(),
          data_nascita: formModifica.data_nascita,
          telefono: formModifica.telefono.trim(),
        })
        .eq('id', iscrittoDettaglio.id)
        .select()
        .single()
      if (error) throw error
      const aggiornato = { ...iscrittoDettaglio, ...data }
      setIscritti(prev => prev.map(i => i.id === iscrittoDettaglio.id ? aggiornato : i))
      setIscrittoDettaglio(aggiornato)
      setShowModifica(false)
      toast.success('Iscritto aggiornato')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function eliminaIscritto() {
    if (!iscrittoDettaglio) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('iscritto')
        .update({ stato: 'eliminato' })
        .eq('id', iscrittoDettaglio.id)
      if (error) throw error
      setIscritti(prev => prev.filter(i => i.id !== iscrittoDettaglio.id))
      setIscrittoDettaglio(null)
      setShowConfermaElimina(false)
      setShowModifica(false)
      toast.success('Iscritto eliminato')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  function onListinoChange(id: string) {
    const voce = listino.find(l => l.id === id)
    if (voce) {
      const importo = Math.max(0, voce.prezzo - form.sconto)
      setForm(f => ({ ...f, listino_id: id, livello: voce.livello, lezioni: voce.lezioni, importo_pagato: importo }))
    }
  }

  function onScontoChange(val: number) {
    const base = listino.find(l => l.id === form.listino_id)?.prezzo || form.importo_pagato + form.sconto
    setForm(f => ({ ...f, sconto: val, importo_pagato: Math.max(0, base - val) }))
  }

  function validaStep(s: number): string | null {
    if (s === 0) {
      if (!form.nome.trim()) return 'Nome obbligatorio'
      if (!form.cognome.trim()) return 'Cognome obbligatorio'
      if (!validaCF(form.codice_fiscale)) return 'Codice fiscale non valido'
      if (!form.email.includes('@')) return 'Email non valida'
      if (!form.data_nascita) return 'Data di nascita obbligatoria'
      if (form.password.length < 8) return 'Password minimo 8 caratteri'
    }
    if (s === 1) {
      if (!form.consensi.contratto) return 'Consenso contrattuale obbligatorio'
      if (!form.consensi.obblighi_legge) return 'Consenso obblighi di legge obbligatorio'
    }
    if (s === 2) {
      if (!form.data_inizio || !form.data_scadenza) return 'Date tesserino obbligatorie'
      if (form.importo_pagato < 0) return 'Importo non valido'
    }
    return null
  }

  function avanti() {
    const err = validaStep(step)
    if (err) { toast.error(err); return }
    setStep(s => s + 1)
  }

  async function registra() {
    setLoading(true)
    try {
      let authUserId: string | undefined
      const { data: su } = await supabase.auth.signUp({ email: form.email, password: form.password })
      authUserId = su.user?.id

      const { data: iscritto, error: iErr } = await supabase.from('iscritto').insert({
        nome: form.nome, cognome: form.cognome, codice_fiscale: form.codice_fiscale.toUpperCase(),
        email: form.email, data_nascita: form.data_nascita, telefono: form.telefono,
        password_hash: '—',
        auth_user_id: authUserId, stato: 'attivo',
      }).select().single()
      if (iErr) throw iErr

      const { data: tesserino, error: tErr } = await supabase.from('tesserino').insert({
        iscritto_id: iscritto.id, listino_id: form.listino_id || null,
        livello: form.livello, lezioni_totali: form.lezioni, lezioni_residue: form.lezioni,
        importo_pagato: form.importo_pagato, sconto: form.sconto, nota_sconto: form.nota_sconto,
        data_inizio: form.data_inizio, data_scadenza: form.data_scadenza, stato: 'attivo',
      }).select().single()
      if (tErr) throw tErr

      const ipRes = await fetch('https://api.ipify.org?format=json').catch(() => null)
      const ip = ipRes ? (await ipRes.json()).ip : null
      const consensiInsert = CONSENSI.map(c => ({
        iscritto_id: iscritto.id, tipo_consenso: c.id,
        valore: form.consensi[c.id], ip_address: ip,
        versione_informativa: '1.0', canale: 'admin' as const,
      }))
      await supabase.from('consensi_log').insert(consensiInsert)

      const anno = new Date().getFullYear()
      const { count } = await supabase.from('fattura').select('*', { count: 'exact', head: true })
      const progressivo = (count || 0) + 1
      await supabase.from('fattura').insert({
        iscritto_id: iscritto.id, tesserino_id: tesserino.id,
        numero_fattura: `${anno}/${String(progressivo).padStart(4, '0')}`,
        data_emissione: new Date().toISOString().split('T')[0],
        imponibile: form.importo_pagato, aliquota_iva: 0,
        importo_iva: 0, totale: form.importo_pagato, stato: 'bozza',
      })

      const nuovo: IscrittoConTesserini = { ...iscritto, tesserini: [tesserino] }
      setIscritti(prev => [nuovo, ...prev])
      setShowForm(false)
      setStep(0)
      toast.success(`${form.nome} ${form.cognome} registrata con successo`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function rinnova(i: IscrittoConTesserini) {
    const t = tesserinoPrimario(i)
    if (!t) return
    const scad = new Date(t.data_scadenza)
    scad.setMonth(scad.getMonth() + 3)
    const { error } = await supabase.from('tesserino').update({
      lezioni_residue: t.lezioni_totali, stato: 'attivo',
      data_scadenza: scad.toISOString().split('T')[0],
    }).eq('id', t.id)
    if (error) { toast.error(error.message); return }
    setIscritti(prev => prev.map(ii => ii.id === i.id
      ? { ...ii, tesserini: ii.tesserini.map(tt => tt.id === t.id ? { ...tt, lezioni_residue: tt.lezioni_totali, stato: 'attivo' as const, data_scadenza: scad.toISOString().split('T')[0] } : tt) }
      : ii))
    if (iscrittoDettaglio?.id === i.id) {
      setIscrittoDettaglio(prev => prev ? { ...prev, tesserini: prev.tesserini.map(tt => tt.id === t.id ? { ...tt, lezioni_residue: tt.lezioni_totali, stato: 'attivo' as const, data_scadenza: scad.toISOString().split('T')[0] } : tt) } : prev)
    }
    toast.success('Tesserino rinnovato')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">

        {/* Header ricerca + nuovo */}
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Cerca per nome, email, codice fiscale..." className="input flex-1"
            value={cerca} onChange={e => setCerca(e.target.value)} />
          <button onClick={() => { setShowForm(true); setStep(0); setIscrittoDettaglio(null); setShowModifica(false) }} className="btn-primary whitespace-nowrap">
            + Nuovo iscritto
          </button>
        </div>

        {/* Statistiche */}
        <div className="grid grid-cols-4 gap-3">
          {[
            ['Totale', iscritti.length, ''],
            ['Attivi', iscritti.filter(i => i.stato === 'attivo').length, 'text-green-700'],
            ['Scaduti', iscritti.filter(i => tesserinoPrimario(i)?.stato === 'scaduto').length, 'text-red-600'],
            ['Ultime lezioni', iscritti.filter(i => { const t = tesserinoPrimario(i); return t && t.lezioni_residue <= 2 && t.stato === 'attivo' }).length, 'text-amber-600'],
          ].map(([l, v, c]) => (
            <div key={l as string} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className={`text-xl font-medium ${c}`}>{v}</div>
              <div className="text-xs text-gray-500 mt-0.5">{l}</div>
            </div>
          ))}
        </div>

        {/* Lista iscritti */}
        <div className="card divide-y divide-gray-50 p-0 overflow-hidden">
          {iscrittiFiltrati.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">Nessun iscritto trovato</p>
          )}
          {iscrittiFiltrati.map(i => {
            const t = tesserinoPrimario(i)
            const warn = t && t.lezioni_residue <= 2 && t.stato === 'attivo'
            const isSelected = iscrittoDettaglio?.id === i.id
            return (
              <div key={i.id}
                onClick={() => { setIscrittoDettaglio(i); setShowForm(false); setShowModifica(false); setShowConfermaElimina(false) }}
                className={cn('flex items-center gap-3 py-3 px-4 cursor-pointer transition-colors',
                  isSelected ? 'bg-brand-50' : 'hover:bg-gray-50')}>
                <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-800 text-xs font-medium flex-shrink-0">
                  {iniziali(i.nome, i.cognome)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{i.nome} {i.cognome}</span>
                    {warn && <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">⚠ ultime lezioni</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{i.email} · CF {i.codice_fiscale}</div>
                </div>
                {t && (
                  <div className="text-right flex-shrink-0">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATO_TESSERINO_COLORE[t.stato])}>
                      {STATO_TESSERINO_LABEL[t.stato]}
                    </span>
                    <div className="text-xs text-gray-400 mt-0.5">{t.lezioni_residue}/{t.lezioni_totali} lez.</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Colonna destra */}
      <div className="space-y-4">

        {/* Form nuovo iscritto a step */}
        {showForm && (
          <div className="card">
            <div className="flex items-center gap-1 mb-4 pb-3 border-b border-gray-100">
              {STEP_LABELS.map((l, idx) => (
                <div key={idx} className={cn('flex-1 text-center', idx > 0 && 'border-l border-gray-100')}>
                  <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium mx-auto mb-0.5',
                    idx < step ? 'bg-green-100 text-green-800' : idx === step ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-400')}>
                    {idx < step ? '✓' : idx + 1}
                  </div>
                  <div className="text-xs text-gray-400 leading-tight">{l}</div>
                </div>
              ))}
            </div>

            {step === 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Nome</label><input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
                  <div><label className="label">Cognome</label><input className="input" value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} /></div>
                </div>
                <div><label className="label">Codice fiscale</label><input className="input uppercase" value={form.codice_fiscale} onChange={e => setForm(f => ({ ...f, codice_fiscale: e.target.value.toUpperCase() }))} /></div>
                <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Data di nascita</label><input type="date" className="input" value={form.data_nascita} onChange={e => setForm(f => ({ ...f, data_nascita: e.target.value }))} /></div>
                <div><label className="label">Telefono</label><input type="tel" className="input" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></div>
                <div><label className="label">Password iniziale</label><input type="password" className="input" placeholder="Minimo 8 caratteri" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 mb-2">Ai sensi del Reg. UE 2016/679 (GDPR)</p>
                {CONSENSI.map(c => (
                  <div key={c.id} className={cn('p-3 rounded-lg border', c.obbligatorio ? 'border-l-4 border-l-[#534AB7] border-r-gray-100 border-t-gray-100 border-b-gray-100' : 'border-gray-100')}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" className="mt-0.5" checked={form.consensi[c.id]}
                        onChange={e => setForm(f => ({ ...f, consensi: { ...f.consensi, [c.id]: e.target.checked } }))} />
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
                          {c.label}
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', c.obbligatorio ? 'bg-[#EEEDFE] text-[#534AB7]' : 'bg-gray-100 text-gray-500')}>
                            {c.obbligatorio ? 'Obbligatorio' : 'Facoltativo'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{c.desc}</div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div><label className="label">Pacchetto dal listino</label>
                  <select className="input" value={form.listino_id} onChange={e => onListinoChange(e.target.value)}>
                    <option value="">— scegli dal listino —</option>
                    {listino.map(l => <option key={l.id} value={l.id}>{LIVELLO_LABEL[l.livello]} · {l.lezioni} lez. · {formatEuro(l.prezzo)}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Livello</label>
                    <select className="input" value={form.livello} onChange={e => setForm(f => ({ ...f, livello: e.target.value as Livello }))}>
                      {LIVELLI.map(l => <option key={l} value={l}>{LIVELLO_LABEL[l]}</option>)}
                    </select></div>
                  <div><label className="label">N. lezioni</label>
                    <input type="number" className="input" min={1} value={form.lezioni} onChange={e => setForm(f => ({ ...f, lezioni: Number(e.target.value) }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Inizio</label><input type="date" className="input" value={form.data_inizio} onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))} /></div>
                  <div><label className="label">Scadenza</label><input type="date" className="input" value={form.data_scadenza} onChange={e => setForm(f => ({ ...f, data_scadenza: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Importo (€)</label>
                    <input type="number" className="input" step="0.01" value={form.importo_pagato} onChange={e => setForm(f => ({ ...f, importo_pagato: Number(e.target.value) }))} /></div>
                  <div><label className="label">Sconto (€)</label>
                    <input type="number" className="input" step="0.01" min={0} value={form.sconto} onChange={e => onScontoChange(Number(e.target.value))} /></div>
                </div>
                {form.sconto > 0 && (
                  <div><label className="label">Motivo sconto</label>
                    <input className="input" placeholder="Es. rinnovo anticipato..." value={form.nota_sconto} onChange={e => setForm(f => ({ ...f, nota_sconto: e.target.value }))} /></div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-2 text-sm">
                {[['Nome', `${form.nome} ${form.cognome}`], ['CF', form.codice_fiscale], ['Email', form.email], ['Nascita', formatDataBreve(form.data_nascita)]].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500">{k}</span><span className="font-medium">{v}</span>
                  </div>
                ))}
                {[['Livello', LIVELLO_LABEL[form.livello]], ['Lezioni', String(form.lezioni)], ['Importo', formatEuro(form.importo_pagato)]].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500">{k}</span><span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
              {step > 0 && <button onClick={() => setStep(s => s - 1)} className="btn-secondary">‹</button>}
              {step < 3 && <button onClick={avanti} className="btn-primary flex-1">Avanti ›</button>}
              {step === 3 && <button onClick={registra} disabled={loading} className="btn-primary flex-1">{loading ? 'Salvataggio...' : 'Conferma'}</button>}
              <button onClick={() => { setShowForm(false); setStep(0) }} className="btn-secondary">✕</button>
            </div>
          </div>
        )}

        {/* Dettaglio iscritto */}
        {iscrittoDettaglio && !showForm && (
          <div className="card space-y-3">

            {/* Header con azioni */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-800 font-medium flex-shrink-0">
                {iniziali(iscrittoDettaglio.nome, iscrittoDettaglio.cognome)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{iscrittoDettaglio.nome} {iscrittoDettaglio.cognome}</div>
                <div className="text-xs text-gray-500 truncate">{iscrittoDettaglio.email}</div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => apriModifica(iscrittoDettaglio)}
                  title="Modifica"
                  className="p-2 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors text-sm">
                  ✎
                </button>
                <button
                  onClick={() => { setShowConfermaElimina(true); setShowModifica(false) }}
                  title="Elimina"
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors text-sm">
                  🗑
                </button>
              </div>
            </div>

            {/* Form modifica */}
            {showModifica && (
              <div className="space-y-3 pb-3 border-b border-gray-100">
                <div className="text-xs font-medium text-gray-500 uppercase">Modifica dati</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Nome</label><input className="input" value={formModifica.nome} onChange={e => setFormModifica(f => ({ ...f, nome: e.target.value }))} /></div>
                  <div><label className="label">Cognome</label><input className="input" value={formModifica.cognome} onChange={e => setFormModifica(f => ({ ...f, cognome: e.target.value }))} /></div>
                </div>
                <div><label className="label">Codice fiscale</label><input className="input uppercase" value={formModifica.codice_fiscale} onChange={e => setFormModifica(f => ({ ...f, codice_fiscale: e.target.value.toUpperCase() }))} /></div>
                <div><label className="label">Email</label><input type="email" className="input" value={formModifica.email} onChange={e => setFormModifica(f => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Data di nascita</label><input type="date" className="input" value={formModifica.data_nascita} onChange={e => setFormModifica(f => ({ ...f, data_nascita: e.target.value }))} /></div>
                <div><label className="label">Telefono</label><input type="tel" className="input" value={formModifica.telefono} onChange={e => setFormModifica(f => ({ ...f, telefono: e.target.value }))} /></div>
                <div className="flex gap-2">
                  <button onClick={salvaModifica} disabled={loading} className="btn-primary flex-1">{loading ? 'Salvataggio...' : 'Salva modifiche'}</button>
                  <button onClick={() => setShowModifica(false)} className="btn-secondary">Annulla</button>
                </div>
              </div>
            )}

            {/* Conferma eliminazione */}
            {showConfermaElimina && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 space-y-2">
                <div className="text-sm font-medium text-red-800">Eliminare {iscrittoDettaglio.nome} {iscrittoDettaglio.cognome}?</div>
                <div className="text-xs text-red-600">L'iscritto non potrà più accedere all'app. I dati storici vengono conservati.</div>
                <div className="flex gap-2">
                  <button onClick={eliminaIscritto} disabled={loading} className="btn-danger flex-1 text-xs">{loading ? '...' : 'Sì, elimina'}</button>
                  <button onClick={() => setShowConfermaElimina(false)} className="btn-secondary text-xs">Annulla</button>
                </div>
              </div>
            )}

            {/* Dati anagrafici */}
            {!showModifica && !showConfermaElimina && (
              <>
                {[['CF', iscrittoDettaglio.codice_fiscale], ['Telefono', iscrittoDettaglio.telefono || '—'], ['Iscritto il', formatDataBreve(iscrittoDettaglio.created_at)]].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-gray-500">{k}</span><span className="font-medium">{v}</span>
                  </div>
                ))}
              </>
            )}

            {/* Tesserini */}
            <div className="pt-2 border-t border-gray-100">
              <div className="text-xs font-medium text-gray-500 uppercase mb-2">Tesserini</div>
              {iscrittoDettaglio.tesserini?.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                  <div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium mr-2', LIVELLO_COLORE[t.livello])}>{LIVELLO_LABEL[t.livello]}</span>
                    {t.lezioni_residue}/{t.lezioni_totali} lez.
                  </div>
                  <div className="text-right">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATO_TESSERINO_COLORE[t.stato])}>{STATO_TESSERINO_LABEL[t.stato]}</span>
                    <div className="text-xs text-gray-400 mt-0.5">{formatEuro(t.importo_pagato)}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => rinnova(iscrittoDettaglio)} className="btn-secondary w-full text-sm">↺ Rinnova tesserino</button>
          </div>
        )}
      </div>
    </div>
  )
}
