'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Avviso, FormAvviso } from '@/types'
import { formatData, cn } from '@/lib/utils'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface Props { avvisiIniziali: Avviso[]; adminId: string }

export default function AdminAvvisoClient({ avvisiIniziali, adminId }: Props) {
  const [avvisi, setAvvisi] = useState<Avviso[]>(avvisiIniziali)
  const [loading, setLoading] = useState(false)
  const oggiStr = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState<FormAvviso>({
    testo: '',
    data_inizio: oggiStr,
    data_fine: oggiStr,
  })
  const supabase = createClient()

  function statoAvviso(a: Avviso): 'attivo' | 'programmato' | 'scaduto' {
    if (a.data_fine < oggiStr) return 'scaduto'
    if (a.data_inizio > oggiStr) return 'programmato'
    return 'attivo'
  }

  async function pubblicaAvviso() {
    if (!form.testo.trim()) { toast.error('Scrivi il testo dell\'avviso'); return }
    if (!form.data_inizio || !form.data_fine) { toast.error('Seleziona data inizio e fine'); return }
    if (form.data_fine < form.data_inizio) { toast.error('La data di fine deve essere successiva o uguale alla data di inizio'); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.from('avviso').insert({
        testo: form.testo.trim(),
        data_inizio: form.data_inizio,
        data_fine: form.data_fine,
        creato_da: adminId,
      }).select().single()
      if (error) throw error
      setAvvisi(prev => [data, ...prev])
      setForm({ testo: '', data_inizio: oggiStr, data_fine: oggiStr })
      toast.success('Avviso pubblicato')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function eliminaAvviso(id: string) {
    if (!confirm('Eliminare questo avviso?')) return
    const { error } = await supabase.from('avviso').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setAvvisi(prev => prev.filter(a => a.id !== id))
    toast.success('Avviso eliminato')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="card">
          <h2 className="font-medium text-sm mb-4">Storico avvisi</h2>
          {avvisi.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">Nessun avviso creato</p>
          ) : (
            <div className="space-y-2">
              {avvisi.map(a => {
                const stato = statoAvviso(a)
                return (
                  <div key={a.id} className="p-3 rounded-lg border border-gray-100">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0',
                        stato === 'attivo' ? 'bg-green-100 text-green-800' :
                        stato === 'programmato' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
                      )}>
                        {stato === 'attivo' ? '🟢 Attivo ora' : stato === 'programmato' ? '🕓 Programmato' : '⚪ Scaduto'}
                      </span>
                      <button onClick={() => eliminaAvviso(a.id)}
                        className="text-gray-400 hover:text-red-600 text-sm flex-shrink-0" title="Elimina">
                        ✕
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 mb-1.5">{a.testo}</p>
                    <p className="text-xs text-gray-400">
                      Visibile dal {formatData(a.data_inizio)} al {formatData(a.data_fine)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card">
          <h3 className="font-medium text-sm mb-4">📢 Nuovo avviso</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Testo dell'avviso</label>
              <textarea className="input" rows={4} value={form.testo}
                placeholder="Es. La palestra sarà chiusa dal 10 al 15 agosto per ferie."
                onChange={e => setForm(f => ({ ...f, testo: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Visibile dal</label>
                <input type="date" className="input" value={form.data_inizio}
                  onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))} />
              </div>
              <div>
                <label className="label">Visibile fino al</label>
                <input type="date" className="input" min={form.data_inizio} value={form.data_fine}
                  onChange={e => setForm(f => ({ ...f, data_fine: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Gli iscritti vedranno questo avviso solo tra le due date indicate. Dopo, scomparirà automaticamente.
            </p>
            <button onClick={pubblicaAvviso} disabled={loading} className="btn-primary w-full">
              {loading ? 'Pubblicazione...' : 'Pubblica avviso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
