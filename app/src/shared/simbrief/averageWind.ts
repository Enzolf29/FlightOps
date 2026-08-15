export interface Wind {
  dirDegrees: number
  speedKt: number
}

/**
 * Moyenne vectorielle (pas arithmétique) d'un ensemble de vents — la direction est une grandeur
 * circulaire, moyenner 350° et 10° arithmétiquement donnerait 180° au lieu de ~0°.
 */
export function averageWind(winds: Wind[]): Wind | null {
  if (winds.length === 0) return null

  let sumU = 0
  let sumV = 0
  for (const { dirDegrees, speedKt } of winds) {
    const rad = (dirDegrees * Math.PI) / 180
    sumU += speedKt * Math.sin(rad)
    sumV += speedKt * Math.cos(rad)
  }
  const avgU = sumU / winds.length
  const avgV = sumV / winds.length

  const speedKt = Math.sqrt(avgU * avgU + avgV * avgV)
  const dirDegrees = (Math.atan2(avgU, avgV) * 180) / Math.PI
  const normalizedDir = (dirDegrees + 360) % 360

  return { dirDegrees: normalizedDir, speedKt }
}
