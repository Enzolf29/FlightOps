const logoModules = import.meta.glob('../assets/logos/*.png', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>

const logosByFilename = new Map<string, string>()
for (const path in logoModules) {
  const filename = path.split('/').pop()!
  logosByFilename.set(filename, logoModules[path])
}

export function getCompanyLogoUrl(logoFilename: string): string | undefined {
  return logosByFilename.get(logoFilename)
}
