import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()

    const { data: fattura, error: errFattura } = await supabase
      .from('fattura')
      .select(`
        *,
        iscritto:iscritto(nome, cognome, email, telefono, codice_fiscale, indirizzo, cap, citta, provincia)
      `)
      .eq('id', params.id)
      .single()

    if (errFattura || !fattura) {
      return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })
    }

    const { data: studio, error: errStudio } = await supabase
      .from('studio')
      .select('*')
      .limit(1)
      .single()

    if (errStudio || !studio) {
      return NextResponse.json({ error: 'Dati studio non configurati' }, { status: 500 })
    }

    const iscritto = fattura.iscritto as any

    const dataEmissione = fattura.emessa_at
      ? new Date(fattura.emessa_at).toLocaleDateString('it-IT')
      : new Date().toLocaleDateString('it-IT')

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #333; }
    .studio-name { font-size: 22px; font-weight: bold; color: #1a1a1a; margin-bottom: 6px; }
    .studio-info { font-size: 11px; color: #555; line-height: 1.6; }
    .fattura-info { text-align: right; }
    .fattura-title { font-size: 20px; font-weight: bold; color: #1a1a1a; margin-bottom: 8px; }
    .fattura-numero { font-size: 13px; color: #555; margin-bottom: 4px; }
    .fattura-data { font-size: 12px; color: #555; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin-bottom: 10px; }
    .client-box { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px; }
    .client-name { font-size: 14px; font-weight: bold; margin-bottom: 6px; }
    .client-info { font-size: 11px; color: #555; line-height: 1.7; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #1a1a1a; color: white; }
    thead th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: bold; }
    thead th:last-child { text-align: right; }
    tbody tr { border-bottom: 1px solid #eee; }
    tbody td { padding: 12px; font-size: 12px; }
    tbody td:last-child { text-align: right; }
    .totali { margin-left: auto; width: 280px; }
    .totale-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px solid #eee; }
    .totale-row.finale { font-size: 15px; font-weight: bold; padding: 10px 0; border-bottom: 2px solid #333; border-top: 2px solid #333; margin-top: 4px; }
    .footer { margin-top: 60px; padding-top: 16px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 10px; color: #aaa; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="studio-name">${studio.nome}</div>
      <div class="studio-info">
        ${studio.indirizzo ? studio.indirizzo + '<br>' : ''}
        ${studio.cap && studio.citta ? studio.cap + ' ' + studio.citta + (studio.provincia ? ' (' + studio.provincia + ')' : '') + '<br>' : ''}
        ${studio.partita_iva ? 'P.IVA: ' + studio.partita_iva + '<br>' : ''}
        ${studio.codice_fiscale ? 'C.F.: ' + studio.codice_fiscale + '<br>' : ''}
        ${studio.email ? studio.email + '<br>' : ''}
        ${studio.telefono ? studio.telefono : ''}
      </div>
    </div>
    <div class="fattura-info">
      <div class="fattura-title">FATTURA</div>
      ${fattura.numero ? `<div class="fattura-numero">N. ${fattura.numero}</div>` : '<div class="fattura-numero">BOZZA</div>'}
      <div class="fattura-data">Data: ${dataEmissione}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dati cliente</div>
    <div class="client-box">
      <div class="client-name">${iscritto.nome} ${iscritto.cognome}</div>
      <div class="client-info">
        ${iscritto.codice_fiscale ? 'C.F.: ' + iscritto.codice_fiscale + '<br>' : ''}
        ${iscritto.indirizzo ? iscritto.indirizzo + '<br>' : ''}
        ${iscritto.cap && iscritto.citta ? iscritto.cap + ' ' + iscritto.citta + (iscritto.provincia ? ' (' + iscritto.provincia + ')' : '') + '<br>' : ''}
        ${iscritto.email ? iscritto.email + '<br>' : ''}
        ${iscritto.telefono ? iscritto.telefono : ''}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dettaglio</div>
    <table>
      <thead>
        <tr>
          <th>Descrizione</th>
          <th style="text-align:right">Imponibile</th>
          <th style="text-align:right">IVA ${fattura.aliquota_iva}%</th>
          <th style="text-align:right">Totale</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${fattura.descrizione}</td>
          <td style="text-align:right">€ ${Number(fattura.importo_imponibile).toFixed(2)}</td>
          <td style="text-align:right">€ ${Number(fattura.importo_iva).toFixed(2)}</td>
          <td style="text-align:right">€ ${Number(fattura.importo_totale).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
    <div class="totali">
      <div class="totale-row">
        <span>Imponibile</span>
        <span>€ ${Number(fattura.importo_imponibile).toFixed(2)}</span>
      </div>
      <div class="totale-row">
        <span>IVA ${fattura.aliquota_iva}%</span>
        <span>€ ${Number(fattura.importo_iva).toFixed(2)}</span>
      </div>
      <div class="totale-row finale">
        <span>TOTALE</span>
        <span>€ ${Number(fattura.importo_totale).toFixed(2)}</span>
      </div>
    </div>
  </div>

  <div class="footer">
    ${studio.nome} — ${studio.partita_iva ? 'P.IVA ' + studio.partita_iva : ''} — Documento generato il ${new Date().toLocaleDateString('it-IT')}
  </div>
</body>
</html>`

    const puppeteer = require('puppeteer')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
    await browser.close()

    const nomeFile = fattura.numero
      ? `fattura-${fattura.numero.replace('/', '-')}.pdf`
      : `fattura-bozza-${params.id.slice(0, 8)}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeFile}"`,
      },
    })

  } catch (error: any) {
    console.error('Errore generazione PDF:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
