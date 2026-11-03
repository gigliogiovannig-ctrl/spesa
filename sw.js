// Service worker: permette di aprire l'app anche senza internet.
//
// - File dell'app (pagina, script, stile, icone): prima prova la rete, così
//   gli aggiornamenti arrivano subito; se la rete non risponde entro pochi
//   secondi, usa la copia salvata sul telefono.
// - Librerie Firebase e caratteri (indirizzi con versione, non cambiano mai):
//   usa la copia salvata, e la scarica solo la prima volta.
// - Il database (Firestore) non passa di qui: lo gestisce Firebase, che tiene
//   una copia della lista sul telefono e invia le modifiche quando torna la rete.

const CACHE = "spesa-v1";
const APP_FILES = [
  "./", "./index.html", "./app.js", "./style.css", "./firebase-config.js",
  "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png",
];
const FIREBASE_SDK = ["firebase-app.js", "firebase-auth.js", "firebase-firestore.js"]
  .map(f => "https://www.gstatic.com/firebasejs/10.12.2/" + f);
const LONG_LIVED_HOSTS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_FILES);
    // Le librerie Firebase: se una non si scarica, l'installazione va avanti lo stesso.
    await Promise.all(FIREBASE_SDK.map(u => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (LONG_LIVED_HOSTS.includes(url.hostname) && !url.pathname.includes("/__/")) {
    event.respondWith(cacheFirst(req));
  }
  // Tutto il resto (database, accesso) va direttamente in rete.
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const fromNetwork = fetch(req).then(res => {
    if (res.ok) cache.put(req.mode === "navigate" ? "./index.html" : req, res.clone());
    return res;
  });
  const timeout = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  try {
    const res = await Promise.race([fromNetwork, timeout]);
    if (res) return res;
  } catch {}
  // Rete assente o troppo lenta: copia salvata (la pagina vale con qualsiasi ?f=...).
  const cached = await (req.mode === "navigate"
    ? cache.match("./index.html")
    : cache.match(req, { ignoreSearch: true }));
  if (cached) return cached;
  return fromNetwork; // niente in memoria: aspetta comunque la rete
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}
