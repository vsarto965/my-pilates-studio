import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: fattura, error } = await supabase
    .from('fattura')
    .select(`*, iscritto:iscritto(*), tesserino:tesserino(*)`)
    .eq('id', params.id)
    .single()

  if (error || !fattura) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

  const { data: config } = await supabase.from('configurazione').select('*').limit(1).single()

  // Genera HTML della fattura (il PDF viene generato client-side con jsPDF)
  const html = `
    <html><head><meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 40px; color: #1a1a1a; }
      .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
      .logo { font-size: 20px; font-weight: bold; color: #534AB7; }
      .fattura-title { font-size: 18px; font-weight: bold; color: #1a1a1a; }
      .sezione { margin-bottom: 20px; }
      .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th { background: #f5f5f5; padding: 8px 10px; text-align: left; font-size: 11px; }
      td { padding: 8px 10px; border-bottom: 1px solid #eee; }
      .totale { font-size: 14px; font-weight: bold; }
      .footer { margin-top: 40px; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 12px; }
    </style></head>
    <body>
    <div class="header">
      <div>
        <div class="logo">${config?.nome_palestra || 'My Pilates Studio'}</div>
        <div>${config?.indirizzo || ''}</div>
        <div>P.IVA: ${config?.piva_palestra || '—'} · CF: ${config?.cf_palestra || '—'}</div>
        <div>${config?.email_palestra || ''}</div>
      </div>
      <div style="text-align:right">
        <div class="fattura-title">FATTURA</div>
        <div>N. ${fattura.numero_fattura}</div>
        <div>Data: ${new Date(fattura.data_emissione).toLocaleDateString('it-IT')}</div>
      </div>
    </div>

    <div class="sezione">
      <div class="label">Cliente</div>
      <div><strong>${(fattura.iscritto as any)?.nome} ${(fattura.iscritto as any)?.cognome}</strong></div>
      <div>C.F.: ${(fattura.iscritto as any)?.codice_fiscale}</div>
      <div>${(fattura.iscritto as any)?.email}</div>
    </div>

    <table>
      <thead><tr><th>Descrizione</th><th style="text-align:right">Imponibile</th><th style="text-align:right">IVA</th><th style="text-align:right">Totale</th></tr></thead>
      <tbody>
        <tr>
          <td>Tesserino ${(fattura.tesserino as any)?.livello} — ${(fattura.tesserino as any)?.lezioni_totali} lezioni<br>
          <small>Valido dal ${new Date((fattura.tesserino as any)?.data_inizio).toLocaleDateString('it-IT')} al ${new Date((fattura.tesserino as any)?.data_scadenza).toLocaleDateString('it-IT')}</small></td>
          <td style="text-align:right">€ ${Number(fattura.imponibile).toFixed(2)}</td>
          <td style="text-align:right">${fattura.aliquota_iva > 0 ? fattura.aliquota_iva + '%' : 'Esente'}</td>
          <td style="text-align:right">€ ${Number(fattura.totale).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div style="text-align:right; margin-top:8px">
      <span class="totale">Totale: € ${Number(fattura.totale).toFixed(2)}</span>
      ${fattura.aliquota_iva === 0 ? '<br><small>Operazione esente/non imponibile IVA</small>' : ''}
    </div>

    <div class="footer">
      ${config?.regime_fiscale === 'RF19' ? 'Operazione effettuata ai sensi dell\'art. 1, commi 54-89, L. 190/2014 — Regime Forfettario. Imposta di bollo assolta in modo virtuale.' : ''}
    </div>
    </body></html>
  `

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Fattura-Numero': fattura.numero_fattura,
    },
  })
}
