import { describe, expect, it } from 'vitest'
import {
  TABLET_APP_ICON_PNG_192,
  TABLET_APP_ICON_PNG_512,
  TABLET_MANIFEST,
  TABLET_SERVICE_WORKER
} from './tabletPwa'
import { TABLET_PAGE_HTML } from './tabletPage'

function pngDimensions(image: Buffer): [number, number] {
  expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  return [image.readUInt32BE(16), image.readUInt32BE(20)]
}

describe('tablet PWA assets', () => {
  it('declares a standalone app with the two raster icon sizes Chromium requires', () => {
    const manifest = JSON.parse(TABLET_MANIFEST) as {
      display: string
      id: string
      icons: Array<{ sizes: string }>
    }
    expect(manifest.display).toBe('standalone')
    expect(manifest.id).toBe('/')
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
  })

  it('generates valid PNG headers at the declared sizes', () => {
    expect(pngDimensions(TABLET_APP_ICON_PNG_192)).toEqual([192, 192])
    expect(pngDimensions(TABLET_APP_ICON_PNG_512)).toEqual([512, 512])
  })

  it('provides an application-shell service worker', () => {
    expect(TABLET_SERVICE_WORKER).toContain("self.addEventListener('install'")
    expect(TABLET_SERVICE_WORKER).toContain("self.addEventListener('fetch'")
  })

  it('renders a real geographic map with the planned route and flown track', () => {
    expect(TABLET_PAGE_HTML).toContain('https://tile.openstreetmap.org/')
    expect(TABLET_PAGE_HTML).toContain('© OpenStreetMap')
    expect(TABLET_PAGE_HTML).toContain('class="map-airport"')
    expect(TABLET_PAGE_HTML).toContain('stroke="#397cff"')
  })

  it('keeps the flight information app split into the six EFB panels', () => {
    expect(TABLET_PAGE_HTML).toContain('id="flightops-sheet"')
    expect(TABLET_PAGE_HTML).toContain('id="flightops-flight"')
    expect(TABLET_PAGE_HTML).toContain('id="flightops-plan"')
    expect(TABLET_PAGE_HTML).toContain('id="flightops-load"')
    expect(TABLET_PAGE_HTML).toContain('id="flightops-origin"')
    expect(TABLET_PAGE_HTML).toContain('id="flightops-destination"')
    expect(TABLET_PAGE_HTML).toContain('id="flightops-routing"')
  })

  it('shows live progress and refreshable online weather in the EFB views', () => {
    expect(TABLET_PAGE_HTML).toContain('class="dash-progress-aircraft"')
    expect(TABLET_PAGE_HTML).toContain('ETA estimée')
    expect(TABLET_PAGE_HTML).toContain('data-ops-refresh=')
    expect(TABLET_PAGE_HTML).toContain('data-ops-network=')
    expect(TABLET_PAGE_HTML).toContain('ATIS EN LIGNE')
  })

  it('uses a combined weather app and a flight list with popup briefings', () => {
    expect(TABLET_PAGE_HTML).toContain('id="weather-atis-result"')
    expect(TABLET_PAGE_HTML).toContain('data-weather-atis-network="vatsim"')
    expect(TABLET_PAGE_HTML).toContain('id="tablet-flight-list"')
    expect(TABLET_PAGE_HTML).toContain('data-flight-briefing=')
    expect(TABLET_PAGE_HTML).toContain("reste '+remaining")
    expect(TABLET_PAGE_HTML).not.toContain('id="calendar-week"')
  })

  it('keeps the embedded tablet application script syntactically valid', () => {
    const script = TABLET_PAGE_HTML.match(/<script>([\s\S]*)<\/script>/)?.[1]
    expect(script).toBeTruthy()
    expect(() => new Function(script!)).not.toThrow()
  })
})
