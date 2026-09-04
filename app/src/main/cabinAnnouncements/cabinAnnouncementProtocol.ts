import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { resolveCabinAnnouncementPath } from './cabinAnnouncementFiles'

export const CABIN_AUDIO_SCHEME = 'flightops-audio'

export function registerCabinAnnouncementScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CABIN_AUDIO_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

export function registerCabinAnnouncementProtocol(): void {
  protocol.handle(CABIN_AUDIO_SCHEME, (request) => {
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    if (url.hostname !== 'library' || parts.length !== 2) {
      return new Response('Annonce introuvable', { status: 404 })
    }
    const filePath = resolveCabinAnnouncementPath(parts[0], parts[1])
    if (!filePath) return new Response('Annonce introuvable', { status: 404 })
    return net.fetch(pathToFileURL(filePath).toString())
  })
}
