// Tipi principali dell'applicazione My Pilates Studio

export type Livello = 'base' | 'intermedio' | 'avanzato'
export type StatoIscritto = 'attivo' | 'sospeso' | 'eliminato'
export type StatoTesserino = 'attivo' | 'scaduto' | 'esaurito' | 'sospeso'
export type StatoSlot = 'disponibile' | 'chiuso' | 'cancellato'
export type StatoPrenotazione = 'confermata' | 'cancellata' | 'presente' | 'assente'
export type StatoFattura = 'bozza' | 'emessa' | 'pagata' | 'annullata'
export type TipoConsenso = 'contratto' | 'obblighi_legge' | 'marketing' | 'terzi'
export type CanalConsenso = 'web_registrazione' | 'app' | 'modulo_cartaceo' | 'admin'

export interface Iscritto {
  id: string
  nome: string
  cognome: string
  codice_fiscale: string
  email: string
  data_nascita: string
  telefono?: string
  stato: StatoIscritto
  auth_user_id?: string
  created_at: string
  updated_at: string
}

export interface Tesserino {
  id: string
  iscritto_id: string
  listino_id?: string
  livello: Livello
  lezioni_totali: number
  lezioni_residue: number
  importo_pagato: number
  sconto: number
  nota_sconto?: string
  data_inizio: string
  data_scadenza: string
  stato: StatoTesserino
  created_at: string
  updated_at: string
  // join
  iscritto?: Iscritto
}

export interface Slot {
  id: string
  creato_da: string
  data: string
  ora_inizio: string
  ora_fine: string
  livello: Livello
  posti_max: number
  posti_occupati: number
  stato: StatoSlot
  note?: string
  created_at: string
  // join
  prenotazioni?: Prenotazione[]
}

export interface Avviso {
  id: string
  testo: string
  data_inizio: string
  data_fine: string
  creato_da?: string
  created_at: string
}


export interface Prenotazione {
  id: string
  iscritto_id: string
  slot_id: string
  tesserino_id: string
  prenotata_at: string
  stato: StatoPrenotazione
  cancellata_at?: string
  lezione_restituita: boolean
  note_presenza?: string
  // join
  iscritto?: Iscritto
  slot?: Slot
  tesserino?: Tesserino
}

export interface Listino {
  id: string
  livello: Livello
  lezioni: number
  prezzo: number
  descrizione?: string
  attivo: boolean
  valido_dal: string
  created_at: string
}

export interface Fattura {
  id: string
  iscritto_id: string
  tesserino_id: string
  numero_fattura: string
  data_emissione: string
  imponibile: number
  aliquota_iva: number
  importo_iva: number
  totale: number
  stato: StatoFattura
  note?: string
  created_at: string
  // join
  iscritto?: Iscritto
  tesserino?: Tesserino
}

export interface ConsensoLog {
  id: string
  iscritto_id: string
  tipo_consenso: TipoConsenso
  valore: boolean
  registrato_at: string
  ip_address?: string
  versione_informativa: string
  canale: CanalConsenso
}

export interface Configurazione {
  id: string
  nome_palestra: string
  indirizzo?: string
  piva_palestra?: string
  cf_palestra?: string
  regime_fiscale: string
  ore_cancellazione_minime: number
  posti_per_slot: number
  email_palestra?: string
  telefono_palestra?: string
}

// Tipi per i form
export interface FormRegistrazione {
  nome: string
  cognome: string
  codice_fiscale: string
  email: string
  data_nascita: string
  telefono?: string
  password: string
  livello: Livello
  lezioni: number
  listino_id?: string
  data_inizio: string
  data_scadenza: string
  importo_pagato: number
  sconto: number
  nota_sconto?: string
  consensi: Record<TipoConsenso, boolean>
}

export interface FormSlot {
  data: string
  ora_inizio: string
  ora_fine: string
  livello: Livello
  posti_max: number
  note?: string
}

export interface FormAvviso {
  testo: string
  data_inizio: string
  data_fine: string
}

// Database type per Supabase (semplificato)
export interface Database {
  public: {
    Tables: {
      iscritto: { Row: Iscritto; Insert: Omit<Iscritto, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Iscritto> }
      tesserino: { Row: Tesserino; Insert: Omit<Tesserino, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Tesserino> }
      slot: { Row: Slot; Insert: Omit<Slot, 'id' | 'created_at'>; Update: Partial<Slot> }
      prenotazione: { Row: Prenotazione; Insert: Omit<Prenotazione, 'id' | 'prenotata_at'>; Update: Partial<Prenotazione> }
      listino: { Row: Listino; Insert: Omit<Listino, 'id' | 'created_at'>; Update: Partial<Listino> }
      fattura: { Row: Fattura; Insert: Omit<Fattura, 'id' | 'created_at'>; Update: Partial<Fattura> }
      consensi_log: { Row: ConsensoLog; Insert: Omit<ConsensoLog, 'id' | 'registrato_at'>; Update: Partial<ConsensoLog> }
      configurazione: { Row: Configurazione; Insert: Partial<Configurazione>; Update: Partial<Configurazione> }
      avviso: { Row: Avviso; Insert: Omit<Avviso, 'id' | 'created_at'>; Update: Partial<Avviso> }
    }
  }
}
