export const CABIN_ANNOUNCEMENT_TYPES = [
  'boarding_music',
  'boarding_welcome',
  'boarding_complete',
  'arm_doors',
  'presafety_briefing',
  'safety_briefing',
  'cabin_dim_takeoff',
  'crew_seat_takeoff',
  'after_takeoff_9000',
  'descent_seatbelt',
  'crew_seat_landing',
  'after_landing',
  'disarm_doors',
  'disembark_started'
] as const

export type CabinAnnouncementType = (typeof CABIN_ANNOUNCEMENT_TYPES)[number]

export interface CabinAnnouncementDefinition {
  type: CabinAnnouncementType
  label: string
  trigger: string
  icon: string
}

export const CABIN_ANNOUNCEMENT_DEFINITIONS: CabinAnnouncementDefinition[] = [
  { type: 'boarding_music', label: 'Musique d’embarquement', trigger: 'En boucle pendant l’embarquement GSX', icon: '♫' },
  { type: 'boarding_welcome', label: 'Boarding Welcome', trigger: 'Au début, puis toutes les 5 minutes pendant l’embarquement', icon: '👋' },
  { type: 'boarding_complete', label: 'Boarding Complete', trigger: 'Lorsque GSX termine l’embarquement', icon: '✓' },
  { type: 'arm_doors', label: 'Arm Doors', trigger: 'Au démarrage du premier moteur, avant les briefings', icon: '🔒' },
  { type: 'presafety_briefing', label: 'Presafety Briefing', trigger: 'Au démarrage du premier moteur', icon: '🎙' },
  { type: 'safety_briefing', label: 'Safety Briefing', trigger: 'À la suite du Presafety Briefing', icon: '🦺' },
  { type: 'cabin_dim_takeoff', label: 'Cabin Dim Takeoff', trigger: 'Après le Safety Briefing, au crépuscule ou de nuit', icon: '☾' },
  { type: 'crew_seat_takeoff', label: 'Crew Seat Takeoff', trigger: 'Après le Safety Briefing ou le Cabin Dim', icon: '💺' },
  { type: 'after_takeoff_9000', label: 'Après décollage — 9 000 ft', trigger: 'Au premier passage de 9 000 ft en montée', icon: '↗' },
  { type: 'descent_seatbelt', label: 'Descent Seat Belt', trigger: 'Au début confirmé de la descente', icon: '↘' },
  { type: 'crew_seat_landing', label: 'Crew Seat Landing', trigger: 'À 5 000 ft AGL pendant la descente', icon: '💺' },
  { type: 'after_landing', label: 'Après atterrissage', trigger: 'Après le posé, feux d’atterrissage éteints ou volets rentrés', icon: '🛬' },
  { type: 'disarm_doors', label: 'Disarm Doors', trigger: 'Après le posé, à l’extinction du beacon ou des feux de roulage', icon: '🔓' },
  { type: 'disembark_started', label: 'Disembark Started', trigger: 'À la coupure du dernier moteur après l’atterrissage', icon: '🚪' }
]

export interface CabinAnnouncementFile {
  companyId: number
  type: CabinAnnouncementType
  originalFilename: string
  updatedAt: string
  audioUrl: string
  /** Volume propre à ce fichier, de 0 (muet) à 1 (100 %). */
  volume: number
}

export function isCabinAnnouncementType(value: string): value is CabinAnnouncementType {
  return (CABIN_ANNOUNCEMENT_TYPES as readonly string[]).includes(value)
}
