export type BundledAnnouncementVariant = 'any' | 'day' | 'night'

export interface ParsedAnnouncementFilename {
  /** Identifiant du type d'annonce (voir CABIN_ANNOUNCEMENT_TYPES), null si le nom n'est pas reconnu. */
  type: string | null
  variant: BundledAnnouncementVariant
  /** Numéro de variante donné par le nom ("[2]" ou suffixe "Welcome2"), null s'il n'y en a pas. */
  index: number | null
}

/**
 * Noms de fichiers rencontrés dans les packs d'annonces fournis, une fois normalisés (minuscules,
 * sans espace ni ponctuation). Les fautes de frappe présentes dans certains packs ("Bording",
 * "Creaw") sont volontairement acceptées plutôt que de renommer les fichiers sources.
 */
const TYPE_ALIASES: Record<string, string> = {
  boardingmusic: 'boarding_music',
  boardingwelcome: 'boarding_welcome',
  bordingwelcome: 'boarding_welcome',
  boardingcomplete: 'boarding_complete',
  armdoor: 'arm_doors',
  armdoors: 'arm_doors',
  presafetybriefing: 'presafety_briefing',
  safetybriefing: 'safety_briefing',
  cabindimtakeoff: 'cabin_dim_takeoff',
  cabindim: 'cabin_dim_takeoff',
  crewseattakeoff: 'crew_seat_takeoff',
  crewseatstakeoff: 'crew_seat_takeoff',
  creawseattakeoff: 'crew_seat_takeoff',
  aftertakeoff: 'after_takeoff_9000',
  descentseatbelt: 'descent_seatbelt',
  descentseatbelts: 'descent_seatbelt',
  crewseatlanding: 'crew_seat_landing',
  crewseatslanding: 'crew_seat_landing',
  afterlanding: 'after_landing',
  disarmdoor: 'disarm_doors',
  disarmdoors: 'disarm_doors',
  disembarkstarted: 'disembark_started'
}

const DAY_TAGS = new Set(['afternoon', 'day', 'morning'])
const NIGHT_TAGS = new Set(['evening', 'night'])

/**
 * Lit un nom de fichier d'annonce : "Type", "Type[1]", "Type[Afternoon][2]", "Type2"... Les balises
 * entre crochets donnent la période ([Morning]/[Afternoon] = jour, [Evening]/[Night] = nuit) et/ou le numéro de variante.
 */
export function parseAnnouncementFilename(filename: string): ParsedAnnouncementFilename {
  const withoutExtension = filename.replace(/\.[^.]+$/, '')
  let variant: BundledAnnouncementVariant = 'any'
  let index: number | null = null

  const tagPattern = /\[([^\]]*)\]/g
  for (const match of withoutExtension.matchAll(tagPattern)) {
    const tag = match[1].trim().toLowerCase()
    if (/^\d+$/.test(tag)) index = Number(tag)
    else if (DAY_TAGS.has(tag)) variant = 'day'
    else if (NIGHT_TAGS.has(tag)) variant = 'night'
  }

  let base = withoutExtension.replace(tagPattern, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const trailingNumber = /^(.*?)(\d+)$/.exec(base)
  if (trailingNumber && trailingNumber[1]) {
    base = trailingNumber[1]
    if (index === null) index = Number(trailingNumber[2])
  }

  const type = TYPE_ALIASES[base] ?? null
  // L'extinction des lumières avant le décollage n'a de sens que de nuit, balisée ou non.
  if (type === 'cabin_dim_takeoff') variant = 'night'

  return { type, variant, index }
}
