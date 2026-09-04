export const TABLET_MANIFEST = JSON.stringify({
  name: 'FlightOps Tablette',
  short_name: 'FlightOps',
  description: 'Compagnon local de suivi de vol FlightOps pour MSFS 2024.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  background_color: '#070b14',
  theme_color: '#0a1020',
  icons: [
    { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
  ]
})

export const TABLET_APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#397cff"/><stop offset="1" stop-color="#6ca8ff"/></linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="#0a1020"/>
  <rect x="38" y="38" width="436" height="436" rx="94" fill="url(#b)"/>
  <path fill="#fff" d="M100 271 410 112c13-7 27 6 21 20L290 430c-7 15-29 11-31-5l-14-112-112-14c-16-2-20-24-5-31l-28-7Zm70 8 91 11 86-102-102 86-75 5Z"/>
</svg>`

/** Le cache ne concerne que la coque visuelle. Les données de vol restent toujours lues sur le PC. */
export const TABLET_SERVICE_WORKER = `
const CACHE = 'flightops-tablet-v2';
const SHELL = ['/', '/manifest.webmanifest', '/app-icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match('/'))));
});
`
