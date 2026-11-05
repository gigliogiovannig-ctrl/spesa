// Spesa di Famiglia — lista della spesa condivisa.
// Ogni familiare entra con un profilo dell'app (nome + PIN), senza account esterni.
// I dati stanno su Firebase Firestore; senza configurazione l'app gira in modalità prova.

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";

// ---------- Reparti ----------
const AISLES = [
  ["frutta", "🍎", "Frutta e verdura", /mel[ae]|banan|aranc|limon|pomodor|insalat|lattug|zucchin|carot|patat|cipoll|agli|frutta|verdur|\bpera|\bpere\b|\buva\b|fragol|kiwi|spinac|peperon|melanzan|funghi|basilico|prezzemolo|rucola/],
  ["pane", "🥖", "Pane e forno", /\bpane|panin|grissin|focacc|cracker|fette biscott|piadin|brioche|cornett/],
  ["latte", "🧀", "Latte, uova e formaggi", /latte|yogurt|burro|panna|\buov|formagg|mozzarell|parmigian|grana|ricotta|stracchino|mascarpone|scamorza/],
  ["carne", "🥩", "Carne, pesce e salumi", /carne|pollo|tacchin|manzo|maiale|salsicc|hamburger|macinat|pesce|salmone|merluzz|gamber|prosciutt|salam|mortadell|bresaola|wurstel|speck/],
  ["dispensa", "🍝", "Dispensa", /pasta|\briso\b|farina|zucchero|\bsale\b|\bolio|aceto|tonno|passata|pelati|legumi|ceci|fagiol|lenticch|caff[eè]|\bt[eè]\b|biscott|cereali|marmellat|nutella|miele|sugo|spezie|\bpepe\b/],
  ["surgelati", "🧊", "Surgelati", /surgel|gelat|pisellini|bastoncin|ghiaccio/],
  ["bevande", "🥤", "Bevande", /acqua|vino|birra|succo|bibit|coca|aranciata|spremuta/],
  ["casa", "🧴", "Casa e igiene", /detersiv|sapone|shampoo|dentifric|carta igien|scottex|tovagliol|spugn|candeggin|ammorbid|sacchett|pellicol|alluminio|deodorant|pannolin|assorbent|piatti/],
  ["altro", "🛒", "Altro", null],
];
const AISLE_ORDER = Object.fromEntries(AISLES.map((a, i) => [a[0], i]));
const AISLE_EMOJI = Object.fromEntries(AISLES.map(a => [a[0], a[1]]));
const AISLE_NAME = Object.fromEntries(AISLES.map(a => [a[0], a[2]]));
const guessAisle = text => { const v = text.toLowerCase(); const hit = AISLES.find(a => a[3] && a[3].test(v)); return hit ? hit[0] : "altro"; };

const COLORS = ["#2E7D5B", "#C0562F", "#3D6FB6", "#9A4FB0", "#B0820F", "#1F8A99", "#C2417A", "#5E6B2E"];

// ---------- Piccoli strumenti ----------
const $ = s => document.querySelector(s);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style") el.style.cssText = v;
    else if (k === "value") el.value = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const keyOf = name => name.trim().toLowerCase().replace(/\s+/g, " ");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const randomHex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, "0")).join("");
async function hashPin(salt, pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const ICON = {
  check: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" fill="none" stroke="var(--accent-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bin: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 5h11M7 5V3.5h4V5M5 5l.8 9.5h6.4L13 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  camera: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6.5h3l1.5-2h5l1.5 2h3v9H3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="10" cy="10.8" r="2.8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  off: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 9h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

// ---------- Archivio: Firebase ----------
async function firebaseStore(config) {
  const { initializeApp } = await import(FB + "firebase-app.js");
  const { getAuth, signInAnonymously } = await import(FB + "firebase-auth.js");
  const fs = await import(FB + "firebase-firestore.js");
  const app = initializeApp(config);
  let db;
  try {
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch { db = fs.getFirestore(app); }
  // Accesso anonimo e invisibile: serve solo a far rispettare le regole del database.
  const auth = getAuth(app);
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);

  const col = (fid, c) => fs.collection(db, "families", fid, c);
  return {
    demo: false,
    async getFamily(fid) { const s = await fs.getDoc(fs.doc(db, "families", fid)); return s.exists() ? s.data() : null; },
    async createFamily(name) { const ref = fs.doc(fs.collection(db, "families")); await fs.setDoc(ref, { name, at: Date.now() }); return ref.id; },
    watch(fid, c, cb, err) { return fs.onSnapshot(col(fid, c), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), err); },
    newId(fid, c) { return fs.doc(col(fid, c)).id; },
    async get(fid, c, id) { const s = await fs.getDoc(fs.doc(db, "families", fid, c, id)); return s.exists() ? s.data() : null; },
    set(fid, c, id, data) { return fs.setDoc(fs.doc(db, "families", fid, c, id), data); },
    update(fid, c, id, patch) { return fs.updateDoc(fs.doc(db, "families", fid, c, id), patch); },
    remove(fid, c, id) { return fs.deleteDoc(fs.doc(db, "families", fid, c, id)); },
  };
}

// ---------- Archivio: modalità prova (solo questo dispositivo) ----------
function demoStore() {
  const KEY = "spesa-demo";
  let data; try { data = JSON.parse(ls.get(KEY)) || { families: {} }; } catch { data = { families: {} }; }
  const subs = new Set();
  const rid = () => randomHex(10);
  const col = (fid, c) => (data.families[fid][c] ||= {});
  const save = () => { ls.set(KEY, JSON.stringify(data)); subs.forEach(f => f()); return Promise.resolve(); };
  return {
    demo: true,
    async getFamily(fid) { const f = data.families[fid]; return f ? { name: f.name } : null; },
    async createFamily(name) { const id = rid(); data.families[id] = { name, members: {}, items: {} }; await save(); return id; },
    watch(fid, c, cb) {
      const fire = () => cb(Object.entries(col(fid, c)).map(([id, d]) => ({ id, ...d })));
      subs.add(fire); setTimeout(fire, 0); return () => subs.delete(fire);
    },
    newId: rid,
    async get(fid, c, id) { return col(fid, c)[id] || null; },
    set(fid, c, id, d) { col(fid, c)[id] = { ...d }; return save(); },
    update(fid, c, id, patch) { const cur = col(fid, c)[id]; if (!cur) return Promise.reject(new Error("not-found")); Object.assign(cur, patch); return save(); },
    remove(fid, c, id) { delete col(fid, c)[id]; return save(); },
  };
}

// ---------- Foto ----------
// La foto viene rimpicciolita sul telefono prima di salvarla:
// una miniatura (dentro l'articolo, si vede subito anche offline)
// e una versione grande (a parte, si scarica solo quando la apri).
function encodePhoto(img, max, square) {
  const w = img.naturalWidth, hgt = img.naturalHeight;
  let sx = 0, sy = 0, sw = w, sh = hgt;
  if (square) { const side = Math.min(w, hgt); sx = (w - side) / 2; sy = (hgt - side) / 2; sw = sh = side; }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw * scale)); c.height = Math.max(1, Math.round(sh * scale));
  c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  let q = square ? 0.6 : 0.72, out = c.toDataURL("image/jpeg", q);
  while (out.length > 850000 && q > 0.3) { q -= 0.12; out = c.toDataURL("image/jpeg", q); }
  return out;
}
async function preparePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    return { thumb: encodePhoto(img, 160, true), full: encodePhoto(img, 1280, false) };
  } finally { URL.revokeObjectURL(url); }
}
function savePhoto(itemId, photo) {
  return Promise.resolve(S.store.set(S.fid, "photos", itemId, { data: photo.full, at: Date.now() })).catch(e => {
    console.error(e);
    toast(e && e.code === "permission-denied"
      ? "Foto grande non salvata: va aggiornata la regola del database (vedi istruzioni). La miniatura c'è."
      : "Foto non salvata. Controlla la connessione e riprova.");
  });
}
function pickPhoto(onPicked) {
  const input = h("input", { type: "file", accept: "image/*", hidden: true });
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0]; input.remove();
    if (!file) return;
    try { onPicked(await preparePhoto(file)); }
    catch (e) { console.error(e); toast("Non riesco a leggere questa foto. Prova con un'altra."); }
  });
  document.body.append(input); input.click();
}

function openPhoto(it) {
  const big = h("img", { class: "viewer-img", src: it.thumb, alt: "Foto di " + it.name });
  const note = h("p", { class: "hint", hidden: true });
  const close = () => { dlg.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  const dlg = h("div", { class: "viewer", role: "dialog", "aria-modal": "true", "aria-label": "Foto di " + it.name, onclick: e => { if (e.target === dlg) close(); } },
    h("div", { class: "viewer-box" },
      h("div", { class: "viewer-head" }, h("strong", null, it.name),
        h("button", { class: "icon-btn", type: "button", "aria-label": "Chiudi", onclick: close, html: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' })),
      big, note,
      h("div", { class: "row" },
        h("button", { class: "btn ghost", type: "button", onclick: () => pickPhoto(photo => {
          upd(it.id, { thumb: photo.thumb }); savePhoto(it.id, photo); close(); toast("Foto cambiata");
        }) }, "Cambia foto"),
        h("button", { class: "btn ghost danger-text", type: "button", onclick: () => {
          upd(it.id, { thumb: null }); write(S.store.remove(S.fid, "photos", it.id)); close(); toast("Foto rimossa");
        } }, "Rimuovi foto"))));
  document.body.append(dlg);
  document.addEventListener("keydown", onKey);
  dlg.querySelector("button").focus();
  S.store.get(S.fid, "photos", it.id).then(p => {
    if (p && p.data) big.src = p.data;
    else { note.textContent = "La foto grande non è disponibile: vedi la miniatura."; note.hidden = false; }
  }).catch(() => { note.textContent = "Senza internet si vede solo la miniatura."; note.hidden = false; });
}

// ---------- Stato ----------
const S = {
  store: null, fid: null, family: null,
  members: [], items: [], expenses: [], membersLoaded: false, itemsLoaded: false, expensesLoaded: false,
  tab: ls.get("spesa:tab") === "rimborsi" ? "rimborsi" : "spesa",
  meId: null, view: null, editPantry: false, catTouched: false, menuOpen: false,
};
const me = () => S.members.find(m => m.id === S.meId);
const memberOf = id => S.members.find(m => m.id === id);
const nameOf = id => (memberOf(id) || {}).name || "qualcuno";
const app = $("#app");

function avatar(m, size = "") {
  const name = (m && m.name) || "?";
  return h("span", { class: "avatar " + size, style: `background:${(m && m.color) || "#6B7280"}`, "aria-hidden": "true" }, name.trim().charAt(0).toUpperCase());
}
function setView(name, ...children) { S.view = name; app.replaceChildren(...children.filter(Boolean)); }
function demoBanner() {
  return S.store && S.store.demo
    ? h("p", { class: "banner" }, "Modalità prova: i dati restano solo su questo dispositivo. Per condividere la lista con la famiglia va collegato il database (vedi le istruzioni).")
    : null;
}

// ---------- Messaggi con "Annulla" ----------
let toastTimer, toastUndo = null;
function toast(text, undo) {
  $("#toast-text").textContent = text;
  toastUndo = undo || null;
  $("#toast-undo").hidden = !undo;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("#toast").hidden = true; toastUndo = null; }, 6000);
}
$("#toast-undo").addEventListener("click", () => { const u = toastUndo; toastUndo = null; $("#toast").hidden = true; if (u) u(); });
const saveFailed = () => toast("Modifica non salvata. Controlla la connessione e riprova.");
const write = p => Promise.resolve(p).catch(saveFailed);

// ---------- Avvio ----------
async function boot() {
  try {
    S.store = window.FIREBASE_CONFIG ? await firebaseStore(window.FIREBASE_CONFIG) : demoStore();
  } catch (e) {
    console.error(e);
    return showFatal("Non riesco a collegarmi al database", navigator.onLine === false
      ? "Sei senza internet e su questo telefono non c'è ancora una copia della lista. Aprila una volta con la connessione: poi funzionerà anche offline."
      : "Controlla la connessione. Se il problema resta, verifica che in Firebase sia attivo l'accesso anonimo (vedi istruzioni).");
  }
  const url = new URL(location.href);
  const fid = url.searchParams.get("f") || ls.get("spesa:fid");
  if (!fid) return showWelcome();
  openFamily(fid);
}

async function openFamily(fid) {
  setView("loading", h("p", { class: "loading" }, "Caricamento…"));
  // Il nome della famiglia è salvato sul telefono: così la lista si apre subito,
  // anche senza internet, e il nome si aggiorna in background quando c'è rete.
  const savedName = ls.get("spesa:fam:" + fid);
  let fam;
  if (savedName) {
    fam = { name: savedName };
    S.store.getFamily(fid).then(f => {
      if (f && f.name !== savedName) { ls.set("spesa:fam:" + fid, f.name); S.family = f; if (S.view === "list") showList(); }
    }).catch(() => {});
  } else {
    try { fam = await S.store.getFamily(fid); }
    catch (e) { console.error(e); return showFatal("Non riesco a leggere la lista", "La prima volta serve internet per scaricare la lista. Controlla la connessione e ricarica la pagina."); }
    if (!fam) { ls.del("spesa:fid"); return showWelcome("Questo link non corrisponde a nessuna lista. Chiedi di nuovo il link a chi l'ha creata."); }
    ls.set("spesa:fam:" + fid, fam.name);
  }

  S.fid = fid; S.family = fam;
  ls.set("spesa:fid", fid);
  const url = new URL(location.href);
  if (url.searchParams.get("f") !== fid) { url.searchParams.set("f", fid); history.replaceState(null, "", url); }
  S.meId = ls.get("spesa:me:" + fid);

  const onErr = e => {
    console.error(e);
    showFatal("Accesso al database negato", "Le regole di Firestore non permettono di leggere la lista. Controlla di aver pubblicato le regole di firestore.rules.");
  };
  S.store.watch(fid, "members", list => { S.members = list; S.membersLoaded = true; route(); }, onErr);
  S.store.watch(fid, "items", list => { S.items = list; S.itemsLoaded = true; if (S.view === "list") renderList(); }, onErr);
  S.store.watch(fid, "expenses", list => { S.expenses = list; S.expensesLoaded = true; S.expensesBlocked = false; if (S.view === "list") renderRimborsi(); },
    e => { console.error(e); S.expensesBlocked = true; if (S.view === "list") renderRimborsi(); });
}

function route() {
  if (!S.membersLoaded) return;
  if (!me()) {
    if (!["pin", "new-member"].includes(S.view)) showWho();
    return;
  }
  if (S.view !== "list") showList(); else { renderList(); renderRimborsi(); }
}

function showFatal(title, text) {
  setView("fatal", h("div", { class: "notice", style: "margin-top:20vh" }, h("strong", null, title), text));
}

// ---------- Benvenuto: crea o apri una famiglia ----------
function showWelcome(message) {
  const err = h("p", { class: "error", hidden: !message }, message || "");
  const famName = h("input", { id: "fam-name", placeholder: "es. Casa Rossi", maxlength: "40", required: true });
  const create = h("form", { class: "card", onsubmit: async e => {
    e.preventDefault();
    const name = famName.value.trim(); if (!name) return;
    create.querySelector("button").disabled = true;
    try { openFamily(await S.store.createFamily(name)); }
    catch (e2) { console.error(e2); err.textContent = "Non sono riuscito a creare la lista. Controlla la connessione."; err.hidden = false; create.querySelector("button").disabled = false; }
  } },
    h("h2", { class: "big" }, "Crea la lista della tua famiglia"),
    h("label", null, "Nome della famiglia", famName),
    h("button", { class: "btn primary", type: "submit" }, "Crea la lista"),
  );
  const linkIn = h("input", { id: "invite", placeholder: "Incolla qui il link ricevuto" });
  const join = h("form", { class: "card", onsubmit: e => {
    e.preventDefault();
    const raw = linkIn.value.trim(); if (!raw) return;
    let fid = raw;
    try { fid = new URL(raw).searchParams.get("f") || raw; } catch {}
    openFamily(fid);
  } },
    h("h2", { class: "big" }, "Hai ricevuto un invito?"),
    h("p", { class: "hint" }, "Apri direttamente il link che ti hanno mandato, oppure incollalo qui."),
    linkIn,
    h("button", { class: "btn ghost", type: "submit" }, "Entra nella lista"),
  );
  setView("welcome",
    h("header", null, h("h1", null, "Spesa di Famiglia"), h("p", { class: "sub" }, "Una lista della spesa sola per tutta la casa.")),
    demoBanner(), err, create, join);
}

// ---------- Chi sei? ----------
function showWho() {
  if (!S.members.length) return showNewMember(true);
  const people = h("div", { class: "people" },
    [...S.members].sort((a, b) => a.name.localeCompare(b.name)).map(m =>
      h("button", { class: "person", type: "button", onclick: () => showPin(m) }, avatar(m, "lg"), h("span", null, m.name))));
  setView("who",
    h("header", null, h("h1", null, S.family.name), h("p", { class: "sub" }, "Chi sei?")),
    demoBanner(), people,
    h("button", { class: "btn ghost", type: "button", onclick: () => showNewMember(false) }, "Non ci sono: crea il mio profilo"));
}

function showPin(m) {
  const err = h("p", { class: "error", hidden: true });
  const pin = h("input", { id: "pin", type: "password", inputmode: "numeric", autocomplete: "current-password", maxlength: "4", pattern: "[0-9]{4}", required: true, placeholder: "••••" });
  const form = h("form", { class: "card", onsubmit: async e => {
    e.preventDefault();
    if ((await hashPin(m.salt, pin.value)) !== m.pin) { err.textContent = "PIN sbagliato. Riprova."; err.hidden = false; pin.value = ""; pin.focus(); return; }
    S.meId = m.id; ls.set("spesa:me:" + S.fid, m.id); showList();
  } },
    h("div", { style: "display:flex;align-items:center;gap:12px" }, avatar(m, "lg"), h("h2", { class: "big" }, "Ciao " + m.name)),
    h("label", null, "Il tuo PIN di 4 cifre", pin), err,
    h("button", { class: "btn primary", type: "submit" }, "Entra"),
    h("button", { class: "btn link", type: "button", onclick: showWho }, "Non sono io"));
  setView("pin", h("header", null, h("h1", null, S.family.name)), form);
  pin.focus();
}

function showNewMember(first) {
  const err = h("p", { class: "error", hidden: true });
  const name = h("input", { id: "member-name", maxlength: "24", required: true, placeholder: "es. Giovanni", autocomplete: "given-name" });
  const pin = h("input", { id: "new-pin", type: "password", inputmode: "numeric", autocomplete: "new-password", maxlength: "4", required: true, placeholder: "••••" });
  const pin2 = h("input", { id: "new-pin2", type: "password", inputmode: "numeric", autocomplete: "new-password", maxlength: "4", required: true, placeholder: "••••" });
  const fail = msg => { err.textContent = msg; err.hidden = false; };
  const form = h("form", { class: "card", onsubmit: async e => {
    e.preventDefault();
    const n = name.value.trim();
    if (!n) return fail("Scrivi il tuo nome.");
    if (S.members.some(m => keyOf(m.name) === keyOf(n))) return fail(`C'è già qualcuno che si chiama ${n}. Usa un nome diverso, per esempio con l'iniziale del cognome.`);
    if (!/^\d{4}$/.test(pin.value)) return fail("Il PIN deve essere di 4 cifre.");
    if (pin.value !== pin2.value) return fail("I due PIN non coincidono.");
    const id = S.store.newId(S.fid, "members");
    const salt = randomHex(8);
    const data = { name: n, color: COLORS[S.members.length % COLORS.length], salt, pin: await hashPin(salt, pin.value), at: Date.now() };
    form.querySelector("button[type=submit]").disabled = true;
    S.meId = id; ls.set("spesa:me:" + S.fid, id);
    S.members = [...S.members.filter(m => m.id !== id), { id, ...data }];
    write(S.store.set(S.fid, "members", id, data));
    showList();
  } },
    h("h2", { class: "big" }, first ? "Sei il primo: crea il tuo profilo" : "Crea il tuo profilo"),
    h("p", { class: "hint" }, "Il PIN serve solo a non confondere le persone di casa. Non usare un PIN importante, come quello del bancomat."),
    h("label", null, "Il tuo nome", name),
    h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:8px" }, h("label", null, "PIN (4 cifre)", pin), h("label", null, "Ripeti il PIN", pin2)),
    err,
    h("button", { class: "btn primary", type: "submit" }, "Crea profilo ed entra"),
    first ? null : h("button", { class: "btn link", type: "button", onclick: showWho }, "Torna indietro"));
  setView("new-member", h("header", null, h("h1", null, S.family.name)), demoBanner(), form);
  name.focus();
}

// ---------- La lista ----------
let els = {};
function showList() {
  const m = me();
  if (!m) return showWho();
  S.menuOpen = false;

  const nameIn = h("input", { id: "item-name", placeholder: "Cosa serve? es. latte", maxlength: "80", required: true, "aria-label": "Articolo", autocomplete: "off",
    oninput: () => { if (!S.catTouched) catSel.value = guessAisle(nameIn.value); renderPantry(); } });
  const qtyIn = h("input", { id: "item-qty", placeholder: "Quanto", maxlength: "20", "aria-label": "Quantità", autocomplete: "off" });
  const catSel = h("select", { id: "item-cat", "aria-label": "Reparto", onchange: () => { S.catTouched = true; } },
    AISLES.map(([k, emoji, label]) => h("option", { value: k }, `${emoji} ${label}`)));
  catSel.value = "altro";
  let pending = null;
  const preview = h("div", { class: "photo-preview", hidden: true });
  const setPending = photo => {
    pending = photo;
    preview.hidden = !photo;
    camBtn.classList.toggle("on", !!photo);
    if (photo) preview.replaceChildren(
      h("img", { src: photo.thumb, alt: "" }),
      h("span", null, "Foto allegata"),
      h("button", { class: "btn link", type: "button", onclick: () => setPending(null) }, "Togli foto"));
  };
  const camBtn = h("button", { class: "btn ghost cam", type: "button", html: ICON.camera, title: "Allega una foto",
    "aria-label": "Allega una foto all'articolo", onclick: () => pickPhoto(setPending) });
  const form = h("form", { class: "add", autocomplete: "off", onsubmit: e => {
    e.preventDefault();
    const n = nameIn.value.trim(); if (!n) return;
    addItem(n, qtyIn.value.trim(), catSel.value, pending);
    nameIn.value = ""; qtyIn.value = ""; catSel.value = "altro"; S.catTouched = false; setPending(null);
    renderPantry(); nameIn.focus();
  } }, nameIn, qtyIn, h("div", { class: "row" }, catSel, camBtn, h("button", { class: "btn primary", type: "submit" }, "Aggiungi")), preview);

  const menu = h("div", { class: "card menu", hidden: true });
  const meBtn = h("button", { class: "me-btn", type: "button", "aria-expanded": "false", onclick: () => {
    S.menuOpen = !S.menuOpen; menu.hidden = !S.menuOpen; meBtn.setAttribute("aria-expanded", String(S.menuOpen));
    if (S.menuOpen) renderMenu(menu);
  } }, avatar(m), h("span", null, m.name));

  els = {
    summary: h("p", { class: "sub" }),
    lists: h("div", { class: "lists" }),
    bar: h("div", { class: "bar", hidden: true }),
    pantry: h("section", { class: "pantry" }),
    nameIn,
  };
  const spesaPane = h("div", { class: "pane", id: "pane-spesa" }, form, els.lists, els.bar, els.pantry);
  const rimborsiPane = buildRimborsi();
  const tabBtn = (key, emoji, label) => h("button", { class: "tab", type: "button", role: "tab", id: "tab-" + key, "aria-controls": "pane-" + key,
    onclick: () => { S.tab = key; ls.set("spesa:tab", key); applyTab(); } },
    h("span", { "aria-hidden": "true" }, emoji), " " + label, h("span", { class: "badge", hidden: true }));
  els.tabs = h("div", { class: "tabs", role: "tablist" }, tabBtn("spesa", "🛒", "Spesa"), tabBtn("rimborsi", "💶", "Rimborsi"));
  els.panes = { spesa: spesaPane, rimborsi: rimborsiPane };
  setView("list",
    h("header", { class: "top" }, h("div", null, h("h1", null, S.family.name), els.summary), meBtn),
    menu, demoBanner(), els.tabs, spesaPane, rimborsiPane);
  applyTab();
  renderList();
  renderRimborsi();
}

function applyTab() {
  for (const key of ["spesa", "rimborsi"]) {
    const on = S.tab === key;
    els.panes[key].hidden = !on;
    const b = document.getElementById("tab-" + key);
    b.setAttribute("aria-selected", String(on)); b.classList.toggle("on", on);
  }
  updateSummary();
}

function updateSummary() {
  if (!els.summary) return;
  if (S.tab === "rimborsi") {
    const open = S.expenses.filter(e => !e.settled);
    els.summary.textContent = !S.expensesLoaded ? "Caricamento dei rimborsi…"
      : open.length ? plural(open.length, "rimborso in sospeso", "rimborsi in sospeso") : "Nessun rimborso in sospeso";
    return;
  }
  const active = S.items.filter(i => i.state !== "off");
  const toGet = active.filter(i => i.state !== "done").length;
  els.summary.textContent = !S.itemsLoaded ? "Caricamento della lista…"
    : toGet ? plural(toGet, "articolo da prendere", "articoli da prendere")
    : active.length ? "Tutto preso!" : "La lista è vuota";
}
function setBadge(key, n) {
  const b = document.querySelector("#tab-" + key + " .badge");
  if (b) { b.hidden = !n; b.textContent = n; }
}

// ---------- Rimborsi ----------
const euro = cents => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
function parseEuro(text) {
  let t = String(text).replace(/[€\s]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n < 1e7 ? Math.round(n * 100) : null;
}
const shortDate = ms => new Date(ms).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const debtorKey = e => e.owedBy || ("ext:" + keyOf(e.owedName || "?"));
const toWhom = name => (/^[aA]/.test(name) ? "ad " : "a ") + name;
const debtorName = e => e.owedBy ? nameOf(e.owedBy) : (e.owedName || "qualcuno");

let R = {};
function buildRimborsi() {
  const desc = h("input", { id: "exp-desc", placeholder: "es. spesa al mercato", maxlength: "60", required: true, autocomplete: "off" });
  const amount = h("input", { id: "exp-amount", placeholder: "0,00", inputmode: "decimal", required: true, autocomplete: "off" });
  const payer = h("select", { id: "exp-payer", onchange: () => fillDebtors() });
  const debtor = h("select", { id: "exp-debtor", onchange: () => { other.hidden = debtor.value !== "__other"; if (!other.hidden) other.focus(); } });
  const other = h("input", { id: "exp-other", placeholder: "Nome, es. Nonna", maxlength: "24", hidden: true, autocomplete: "off" });
  const note = h("textarea", { id: "exp-note", rows: "2", maxlength: "300", placeholder: "es. metà della spesa di sabato, scontrino in cucina" });
  const err = h("p", { class: "error", hidden: true });

  function fillPayers() {
    const cur = payer.value || S.meId;
    payer.replaceChildren(...S.members.map(m => h("option", { value: m.id }, m.id === S.meId ? `${m.name} (io)` : m.name)));
    payer.value = S.members.some(m => m.id === cur) ? cur : S.meId;
  }
  function fillDebtors() {
    const cur = debtor.value;
    const others = S.members.filter(m => m.id !== payer.value);
    debtor.replaceChildren(...others.map(m => h("option", { value: m.id }, m.id === S.meId ? `${m.name} (io)` : m.name)),
      h("option", { value: "__other" }, "Un'altra persona…"));
    debtor.value = [...debtor.options].some(o => o.value === cur) ? cur : (others[0] ? others[0].id : "__other");
    other.hidden = debtor.value !== "__other";
  }

  const form = h("form", { class: "card exp-form", autocomplete: "off", onsubmit: e => {
    e.preventDefault();
    const d = desc.value.trim(), cents = parseEuro(amount.value);
    const fail = m => { err.textContent = m; err.hidden = false; };
    if (!d) return fail("Scrivi per cosa è la spesa.");
    if (cents == null) return fail("Scrivi un importo valido, per esempio 12,50.");
    const ext = debtor.value === "__other";
    const extName = other.value.trim();
    if (ext && !extName) return fail("Scrivi il nome di chi deve rimborsare.");
    err.hidden = true;
    const id = S.store.newId(S.fid, "expenses");
    write(S.store.set(S.fid, "expenses", id, {
      desc: d, amount: cents, paidBy: payer.value, owedBy: ext ? null : debtor.value, owedName: ext ? extName : null,
      note: note.value.trim() || null,
      by: S.meId, at: Date.now(), settled: false, settledAt: null, settledBy: null, settleNote: null,
    }));
    desc.value = ""; amount.value = ""; other.value = ""; note.value = ""; payer.value = S.meId; debtor.value = ""; fillDebtors();
    toast(`Segnato: ${ext ? extName : nameOf(debtor.value)} deve ${euro(cents)}`);
  } },
    h("strong", null, "Segna una spesa da rimborsare"),
    h("div", { class: "exp-grid" },
      h("label", { class: "wide" }, "Per cosa", desc),
      h("label", null, "Importo (€)", amount),
      h("label", null, "Chi ha pagato", payer),
      h("label", { class: "wide" }, "Chi deve rimborsare", debtor, other),
      h("label", { class: "wide" }, "Nota (facoltativa)", note)),
    err,
    h("button", { class: "btn primary", type: "submit" }, "Segna da rimborsare"));

  R = { fillPayers, fillDebtors, balances: h("section", { class: "balances" }), open: h("section", { class: "exp-list" }), settled: h("section", { class: "exp-list" }) };
  return h("div", { class: "pane", id: "pane-rimborsi" }, R.balances, form, R.open, R.settled);
}

function renderRimborsi() {
  if (S.view !== "list" || !R.open) return;
  R.fillPayers(); R.fillDebtors();
  const open = S.expenses.filter(e => !e.settled).sort((a, b) => b.at - a.at);
  const done = S.expenses.filter(e => e.settled).sort((a, b) => (b.settledAt || 0) - (a.settledAt || 0)).slice(0, 30);
  setBadge("rimborsi", open.length);
  updateSummary();

  if (S.expensesBlocked) {
    R.balances.replaceChildren(h("div", { class: "notice" }, h("strong", null, "Rimborsi non ancora attivi"),
      "Va aggiornata la regola del database in Firebase (vedi istruzioni). La lista della spesa funziona normalmente."));
    R.open.replaceChildren(); R.settled.replaceChildren(); return;
  }

  // Saldi: per ogni coppia di persone, quanto deve l'una all'altra al netto
  const pair = {};
  for (const e of open) {
    const k = debtorKey(e) + "|" + e.paidBy;
    pair[k] = (pair[k] || 0) + e.amount;
  }
  const lines = [], seen = new Set();
  for (const k of Object.keys(pair)) {
    const [a, b] = k.split("|"); const id = [a, b].sort().join("|");
    if (seen.has(id)) continue; seen.add(id);
    const net = (pair[a + "|" + b] || 0) - (pair[b + "|" + a] || 0);
    if (net) lines.push(net > 0 ? { from: a, to: b, cents: net } : { from: b, to: a, cents: -net });
  }
  const extNames = {}; for (const e of open) if (!e.owedBy) extNames[debtorKey(e)] = e.owedName;
  const label = key => key.startsWith("ext:") ? (extNames[key] || "qualcuno") : nameOf(key);
  const sentence = l => l.from === S.meId ? `Devi ${euro(l.cents)} ${toWhom(label(l.to))}`
    : l.to === S.meId ? `${label(l.from)} ti deve ${euro(l.cents)}`
    : `${label(l.from)} deve ${euro(l.cents)} ${toWhom(label(l.to))}`;
  const mine = l => l.from === S.meId || l.to === S.meId;
  lines.sort((x, y) => (mine(y) - mine(x)) || y.cents - x.cents);
  R.balances.replaceChildren(...(lines.length ? [
    h("h3", { class: "sec-title" }, "Chi deve a chi"),
    h("ul", { class: "items balance-list" }, lines.map(l => h("li", { class: l.to === S.meId ? "plus" : l.from === S.meId ? "minus" : "" },
      avatar(memberOf(l.from) || { name: label(l.from) }), h("span", { class: "bal-text" }, sentence(l)))))] : []));

  R.open.replaceChildren(
    h("h3", { class: "sec-title" }, "Da rimborsare ", h("span", { class: "count" }, `· ${open.length}`)),
    open.length ? h("ul", { class: "items" }, open.map(expRow))
      : h("div", { class: "notice" }, h("strong", null, "Nessun rimborso in sospeso"), "Quando paghi qualcosa per qualcun altro, segnalo qui sopra."));

  R.settled.replaceChildren(...(done.length ? [
    h("details", { class: "settled" },
      h("summary", null, `Già rimborsati (${done.length === 30 ? "ultimi 30" : done.length})`),
      h("ul", { class: "items" }, done.map(expRow)))] : []));
}

function expRow(e) {
  const who = e.paidBy === S.meId ? `${debtorName(e)} ti deve`
    : e.owedBy === S.meId ? `Devi ${toWhom(nameOf(e.paidBy))}`
    : `${debtorName(e)} deve ${toWhom(nameOf(e.paidBy))}`;
  const meta = e.settled ? `rimborsato il ${shortDate(e.settledAt || e.at)}` : `segnato il ${shortDate(e.at)}`;
  const settling = S.settlingId === e.id && !e.settled;
  const noteLine = (label, text) => text ? h("p", { class: "exp-note" }, h("span", { class: "exp-note-label" }, label), text) : null;
  return h("li", { class: "exp" + (e.settled ? " done" : "") },
    avatar(memberOf(e.owedBy) || { name: e.owedName || "?" }),
    h("div", { class: "what" }, h("div", { class: "text" },
      h("span", { class: "name" }, e.desc), h("span", { class: "qty" }, euro(e.amount)),
      h("div", { class: "who" }, `${who} · ${meta}`),
      noteLine("Nota: ", e.note),
      noteLine("Nota sul rimborso: ", e.settleNote))),
    e.settled
      ? h("button", { class: "btn link", type: "button", onclick: () => reopenExpense(e) }, "Riapri")
      : h("button", { class: "btn ghost settle", type: "button", hidden: settling, onclick: () => { S.settlingId = e.id; S.settleDraft = ""; renderRimborsi(); document.getElementById("settle-note")?.focus(); },
          "aria-label": `Segna ${e.desc} come rimborsato` }, "Rimborsato"),
    h("button", { class: "icon-btn del", type: "button", html: ICON.bin, onclick: () => removeExpense(e), "aria-label": `Elimina ${e.desc}` }),
    settling ? h("form", { class: "settle-form", onsubmit: ev => { ev.preventDefault(); settleExpense(e, S.settleDraft.trim()); } },
      h("label", null, "Nota sul rimborso (facoltativa)",
        h("textarea", { id: "settle-note", rows: "2", maxlength: "300", placeholder: "es. dati in contanti, Satispay, bonifico…", value: S.settleDraft,
          oninput: ev => { S.settleDraft = ev.target.value; } })),
      h("div", { class: "row" },
        h("button", { class: "btn primary", type: "submit" }, "Conferma rimborso"),
        h("button", { class: "btn ghost", type: "button", onclick: () => { S.settlingId = null; renderRimborsi(); } }, "Annulla"))) : null);
}
const updExp = (id, patch) => write(S.store.update(S.fid, "expenses", id, patch));
function settleExpense(e, settleNote) {
  S.settlingId = null;
  updExp(e.id, { settled: true, settledAt: Date.now(), settledBy: S.meId, settleNote: settleNote || null });
  toast(`${e.desc}: rimborsato`, () => updExp(e.id, { settled: false, settledAt: null, settledBy: null, settleNote: null }));
}
function reopenExpense(e) {
  updExp(e.id, { settled: false, settledAt: null, settledBy: null, settleNote: null });
  toast(`${e.desc} di nuovo da rimborsare`, () => updExp(e.id, { settled: true, settledAt: e.settledAt || Date.now(), settledBy: e.settledBy || S.meId, settleNote: e.settleNote || null }));
}
function removeExpense(e) {
  const { id, ...data } = e;
  write(S.store.remove(S.fid, "expenses", id));
  toast(`${e.desc} eliminato`, () => write(S.store.set(S.fid, "expenses", id, data)));
}

function renderMenu(menu) {
  const link = location.origin + location.pathname + "?f=" + S.fid;
  const linkIn = h("input", { id: "invite-link", readonly: true, value: link, onfocus: e => e.target.select() });
  const copy = h("button", { class: "btn ghost", type: "button", onclick: async () => {
    try { await navigator.clipboard.writeText(link); copy.textContent = "Copiato"; }
    catch { linkIn.focus(); linkIn.select(); }
  } }, "Copia link");
  const share = navigator.share
    ? h("button", { class: "btn primary", type: "button", onclick: () => navigator.share({ title: "Spesa di Famiglia", text: `Entra nella lista della spesa di ${S.family.name}`, url: link }).catch(() => {}) }, "Invia link")
    : null;
  menu.replaceChildren(...[
    h("strong", null, "Invita i familiari"),
    h("p", { class: "hint" }, "Manda questo link agli altri: lo aprono, scrivono il loro nome e scelgono un PIN. Nessuna registrazione."),
    linkIn,
    h("div", { class: "row" }, share, copy),
    h("hr", { style: "border:0;border-top:1px solid var(--line);margin:4px 0;width:100%" }),
    h("button", { class: "btn ghost", type: "button", onclick: () => { ls.del("spesa:me:" + S.fid); S.meId = null; showWho(); } }, "Cambia persona"),
  ].filter(Boolean));
}

function renderList() {
  if (S.view !== "list" || !els.lists) return;
  const active = S.items.filter(i => i.state !== "off");
  const toGet = active.filter(i => i.state !== "done").length;
  const done = active.length - toGet;

  updateSummary();
  setBadge("spesa", toGet);

  // Lista attiva, per reparto
  const groups = {};
  for (const it of active) (groups[it.cat in AISLE_ORDER ? it.cat : "altro"] ||= []).push(it);
  const sections = AISLES.filter(([k]) => groups[k]).map(([k]) => {
    const g = groups[k].sort((a, b) => ((a.state === "done") - (b.state === "done")) || (a.at - b.at));
    return h("section", { class: "aisle" },
      h("h3", null, h("span", { class: "emoji", "aria-hidden": "true" }, AISLE_EMOJI[k]), AISLE_NAME[k], " ", h("span", { class: "count" }, `· ${g.filter(i => i.state !== "done").length}/${g.length}`)),
      h("ul", { class: "items" }, g.map(itemRow)));
  });
  if (!sections.length && S.itemsLoaded) {
    sections.push(h("div", { class: "notice" }, h("strong", null, "Niente da comprare, per ora"),
      "Scrivi un articolo qui sopra, oppure tocca un articolo in “Già comprati in passato” per rimetterlo in lista."));
  }
  els.lists.replaceChildren(...sections);

  // Fine spesa
  els.bar.hidden = !done;
  if (done) els.bar.replaceChildren(
    h("p", null, `${done} già ${done === 1 ? "preso" : "presi"}`),
    h("button", { class: "btn ghost", type: "button", onclick: finishShopping }, "Fine spesa: togli i presi"));

  renderPantry();
}

function itemRow(it) {
  const isDone = it.state === "done";
  const pid = isDone && it.doneBy ? it.doneBy : it.by;
  return h("li", { class: isDone ? "done" : "" },
    h("button", { class: "check", type: "button", html: ICON.check, onclick: () => toggleDone(it),
      "aria-label": isDone ? `Segna ${it.name} come da prendere` : `Segna ${it.name} come preso` }),
    h("div", { class: "what" },
      it.thumb ? h("button", { class: "thumb", type: "button", onclick: () => openPhoto(it), "aria-label": `Guarda la foto di ${it.name}` },
        h("img", { src: it.thumb, alt: "" })) : null,
      h("div", { class: "text" },
        h("span", { class: "name" }, it.name), it.qty ? h("span", { class: "qty" }, it.qty) : null,
        h("div", { class: "who" }, avatar(memberOf(pid), "sm"), isDone ? `preso da ${nameOf(it.doneBy)}` : `aggiunto da ${nameOf(it.by)}`))),
    h("button", { class: "icon-btn", type: "button", html: ICON.off, onclick: () => deselect(it),
      title: "Togli dalla lista (resta in Già comprati in passato)", "aria-label": `Togli ${it.name} dalla lista, resta in Già comprati in passato` }),
    h("button", { class: "icon-btn del", type: "button", html: ICON.bin, onclick: () => removeItem(it),
      title: "Elimina per sempre", "aria-label": `Elimina ${it.name} per sempre` }));
}

function renderPantry() {
  if (S.view !== "list" || !els.pantry) return;
  const off = S.items.filter(i => i.state === "off");
  const filter = keyOf(els.nameIn.value || "");
  const shown = off.filter(i => !filter || i.key.includes(filter))
    .sort((a, b) => (b.offAt || 0) - (a.offAt || 0) || a.name.localeCompare(b.name));

  const head = h("div", { class: "pantry-head" },
    h("h3", null, "Già comprati in passato ", h("span", { class: "count" }, `· ${off.length}`)),
    off.length ? h("button", { class: "btn link", type: "button", onclick: () => { S.editPantry = !S.editPantry; renderPantry(); } },
      S.editPantry ? "Fatto" : "Modifica") : null);

  let body;
  if (!off.length) {
    S.editPantry = false;
    body = h("p", { class: "hint" }, "Quando togli un articolo dalla lista con il pulsante ⊖ finisce qui: la prossima volta lo rimetti in lista con un tocco.");
  } else if (!shown.length) {
    body = h("p", { class: "hint" }, `Nessun articolo salvato contiene “${els.nameIn.value.trim()}”.`);
  } else {
    body = h("div", { class: "chips" }, shown.map(it =>
      h("button", { class: "chip" + (S.editPantry ? " editing" : ""), type: "button",
        "aria-label": S.editPantry ? `Elimina ${it.name} per sempre` : `Rimetti ${it.name} in lista`,
        onclick: () => S.editPantry ? removeItem(it) : reactivate(it) },
        h("span", { class: "plus", "aria-hidden": "true" }, S.editPantry ? "×" : "+"), h("span", null, it.name),
        it.thumb ? h("img", { class: "chip-thumb", src: it.thumb, alt: "" })
          : h("span", { class: "emoji", "aria-hidden": "true" }, AISLE_EMOJI[it.cat] || AISLE_EMOJI.altro))));
  }
  els.pantry.replaceChildren(...[head, body,
    S.editPantry ? h("p", { class: "hint" }, "Tocca un articolo per eliminarlo per sempre.") : null].filter(Boolean));
}

// ---------- Azioni ----------
const upd = (id, patch) => write(S.store.update(S.fid, "items", id, patch));

function addItem(name, qty, cat, photo) {
  const key = keyOf(name);
  const ex = S.items.find(i => i.key === key);
  if (ex) {
    if (photo) { upd(ex.id, { thumb: photo.thumb }); savePhoto(ex.id, photo); }
    if (ex.state === "todo") return toast(photo ? `Foto aggiunta a ${ex.name}` : `${ex.name} è già in lista`);
    upd(ex.id, { state: "todo", qty: qty || ex.qty || "", cat: S.catTouched ? cat : ex.cat, by: S.meId, at: Date.now(), doneBy: null });
    return toast(`${ex.name} rimesso in lista`);
  }
  const id = S.store.newId(S.fid, "items");
  write(S.store.set(S.fid, "items", id, { name, key, qty, cat, state: "todo", by: S.meId, at: Date.now(), doneBy: null, thumb: photo ? photo.thumb : null }));
  if (photo) savePhoto(id, photo);
}
function toggleDone(it) {
  upd(it.id, it.state === "done" ? { state: "todo", doneBy: null } : { state: "done", doneBy: S.meId });
}
function deselect(it) {
  const prev = { state: it.state, doneBy: it.doneBy || null };
  upd(it.id, { state: "off", doneBy: null, offAt: Date.now() });
  toast(`${it.name} spostato in Già comprati in passato`, () => upd(it.id, prev));
}
function reactivate(it) {
  upd(it.id, { state: "todo", by: S.meId, at: Date.now(), doneBy: null });
}
function removeItem(it) {
  const { id, ...data } = it;
  write(S.store.remove(S.fid, "items", id));
  // La foto grande si cancella solo se non premi "Annulla".
  const photoTimer = it.thumb ? setTimeout(() => write(S.store.remove(S.fid, "photos", id)), 7000) : null;
  toast(`${it.name} eliminato`, () => { clearTimeout(photoTimer); write(S.store.set(S.fid, "items", id, data)); });
}
function finishShopping() {
  const done = S.items.filter(i => i.state === "done");
  const now = Date.now();
  done.forEach(i => upd(i.id, { state: "off", offAt: now }));
  toast(`${plural(done.length, "articolo spostato", "articoli spostati")} in Già comprati in passato`,
    () => done.forEach(i => upd(i.id, { state: "done", doneBy: i.doneBy || null })));
}

// ---------- Senza internet ----------
function updateOnline() { $("#offline").hidden = navigator.onLine !== false; }
addEventListener("online", updateOnline);
addEventListener("offline", updateOnline);
updateOnline();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(e => console.warn("Service worker non registrato", e));
}

boot();
