# Spesa di Famiglia

> Stato: il progetto Firebase `spesa-famiglia-e9746` è già configurato e collegato
> (accesso anonimo attivo, regole pubblicate). Restano da fare i passi 5 e 6.

Lista della spesa condivisa. Ogni familiare entra con un profilo dell'app,
cioè il proprio nome e un PIN di 4 cifre. Non serve registrarsi da nessuna
parte.

- **Aggiungi**: scrivi l'articolo e, se vuoi, la quantità. Il reparto viene
  proposto in automatico.
- **Preso** (cerchio a sinistra): spunta l'articolo mentre sei al supermercato.
- **⊖ Togli dalla lista**: l'articolo sparisce dalla lista ma resta in
  **Già comprati in passato**. Lo rimetti in lista con un tocco. Scrivendo nel campo
  "Cosa serve?" filtri anche gli articoli di Già comprati in passato.
- **Cestino**: elimina l'articolo per sempre.
- **📷 Foto**: quando aggiungi un articolo puoi allegare una foto (fotocamera o
  galleria). Nella lista compare la miniatura: toccala per vederla grande,
  cambiarla o toglierla. Le foto vengono rimpicciolite sul telefono prima di
  essere salvate, così non pesano.
- **Fine spesa: togli i presi**: sposta tutti gli articoli spuntati in Già comprati in passato.
- Ogni azione si può annullare per qualche secondo con **Annulla**.

Finché il database non è collegato, l'app gira in **modalità prova**: funziona,
ma i dati restano sul dispositivo che la apre.

## Configurazione (una volta sola, la fa solo chi gestisce l'app)

I dati condivisi stanno su Firebase, il servizio gratuito di Google. L'account
Google serve solo a te per creare il database. I familiari non hanno bisogno di
nessun account.

### 1. Crea il progetto Firebase
1. Vai su <https://console.firebase.google.com> ed entra con il tuo account Google.
2. Premi **Crea un progetto** e chiamalo per esempio `spesa-famiglia`. Google
   Analytics non serve: puoi disattivarlo.

### 2. Attiva l'accesso anonimo
1. Nel menu a sinistra apri **Build → Authentication** e premi **Inizia**.
2. Nella scheda **Metodo di accesso** scegli **Anonimo**, attivalo e salva.

Serve solo a far rispettare le regole del database. Chi usa l'app non vede niente.

### 3. Crea il database
1. Apri **Build → Firestore Database** e premi **Crea database**.
2. Scegli una località europea (per esempio `eur3` o `europe-west`) e avvia in
   **modalità produzione**.
3. Apri la scheda **Regole**, sostituisci tutto con il contenuto del file
   [`firestore.rules`](firestore.rules) e premi **Pubblica**.

### 4. Copia la configurazione nell'app
1. Apri **Impostazioni progetto** (rotellina in alto a sinistra) → **Le tue app**
   e premi l'icona **</>** (Web). Dai un nome qualsiasi. Firebase Hosting non serve.
2. Firebase mostra un oggetto `firebaseConfig = { apiKey: ..., ... }`.
   Incollalo in [`firebase-config.js`](firebase-config.js) al posto di `null`,
   oppure mandalo a Claude e lo inserisce lui.

### 5. Pubblica l'app su GitHub Pages
1. Su GitHub apri il repository → **Settings → Pages** e in **Source** scegli
   **GitHub Actions**. Con un account GitHub gratuito, Pages funziona solo se il
   repository è pubblico.
2. Il workflow `.github/workflows/pages.yml` pubblica l'app da solo a ogni
   modifica del branch `main`.
3. L'app sarà su `https://gigliogiovannig-ctrl.github.io/spesa/`.
4. In Firebase, in **Authentication → Impostazioni → Domini autorizzati**,
   aggiungi `gigliogiovannig-ctrl.github.io`.

### 6. Primo avvio
1. Apri l'app, scrivi il nome della famiglia e crea il tuo profilo.
2. Tocca il tuo nome in alto a destra → **Invita i familiari** e manda il link.
   Chi lo apre sceglie il proprio nome e un PIN, poi entra.
3. Sul telefono puoi aggiungere l'app alla schermata Home. Su Android usa il
   menu ⋮ → **Aggiungi a schermata Home**. Su iPhone usa Condividi →
   **Aggiungi alla schermata Home**. Fallo dopo aver aperto il link d'invito,
   così l'app ricorda la famiglia.

## Sicurezza, in breve
- Il link d'invito contiene un codice di 20 caratteri casuali. Chi non ha il
  link non può trovare né leggere la lista, quindi mandalo solo ai familiari.
- Il PIN distingue le persone di casa, ma non è una protezione forte. Non usare
  PIN importanti come quello del bancomat.
- L'app si apre anche senza internet (service worker in `sw.js`), basta averla
  aperta almeno una volta con la connessione. Senza rete mostra l'ultima
  versione della lista salvata sul telefono. Le modifiche fatte offline
  partono appena torna la connessione.
