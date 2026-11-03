// Offline cache for Level Up (public). Bump VERSION when any app file changes (build.py does this from src/VERSION).
// The personal app lives on the same origin (fernbuilds-labs.github.io), and the Cache API is shared per origin,
// so this worker only ever touches caches that start with PREFIX, and it re-saves itself if its cache goes missing.
const PREFIX = "levelup-public-";
const VERSION = "levelup-public-v2";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];
const precache = () => caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))));
self.addEventListener("install", e => {
  // cache:"reload" skips the browser's HTTP cache so a new version never installs old files
  e.waitUntil(precache().then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return;
  if (url.origin === location.origin && !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (req.mode === "navigate") {
    // Open instantly from the saved copy (works with no or bad internet).
    // If the copy is gone (for example another app on this origin cleared it), load from the network and save everything again.
    e.respondWith(caches.open(VERSION).then(c => c.match("index.html").then(hit => {
      if (hit) return hit;
      e.waitUntil(precache().catch(() => {}));
      return fetch(req).then(r => { if (r && r.ok) c.put("index.html", r.clone()); return r; });
    })));
    return;
  }
  e.respondWith(caches.open(VERSION).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone());
    return r;
  }))));
});
