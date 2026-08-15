import { getCompanyLogoUrl } from '@renderer/lib/logos'

interface CompanyLogoProps {
  logoFilename: string
  icaoCode: string
  width?: number
  height?: number
}

export function CompanyLogo({ logoFilename, icaoCode, width = 96, height = 56 }: CompanyLogoProps) {
  const src = getCompanyLogoUrl(logoFilename)

  if (!src) {
    return (
      <div className="company-logo company-logo-fallback" style={{ width, height }}>
        {icaoCode}
      </div>
    )
  }

  return <img className="company-logo" src={src} alt={icaoCode} title={icaoCode} style={{ width, height }} />
}
