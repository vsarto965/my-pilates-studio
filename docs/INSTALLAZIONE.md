# My Pilates Studio — Guida all'installazione

## Prerequisiti
- Node.js 18+ installato (https://nodejs.org)
- Un account gratuito su Supabase (https://supabase.com)
- Un account gratuito su Vercel (https://vercel.com)

---

## Passo 1 — Configura Supabase

1. Vai su https://supabase.com → "New project"
2. Scegli un nome (es. "my-pilates-studio") e una password del database
3. Attendi la creazione (1-2 minuti)
4. Vai su **SQL Editor** (menu a sinistra)
5. Copia e incolla il contenuto del file `supabase/migrations/001_schema_iniziale.sql`
6. Clicca **Run** — verrà creato tutto il database

### Recupera le chiavi API
- Menu a sinistra → **Settings → API**
- Copia:
  - `Project URL` → sarà `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` → sarà `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role secret` → sarà `SUPABASE_SERVICE_ROLE_KEY`

---

### Crea l'utente admin (segui l'ordine esatto)

**Step A — Crea l'utente in Supabase Authentication**

1. Nel menu a sinistra vai su **Authentication → Users**
2. Clicca **"Add user" → "Create new user"**
3. Inserisci:
   - Email: `admin@miopilates.it` (o quella che preferisci)
   - Password: scegli una password sicura (minimo 8 caratteri)
   - Spunta **"Auto Confirm User"** (così non serve conferma via email)
4. Clicca **"Create user"**
5. L'utente appare nella lista — **copia l'UUID** che vedi nella colonna "UID"
   (è un codice tipo `a1b2c3d4-e5f6-...`)

**Step B — Collega l'utente alla tabella admin**

Vai su **SQL Editor** ed esegui questo script,
sostituendo i due valori con i tuoi dati reali:

```sql
-- Sostituisci con la tua email e con l'UUID copiato al passo A
INSERT INTO admin (email, password_hash)
VALUES (
  'admin@miopilates.it',
  'auth-managed'
);
```

> Nota: `password_hash` vale `'auth-managed'` perché la password
> è gestita interamente da Supabase Authentication — non viene
> mai salvata nella tabella `admin`.

**Step C — Verifica**

Sempre nel SQL Editor:
```sql
SELECT * FROM admin;
```
Deve apparire una riga con la tua email. Se la vedi, l'admin è pronto.

---

## Passo 2 — Esegui in locale (sviluppo)

```bash
# Entra nella cartella del progetto
cd my-pilates-studio

# Installa le dipendenze
npm install

# Copia il file delle variabili d'ambiente
cp .env.example .env.local
```

Apri il file `.env.local` con un editor di testo
(su Windows: Blocco Note; su Mac: TextEdit) e incolla le tue chiavi:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

Poi avvia l'applicazione:

```bash
npm run dev
```

Apri http://localhost:3000 — dovresti vedere la pagina di login.
Accedi con l'email e password admin create al Passo 1.

---

## Passo 3 — Deploy su Vercel (produzione)

### Opzione A — Da GitHub (consigliata)

1. Crea un repository su https://github.com (gratuito)
2. Carica i file del progetto nel repository
   - Su GitHub.com: "Add file → Upload files"
3. Vai su https://vercel.com → "New Project"
4. Seleziona il repository appena creato
5. Nella sezione **Environment Variables**, aggiungi le tre variabili:

   | Nome | Valore |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | il tuo URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la chiave anon |
   | `SUPABASE_SERVICE_ROLE_KEY` | la chiave service role |

6. Clicca **Deploy**

In 2-3 minuti l'app è online con un URL tipo `my-pilates-studio.vercel.app`.

### Opzione B — Deploy diretto senza GitHub

1. Installa Vercel CLI:
   ```bash
   npm install -g vercel
   ```
2. Dalla cartella del progetto:
   ```bash
   vercel
   ```
3. Segui le istruzioni a schermo — ti chiederà di fare login su Vercel
4. Aggiungi le variabili d'ambiente quando richiesto

### Dominio personalizzato (opzionale)
In Vercel → Settings → Domains → aggiungi il tuo dominio
(es. `app.miopilates.it`).

---

## Aggiungere un nuovo iscritto (dopo il go-live)

Gli iscritti NON si registrano da soli — è sempre l'admin a crearli
tramite il pannello. Il flusso è:

1. Admin accede al pannello → sezione **Iscritti**
2. Clicca **"+ Nuovo iscritto"** → compila il form a 4 step
   (dati anagrafici → consensi GDPR → tesserino → riepilogo)
3. Al salvataggio, il sistema crea automaticamente:
   - Il profilo iscritto con codice fiscale
   - Il tesserino con importo e sconto
   - Il log dei consensi GDPR con timestamp e IP
   - La bozza di fattura

L'iscritto riceve la propria email e password per accedere all'app.

> **Attenzione**: nel form di registrazione, la password viene impostata
> dall'admin nella schermata "Dati anagrafici". Consegnala all'iscritto
> e invitala a cambiarla al primo accesso (funzionalità da aggiungere
> come sviluppo futuro, vedi sotto).

---

## Struttura del progetto

```
src/
├── app/
│   ├── login/           → Pagina di accesso (admin + iscritti)
│   ├── admin/
│   │   ├── calendario/  → Gestione slot e presenze
│   │   ├── tesserini/   → Iscritti, registrazione GDPR
│   │   └── listino/     → Gestione prezzi
│   ├── iscritto/
│   │   └── calendario/  → Visualizzazione slot e prenotazioni
│   └── api/
│       └── fatture/     → Generazione fattura PDF
├── components/
│   ├── admin/           → Componenti pannello admin
│   └── iscritto/        → Componenti app iscritto
├── lib/
│   ├── supabase.ts      → Client Supabase
│   └── utils.ts         → Funzioni di utilità
└── types/
    └── index.ts         → Tipi TypeScript

supabase/
└── migrations/
    └── 001_schema_iniziale.sql  → Schema completo del database
```

---

## Funzionalità implementate

### Pannello Admin
- [x] Login con ruolo admin
- [x] Calendario mensile con pubblicazione slot
- [x] Gestione presenze per slot
- [x] Registrazione iscritti con form a 4 step
- [x] Raccolta consensi GDPR con log completo (timestamp + IP)
- [x] Gestione tesserini (creazione, rinnovo)
- [x] Codice fiscale per fatturazione
- [x] Gestione listino prezzi con storico
- [x] Generazione fattura PDF

### App Iscritto
- [x] Login con credenziali personali
- [x] Visualizzazione tesserino con lezioni residue e barra avanzamento
- [x] Calendario mensile disponibilità con indicatori visivi
- [x] Prenotazione slot con modal di conferma e conteggio lezioni
- [x] Cancellazione con logica restituzione 24h (Opzione B)
- [x] Visualizzazione prossima lezione prenotata

### Database
- [x] Schema completo con 9 tabelle
- [x] Transazioni atomiche anti race-condition per prenotazione/cancellazione
- [x] Row Level Security (ogni iscritto vede solo i propri dati)
- [x] Trigger automatici (stato tesserino, updated_at)
- [x] Indici per performance
- [x] Funzioni SQL `prenota_slot` e `cancella_prenotazione`

---

## Sviluppi futuri consigliati

### Cambio password al primo accesso
Aggiungere una pagina `/iscritto/profilo` con il form di cambio password
usando `supabase.auth.updateUser({ password: nuovaPassword })`.

### Notifiche email automatiche
Supabase Edge Functions permette di inviare email quando:
- Una prenotazione viene confermata
- Mancano 24h a uno slot prenotato (promemoria)
- Il tesserino ha ≤ 2 lezioni rimanenti

### Fatturazione elettronica SDI
Quando necessario, integrare la libreria `fatturapa-js`
o appoggiarsi a Fatture in Cloud API / Aruba Sign.

### App mobile nativa
L'app è già responsive su mobile via browser.
Per una versione nativa iOS/Android: React Native + Expo,
riutilizzando tutta la logica Supabase già scritta.
