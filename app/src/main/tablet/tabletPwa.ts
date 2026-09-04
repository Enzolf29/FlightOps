import { deflateSync } from 'zlib'

export const TABLET_MANIFEST = JSON.stringify({
  name: 'FlightOps Tablette',
  short_name: 'FlightOps',
  description: 'Compagnon local de suivi de vol FlightOps pour MSFS 2024.',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  background_color: '#070b14',
  theme_color: '#0a1020',
  icons: [
    { src: '/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
  ]
})

export const TABLET_APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#397cff"/><stop offset="1" stop-color="#6ca8ff"/></linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="#0a1020"/>
  <rect x="38" y="38" width="436" height="436" rx="94" fill="url(#b)"/>
  <path fill="#fff" d="M100 271 410 112c13-7 27 6 21 20L290 430c-7 15-29 11-31-5l-14-112-112-14c-16-2-20-24-5-31l-28-7Zm70 8 91 11 86-102-102 86-75 5Z"/>
</svg>`

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}

function insidePolygon(x: number, y: number, points: Array<[number, number]>): boolean {
  let inside = false
  for (let current = 0, previous = points.length - 1; current < points.length; previous = current++) {
    const [xi, yi] = points[current]
    const [xj, yj] = points[previous]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Icône PNG générée sans dépendance native, aux deux tailles exigées par Chromium. */
function createAppIconPng(size: number): Buffer {
  const rowBytes = size * 4 + 1
  const pixels = Buffer.alloc(rowBytes * size)
  const plane: Array<[number, number]> = [[0.16, 0.53], [0.84, 0.2], [0.57, 0.84], [0.49, 0.59]]
  const wing: Array<[number, number]> = [[0.16, 0.53], [0.49, 0.59], [0.7, 0.36], [0.43, 0.55]]
  const radius = size * 0.2
  for (let y = 0; y < size; y += 1) {
    const row = y * rowBytes
    pixels[row] = 0
    for (let x = 0; x < size; x += 1) {
      const nx = x / size
      const ny = y / size
      const edgeX = Math.max(radius - x, 0, x - (size - radius))
      const edgeY = Math.max(radius - y, 0, y - (size - radius))
      const inRoundedSquare = edgeX * edgeX + edgeY * edgeY <= radius * radius
      const white = insidePolygon(nx, ny, plane)
      const cut = insidePolygon(nx, ny, wing)
      const offset = row + 1 + x * 4
      if (white && !cut) {
        pixels[offset] = 255; pixels[offset + 1] = 255; pixels[offset + 2] = 255; pixels[offset + 3] = 255
      } else if (inRoundedSquare) {
        pixels[offset] = Math.round(55 + 48 * ny); pixels[offset + 1] = Math.round(124 + 40 * nx); pixels[offset + 2] = 255; pixels[offset + 3] = 255
      } else {
        pixels[offset] = 10; pixels[offset + 1] = 16; pixels[offset + 2] = 32; pixels[offset + 3] = 255
      }
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4)
  header[8] = 8; header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

export const TABLET_APP_ICON_PNG_192 = createAppIconPng(192)
export const TABLET_APP_ICON_PNG_512 = createAppIconPng(512)

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character] ?? character)
}

export function buildTabletSetupHtml(secureUrls: string[], fingerprint: string): string {
  const links = secureUrls.map((url) => `<a class="app" href="${escapeHtml(url)}">Ouvrir FlightOps en HTTPS<br><code>${escapeHtml(url)}</code></a>`).join('')
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0a1020"><title>Installer FlightOps Tablette</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:24px;background:radial-gradient(circle at top,#19396a,#070b14 52%);color:#f7f9fc;font-family:Inter,system-ui,sans-serif}.wrap{width:min(720px,100%);margin:auto}.brand{display:flex;align-items:center;gap:12px;margin-bottom:22px;font-size:23px;font-weight:900}.mark{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:#4d8bff}.card{margin-bottom:14px;padding:20px;border:1px solid #26344a;border-radius:18px;background:#101725}.step{color:#88afff;font-size:12px;font-weight:900;text-transform:uppercase}.card h2{margin:7px 0 9px;font-size:19px}.card p,.card li{color:#9fb0c9;line-height:1.55}.button,.app{display:block;margin-top:12px;padding:14px;border:0;border-radius:12px;background:#4d8bff;color:white;text-align:center;text-decoration:none;font-weight:850}.app{background:#182235;border:1px solid #39557c}.app code{color:#9ab9f8;font-size:11px}.fingerprint{display:block;overflow-wrap:anywhere;padding:9px;border-radius:8px;background:#080e19;color:#9fb0c9;font-size:9px}.warning{color:#ffca75!important}.done{border-color:#27d69b55}.done .step{color:#27d69b}</style></head><body><main class="wrap"><div class="brand"><span class="mark">✈</span> FlightOps Tablette</div>
  <section class="card"><div class="step">Étape 1 · une seule fois</div><h2>Installer le certificat FlightOps</h2><p>Ce certificat permet à votre tablette de reconnaître le serveur HTTPS privé de votre PC. Il ne donne accès à aucune donnée Internet.</p><a class="button" href="/flightops-local-ca.cer" download>Installer le certificat local</a><p class="warning"><b>iPad / iPhone :</b> après le téléchargement, ouvrez Réglages → Général → VPN et gestion de l’appareil pour installer le profil, puis Réglages → Général → Informations → Réglages des certificats pour activer la confiance totale.</p><p><b>Android :</b> ouvrez le fichier téléchargé, choisissez « Certificat CA » puis confirmez son installation.</p><small class="fingerprint">SHA-256 : ${escapeHtml(fingerprint)}</small></section>
  <section class="card"><div class="step">Étape 2</div><h2>Ouvrir l’application sécurisée</h2><p>Une fois le certificat approuvé, ouvrez l’adresse HTTPS ci-dessous. Aucun avertissement de sécurité ne doit apparaître.</p>${links}</section>
  <section class="card done"><div class="step">Étape 3</div><h2>Installer la vraie Web App</h2><p>Dans FlightOps, touchez « Installer l’app ». Android affichera l’installation de l’application. Sur iPad, utilisez Partager → Sur l’écran d’accueil → Ouvrir comme app web.</p></section></main></body></html>`
}

/** Le cache ne concerne que la coque visuelle. Les données de vol restent toujours lues sur le PC. */
export const TABLET_SERVICE_WORKER = `
const CACHE = 'flightops-tablet-v3';
const SHELL = ['/', '/manifest.webmanifest', '/app-icon-192.png', '/app-icon-512.png', '/app-icon.svg'];
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
