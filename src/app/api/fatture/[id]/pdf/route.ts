import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

    const { data: fattura, error: errFattura } = await supabase
      .from('fattura')
      .select(`
        *,
        iscritto:iscritto(nome, cognome, email, telefono, codice_fiscale)
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

    // Genera PDF con jsPDF
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const marginL = 20
    const marginR = 190
    const pageW = 210
    let y = 20

    // Colori
    const nero = [26, 26, 26] as [number, number, number]
    const grigio = [85, 85, 85] as [number, number, number]
    const grigioCh = [136, 136, 136] as [number, number, number]

    // ---- HEADER: Studio ----
    doc.setFontSize(18)
    doc.setTextColor(...nero)
    doc.setFont('helvetica', 'bold')
    doc.text(studio.nome || 'Studio', marginL, y)

    // ---- HEADER: Numero fattura (destra) ----
    doc.setFontSize(16)
    doc.text('FATTURA', marginR, y, { align: 'right' })

    y += 7
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...grigio)

    // Info studio (sinistra)
    const righeStudio: string[] = []
    if (studio.indirizzo) righeStudio.push(studio.indirizzo)
    if (studio.cap && studio.citta) righeStudio.push(`${studio.cap} ${studio.citta}${studio.provincia ? ' (' + studio.provincia + ')' : ''}`)
    if (studio.partita_iva) righeStudio.push(`P.IVA: ${studio.partita_iva}`)
    if (studio.codice_fiscale) righeStudio.push(`C.F.: ${studio.codice_fiscale}`)
    if (studio.email) righeStudio.push(studio.email)
    if (studio.telefono) righeStudio.push(studio.telefono)

    righeStudio.forEach(r => {
      doc.text(r, marginL, y)
      y += 5
    })

    // Info fattura (destra)
    let yDx = 27
    doc.setFontSize(10)
    if (fattura.numero) {
      doc.text(`N. ${fattura.numero}`, marginR, yDx, { align: 'right' })
    } else {
      doc.text('BOZZA', marginR, yDx, { align: 'right' })
    }
    yDx += 5
    doc.text(`Data: ${dataEmissione}`, marginR, yDx, { align: 'right' })

    // Linea separatrice
    y = Math.max(y, yDx) + 5
    doc.setDrawColor(...nero)
    doc.setLineWidth(0.5)
    doc.line(marginL, y, marginR, y)
    y += 10

    // ---- DATI CLIENTE ----
    doc.setFontSize(8)
    doc.setTextColor(...grigioCh)
    doc.setFont('helvetica', 'bold')
    doc.text('DATI CLIENTE', marginL, y)
    y += 6

    // Box cliente
    doc.setFillColor(248, 248, 248)
    doc.setDrawColor(224, 224, 224)
    doc.setLineWidth(0.3)
    doc.roundedRect(marginL, y, marginR - marginL, 30, 2, 2, 'FD')

    y += 7
    doc.setFontSize(11)
    doc.setTextColor(...nero)
    doc.setFont('helvetica', 'bold')
    doc.text(`${iscritto.nome} ${iscritto.cognome}`, marginL + 5, y)

    y += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...grigio)

    const righeCliente: string[] = []
    if (iscritto.codice_fiscale) righeCliente.push(`C.F.: ${iscritto.codice_fiscale}`)
    if (iscritto.indirizzo) righeCliente.push(iscritto.indirizzo)
    if (iscritto.cap && iscritto.citta) righeCliente.push(`${iscritto.cap} ${iscritto.citta}${iscritto.provincia ? ' (' + iscritto.provincia + ')' : ''}`)
    if (iscritto.email) righeCliente.push(iscritto.email)
    if (iscritto.telefono) righeCliente.push(iscritto.telefono)

    righeCliente.forEach(r => {
      doc.text(r, marginL + 5, y)
      y += 5
    })

    y += 15

    // ---- TABELLA DETTAGLIO ----
    doc.setFontSize(8)
    doc.setTextColor(...grigioCh)
    doc.setFont('helvetica', 'bold')
    doc.text('DETTAGLIO', marginL, y)
    y += 5

    // Intestazione tabella
    doc.setFillColor(...nero)
    doc.rect(marginL, y, marginR - marginL, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.text('Descrizione', marginL + 3, y + 5.5)
    doc.text('Imponibile', 130, y + 5.5, { align: 'right' })
    doc.text(`IVA ${fattura.aliquota_iva}%`, 155, y + 5.5, { align: 'right' })
    doc.text('Totale', marginR - 2, y + 5.5, { align: 'right' })
    y += 8

    // Riga dati
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(238, 238, 238)
    doc.setLineWidth(0.3)
    doc.rect(marginL, y, marginR - marginL, 10, 'FD')
    doc.setTextColor(...nero)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(fattura.descrizione, marginL + 3, y + 6.5)
    doc.text(`€ ${Number(fattura.importo_imponibile).toFixed(2)}`, 130, y + 6.5, { align: 'right' })
    doc.text(`€ ${Number(fattura.importo_iva).toFixed(2)}`, 155, y + 6.5, { align: 'right' })
    doc.text(`€ ${Number(fattura.importo_totale).toFixed(2)}`, marginR - 2, y + 6.5, { align: 'right' })
    y += 18

    // ---- TOTALI ----
    const totaliX = 120
    const totaliW = marginR - totaliX

    doc.setDrawColor(238, 238, 238)
    doc.setLineWidth(0.3)

    // Imponibile
    doc.setTextColor(...grigio)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Imponibile', totaliX, y)
    doc.text(`€ ${Number(fattura.importo_imponibile).toFixed(2)}`, marginR - 2, y, { align: 'right' })
    y += 5
    doc.line(totaliX, y, marginR, y)
    y += 4

    // IVA
    doc.text(`IVA ${fattura.aliquota_iva}%`, totaliX, y)
    doc.text(`€ ${Number(fattura.importo_iva).toFixed(2)}`, marginR - 2, y, { align: 'right' })
    y += 5
    doc.line(totaliX, y, marginR, y)
    y += 2

    // Totale finale
    doc.setDrawColor(...nero)
    doc.setLineWidth(0.5)
    doc.line(totaliX, y, marginR, y)
    y += 6
    doc.setTextColor(...nero)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('TOTALE', totaliX, y)
    doc.text(`€ ${Number(fattura.importo_totale).toFixed(2)}`, marginR - 2, y, { align: 'right' })
    y += 2
    doc.line(totaliX, y, marginR, y)

    // ---- FOOTER ----
    doc.setFontSize(8)
    doc.setTextColor(...grigioCh)
    doc.setFont('helvetica', 'normal')
    const footerY = 280
    doc.setDrawColor(224, 224, 224)
    doc.setLineWidth(0.3)
    doc.line(marginL, footerY - 4, marginR, footerY - 4)
    const footerText = `${studio.nome}${studio.partita_iva ? ' — P.IVA ' + studio.partita_iva : ''} — Documento generato il ${new Date().toLocaleDateString('it-IT')}`
    doc.text(footerText, pageW / 2, footerY, { align: 'center' })

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

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
