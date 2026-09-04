import { net, protocol } from 'electron'

export const SIMBRIEF_PDF_SCHEME = 'flightops-pdf'

function isAllowedSimbriefUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    const hostname = url.hostname.toLowerCase()
    return url.protocol === 'https:' && (hostname === 'simbrief.com' || hostname.endsWith('.simbrief.com'))
  } catch {
    return false
  }
}

export function registerSimbriefPdfScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SIMBRIEF_PDF_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

/**
 * Sert le briefing distant à Chromium comme un vrai PDF intégré. On supprime volontairement
 * Content-Disposition: attachment : SimBrief peut sinon forcer le téléchargement au lieu de
 * laisser le lecteur PDF d'Electron l'afficher dans la popup.
 */
export function registerSimbriefPdfProtocol(): void {
  protocol.handle(SIMBRIEF_PDF_SCHEME, async (request) => {
    const requestUrl = new URL(request.url)
    const source = requestUrl.searchParams.get('source') ?? ''
    if (requestUrl.hostname !== 'briefing' || requestUrl.pathname !== '/view' || !isAllowedSimbriefUrl(source)) {
      return new Response('Briefing SimBrief invalide', { status: 400 })
    }

    try {
      const upstream = await net.fetch(source)
      if (!upstream.ok) return new Response('Briefing SimBrief indisponible', { status: upstream.status })
      const headers = new Headers(upstream.headers)
      headers.set('Content-Type', 'application/pdf')
      headers.delete('Content-Disposition')
      return new Response(upstream.body, { status: upstream.status, headers })
    } catch {
      return new Response('Impossible de charger le briefing SimBrief', { status: 502 })
    }
  })
}
