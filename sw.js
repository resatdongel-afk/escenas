// Escenas de Barrio phone app. Page: network first (updates arrive), cache when offline.
// Audio: from the "eb-audio" cache when saved (with byte ranges for the player), else from the network.
const SHELL = "eb-shell-20261118204211";
const FILES = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("eb-shell-") && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function audio(req){
  const url = req.url.split("?")[0];
  const hit = await caches.match(url, {ignoreVary: true});
  if (!hit) return fetch(req);
  const blob = await hit.blob(), size = blob.size, range = req.headers.get("range");
  const base = {"Content-Type": "audio/mpeg", "Accept-Ranges": "bytes"};
  if (!range) return new Response(blob, {status: 200, headers: {...base, "Content-Length": String(size)}});
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let s, e;
  if (m[1] === "" && m[2]) { s = Math.max(0, size - +m[2]); e = size - 1; }
  else { s = +m[1] || 0; e = m[2] ? Math.min(+m[2], size - 1) : size - 1; }
  return new Response(blob.slice(s, e + 1), {status: 206, headers: {...base, "Content-Range": `bytes ${s}-${e}/${size}`, "Content-Length": String(e - s + 1)}});
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (/\.mp3(\?|$)/.test(req.url)) { e.respondWith(audio(req)); return; }
  e.respondWith(fetch(req).then(r => {
    if (r.ok && r.status === 200) { const c = r.clone(); caches.open(SHELL).then(ca => ca.put(req, c)); }
    return r;
  }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match("index.html"))));
});
