-- ============================================================
-- MY PILATES STUDIO — Schema database completo
-- Esegui questo file nel SQL Editor di Supabase
-- ============================================================

-- Abilita estensione UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ADMIN
-- ============================================================
CREATE TABLE admin (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONFIGURAZIONE (singleton — una sola riga)
-- ============================================================
CREATE TABLE configurazione (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_palestra TEXT NOT NULL DEFAULT 'My Pilates Studio',
  indirizzo TEXT,
  piva_palestra TEXT,
  cf_palestra TEXT,
  regime_fiscale TEXT DEFAULT 'RF01', -- RF01=ordinario, RF19=forfettario
  ore_cancellazione_minime INTEGER NOT NULL DEFAULT 24,
  posti_per_slot INTEGER NOT NULL DEFAULT 4,
  email_palestra TEXT,
  telefono_palestra TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO configurazione DEFAULT VALUES;

-- ============================================================
-- INFORMATIVA VERSIONI
-- ============================================================
CREATE TABLE informativa_versioni (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  versione TEXT NOT NULL UNIQUE,
  valida_dal DATE NOT NULL DEFAULT CURRENT_DATE,
  testo_url TEXT,
  attiva BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO informativa_versioni (versione, attiva) VALUES ('1.0', TRUE);

-- ============================================================
-- ISCRITTO
-- ============================================================
CREATE TABLE iscritto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  codice_fiscale TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  data_nascita DATE NOT NULL,
  telefono TEXT,
  password_hash TEXT NOT NULL,
  stato TEXT NOT NULL DEFAULT 'attivo' CHECK (stato IN ('attivo','sospeso','eliminato')),
  auth_user_id UUID UNIQUE, -- collegamento con Supabase Auth
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONSENSI LOG
-- ============================================================
CREATE TABLE consensi_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  iscritto_id UUID NOT NULL REFERENCES iscritto(id) ON DELETE CASCADE,
  tipo_consenso TEXT NOT NULL CHECK (tipo_consenso IN ('contratto','obblighi_legge','marketing','terzi')),
  valore BOOLEAN NOT NULL,
  registrato_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  versione_informativa TEXT NOT NULL DEFAULT '1.0',
  canale TEXT NOT NULL DEFAULT 'web_registrazione' CHECK (canale IN ('web_registrazione','app','modulo_cartaceo','admin'))
);

-- ============================================================
-- LISTINO PREZZI
-- ============================================================
CREATE TABLE listino (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  livello TEXT NOT NULL CHECK (livello IN ('base','intermedio','avanzato')),
  lezioni INTEGER NOT NULL,
  prezzo NUMERIC(10,2) NOT NULL,
  descrizione TEXT,
  attivo BOOLEAN NOT NULL DEFAULT TRUE,
  valido_dal DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prezzi di esempio
INSERT INTO listino (livello, lezioni, prezzo, descrizione) VALUES
  ('base',       5,  60.00, '5 lezioni livello base'),
  ('base',       10, 110.00,'10 lezioni livello base'),
  ('intermedio', 5,  70.00, '5 lezioni livello intermedio'),
  ('intermedio', 10, 130.00,'10 lezioni livello intermedio'),
  ('avanzato',   5,  80.00, '5 lezioni livello avanzato'),
  ('avanzato',   10, 150.00,'10 lezioni livello avanzato');

-- ============================================================
-- TESSERINO
-- ============================================================
CREATE TABLE tesserino (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  iscritto_id UUID NOT NULL REFERENCES iscritto(id) ON DELETE CASCADE,
  listino_id UUID REFERENCES listino(id),
  livello TEXT NOT NULL CHECK (livello IN ('base','intermedio','avanzato')),
  lezioni_totali INTEGER NOT NULL,
  lezioni_residue INTEGER NOT NULL,
  importo_pagato NUMERIC(10,2) NOT NULL,
  sconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  nota_sconto TEXT,
  data_inizio DATE NOT NULL,
  data_scadenza DATE NOT NULL,
  stato TEXT NOT NULL DEFAULT 'attivo' CHECK (stato IN ('attivo','scaduto','esaurito','sospeso')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT lezioni_residue_non_negative CHECK (lezioni_residue >= 0),
  CONSTRAINT lezioni_residue_max CHECK (lezioni_residue <= lezioni_totali)
);

-- ============================================================
-- SLOT
-- ============================================================
CREATE TABLE slot (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creato_da UUID NOT NULL REFERENCES admin(id),
  data DATE NOT NULL,
  ora_inizio TIME NOT NULL,
  ora_fine TIME NOT NULL,
  livello TEXT NOT NULL CHECK (livello IN ('base','intermedio','avanzato')),
  posti_max INTEGER NOT NULL DEFAULT 4,
  posti_occupati INTEGER NOT NULL DEFAULT 0,
  stato TEXT NOT NULL DEFAULT 'disponibile' CHECK (stato IN ('disponibile','chiuso','cancellato')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT posti_occupati_non_negative CHECK (posti_occupati >= 0),
  CONSTRAINT posti_occupati_max CHECK (posti_occupati <= posti_max),
  CONSTRAINT ora_fine_dopo_inizio CHECK (ora_fine > ora_inizio)
);

-- ============================================================
-- PRENOTAZIONE
-- ============================================================
CREATE TABLE prenotazione (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  iscritto_id UUID NOT NULL REFERENCES iscritto(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES slot(id) ON DELETE CASCADE,
  tesserino_id UUID NOT NULL REFERENCES tesserino(id),
  prenotata_at TIMESTAMPTZ DEFAULT NOW(),
  stato TEXT NOT NULL DEFAULT 'confermata' CHECK (stato IN ('confermata','cancellata','presente','assente')),
  cancellata_at TIMESTAMPTZ,
  lezione_restituita BOOLEAN NOT NULL DEFAULT FALSE,
  note_presenza TEXT,
  UNIQUE (iscritto_id, slot_id) -- un iscritto non può prenotare lo stesso slot due volte
);

-- ============================================================
-- FATTURA
-- ============================================================
CREATE TABLE fattura (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  iscritto_id UUID NOT NULL REFERENCES iscritto(id),
  tesserino_id UUID NOT NULL REFERENCES tesserino(id),
  numero_fattura TEXT NOT NULL UNIQUE,
  data_emissione DATE NOT NULL DEFAULT CURRENT_DATE,
  imponibile NUMERIC(10,2) NOT NULL,
  aliquota_iva NUMERIC(5,2) NOT NULL DEFAULT 0, -- 0 se esente/forfettario
  importo_iva NUMERIC(10,2) NOT NULL DEFAULT 0,
  totale NUMERIC(10,2) NOT NULL,
  stato TEXT NOT NULL DEFAULT 'bozza' CHECK (stato IN ('bozza','emessa','pagata','annullata')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNZIONI E TRIGGER
-- ============================================================

-- Aggiorna updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_iscritto_updated_at
  BEFORE UPDATE ON iscritto
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tesserino_updated_at
  BEFORE UPDATE ON tesserino
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Aggiorna stato tesserino automaticamente
CREATE OR REPLACE FUNCTION aggiorna_stato_tesserino()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lezioni_residue = 0 THEN
    NEW.stato = 'esaurito';
  ELSIF NEW.data_scadenza < CURRENT_DATE THEN
    NEW.stato = 'scaduto';
  ELSE
    NEW.stato = 'attivo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stato_tesserino
  BEFORE UPDATE ON tesserino
  FOR EACH ROW EXECUTE FUNCTION aggiorna_stato_tesserino();

-- Prenotazione: scala lezione e incrementa posti_occupati (transazione atomica)
CREATE OR REPLACE FUNCTION prenota_slot(
  p_iscritto_id UUID,
  p_slot_id UUID,
  p_tesserino_id UUID
) RETURNS prenotazione AS $$
DECLARE
  v_slot slot%ROWTYPE;
  v_tesserino tesserino%ROWTYPE;
  v_prenotazione prenotazione%ROWTYPE;
BEGIN
  -- Lock righe per evitare race condition
  SELECT * INTO v_slot FROM slot WHERE id = p_slot_id FOR UPDATE;
  SELECT * INTO v_tesserino FROM tesserino WHERE id = p_tesserino_id FOR UPDATE;

  -- Validazioni
  IF v_slot.posti_occupati >= v_slot.posti_max THEN
    RAISE EXCEPTION 'Slot pieno';
  END IF;
  IF v_slot.stato != 'disponibile' THEN
    RAISE EXCEPTION 'Slot non disponibile';
  END IF;
  IF v_tesserino.lezioni_residue <= 0 THEN
    RAISE EXCEPTION 'Nessuna lezione residua nel tesserino';
  END IF;
  IF v_tesserino.data_scadenza < CURRENT_DATE THEN
    RAISE EXCEPTION 'Tesserino scaduto';
  END IF;
  IF v_tesserino.stato != 'attivo' THEN
    RAISE EXCEPTION 'Tesserino non attivo';
  END IF;

  -- Crea prenotazione
  INSERT INTO prenotazione (iscritto_id, slot_id, tesserino_id)
  VALUES (p_iscritto_id, p_slot_id, p_tesserino_id)
  RETURNING * INTO v_prenotazione;

  -- Scala lezione
  UPDATE tesserino SET lezioni_residue = lezioni_residue - 1 WHERE id = p_tesserino_id;

  -- Incrementa posti occupati
  UPDATE slot SET posti_occupati = posti_occupati + 1 WHERE id = p_slot_id;

  RETURN v_prenotazione;
END;
$$ LANGUAGE plpgsql;

-- Cancellazione con logica restituzione (opzione B: finestra 24h)
CREATE OR REPLACE FUNCTION cancella_prenotazione(
  p_prenotazione_id UUID,
  p_iscritto_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_pren prenotazione%ROWTYPE;
  v_slot slot%ROWTYPE;
  v_config configurazione%ROWTYPE;
  v_ore_diff NUMERIC;
  v_restituisce BOOLEAN;
BEGIN
  SELECT * INTO v_pren FROM prenotazione
  WHERE id = p_prenotazione_id AND iscritto_id = p_iscritto_id AND stato = 'confermata'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prenotazione non trovata o già cancellata';
  END IF;

  SELECT * INTO v_slot FROM slot WHERE id = v_pren.slot_id FOR UPDATE;
  SELECT * INTO v_config FROM configurazione LIMIT 1;

  -- Calcola ore rimanenti allo slot
  v_ore_diff := EXTRACT(EPOCH FROM (
    (v_slot.data + v_slot.ora_inizio)::TIMESTAMPTZ - NOW()
  )) / 3600;

  v_restituisce := v_ore_diff >= v_config.ore_cancellazione_minime;

  -- Aggiorna prenotazione
  UPDATE prenotazione SET
    stato = 'cancellata',
    cancellata_at = NOW(),
    lezione_restituita = v_restituisce
  WHERE id = p_prenotazione_id;

  -- Decrementa posti occupati
  UPDATE slot SET posti_occupati = GREATEST(posti_occupati - 1, 0) WHERE id = v_pren.slot_id;

  -- Restituisce lezione se nei tempi
  IF v_restituisce THEN
    UPDATE tesserino SET lezioni_residue = lezioni_residue + 1 WHERE id = v_pren.tesserino_id;
  END IF;

  RETURN v_restituisce;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE iscritto ENABLE ROW LEVEL SECURITY;
ALTER TABLE tesserino ENABLE ROW LEVEL SECURITY;
ALTER TABLE prenotazione ENABLE ROW LEVEL SECURITY;
ALTER TABLE consensi_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fattura ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot ENABLE ROW LEVEL SECURITY;
ALTER TABLE listino ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurazione ENABLE ROW LEVEL SECURITY;

-- Iscritto: vede solo i propri dati
CREATE POLICY iscritto_self ON iscritto
  FOR ALL USING (auth.uid() = auth_user_id);

-- Tesserino: iscritto vede solo i propri
CREATE POLICY tesserino_self ON tesserino
  FOR SELECT USING (
    iscritto_id IN (SELECT id FROM iscritto WHERE auth_user_id = auth.uid())
  );

-- Prenotazione: iscritto gestisce solo le proprie
CREATE POLICY prenotazione_self ON prenotazione
  FOR ALL USING (
    iscritto_id IN (SELECT id FROM iscritto WHERE auth_user_id = auth.uid())
  );

-- Slot: tutti gli autenticati possono leggere gli slot disponibili
CREATE POLICY slot_read ON slot
  FOR SELECT USING (auth.role() = 'authenticated' AND stato = 'disponibile');

-- Listino: tutti gli autenticati possono leggere
CREATE POLICY listino_read ON listino
  FOR SELECT USING (auth.role() = 'authenticated' AND attivo = TRUE);

-- Configurazione: tutti possono leggere (nome palestra ecc.)
CREATE POLICY configurazione_read ON configurazione
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- INDICI per performance
-- ============================================================
CREATE INDEX idx_slot_data ON slot(data);
CREATE INDEX idx_slot_stato ON slot(stato);
CREATE INDEX idx_prenotazione_iscritto ON prenotazione(iscritto_id);
CREATE INDEX idx_prenotazione_slot ON prenotazione(slot_id);
CREATE INDEX idx_prenotazione_stato ON prenotazione(stato);
CREATE INDEX idx_tesserino_iscritto ON tesserino(iscritto_id);
CREATE INDEX idx_tesserino_stato ON tesserino(stato);
CREATE INDEX idx_consensi_iscritto ON consensi_log(iscritto_id);
CREATE INDEX idx_fattura_iscritto ON fattura(iscritto_id);
