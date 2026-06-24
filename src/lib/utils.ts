import { format, parseISO, differenceInHours, isBefore } from 'date-fns'
import { it } from 'date-fns/locale'
import { Livello, StatoTesserino } from '@/types'

// Formattazione date
export function formatData(data: string): string {
  return format(parseISO(data), 'd MMMM yyyy', { locale: it })
}
export function formatDataBreve(data: string): string {
  return format(parseISO(data), 'dd/MM/yyyy')
}
export function formatOra(ora: string): string {
  return ora.substring(0, 5) // "09:00:00" → "09:00"
}
export function formatMese(data: string): string {
  return format(parseISO(data), 'MMMM yyyy', { locale: it })
}
export function formatGiornoSettimana(data: string): string {
  return format(parseISO(data), 'EEEE', { locale: it })
}
export function formatGiornoCompleto(data: string): string {
  return format(parseISO(data), 'EEEE d MMMM', { locale: it })
}

// Valuta
export function formatEuro(importo: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(importo)
}

// Codice fiscale
export function validaCF(cf: string): boolean {
  const regex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i
  return regex.test(cf.trim())
}

// Livello
export const LIVELLO_LABEL: Record<Livello, string> = {
  base: 'Base',
  intermedio: 'Intermedio',
  avanzato: 'Avanzato',
}
export const LIVELLO_COLORE: Record<Livello, string> = {
  base: 'bg-green-100 text-green-800',
  intermedio: 'bg-amber-100 text-amber-800',
  avanzato: 'bg-red-100 text-red-800',
}

// Stato tesserino
export const STATO_TESSERINO_LABEL: Record<StatoTesserino, string> = {
  attivo: 'Attivo',
  scaduto: 'Scaduto',
  esaurito: 'Esaurito',
  sospeso: 'Sospeso',
}
export const STATO_TESSERINO_COLORE: Record<StatoTesserino, string> = {
  attivo: 'bg-green-100 text-green-800',
  scaduto: 'bg-red-100 text-red-800',
  esaurito: 'bg-amber-100 text-amber-800',
  sospeso: 'bg-gray-100 text-gray-600',
}

// Verifica se la cancellazione è nei tempi per restituzione lezione
export function puoCancellareConRestituzione(
  dataSlot: string,
  oraInizio: string,
  oreMinime: number = 24
): boolean {
  const dataOraSlot = parseISO(`${dataSlot}T${oraInizio}`)
  const ore = differenceInHours(dataOraSlot, new Date())
  return ore >= oreMinime
}

// Numero fattura progressivo
export function generaNumeroFattura(anno: number, progressivo: number): string {
  return `${anno}/${String(progressivo).padStart(4, '0')}`
}

// Calcolo IVA
export function calcolaIVA(imponibile: number, aliquota: number): {
  importo_iva: number
  totale: number
} {
  const importo_iva = Math.round(imponibile * aliquota) / 100
  return { importo_iva, totale: imponibile + importo_iva }
}

// Iniziali da nome e cognome
export function iniziali(nome: string, cognome: string): string {
  return `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase()
}

// Classi CSS condizionali
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
