import { create } from 'zustand'
import type { CabinAnnouncementType } from '@shared/types/cabinAnnouncements'
import type { CabinLoadsheetSnapshot } from '@shared/types/loadsheet'

export type CabinPlaybackOrigin = 'automatic' | 'manual'

export interface CabinActivePlayback {
  type: CabinAnnouncementType
  origin: CabinPlaybackOrigin
}

export interface DetectedCabinCompany {
  id: number
  icaoCode: string
  displayName: string
  logoFilename: string
}

interface CabinAnnouncementState {
  company: DetectedCabinCompany | null
  flightId: number | null
  simconnectConnected: boolean
  automationReady: boolean
  gsxDetected: boolean
  activeVoice: CabinActivePlayback | null
  activeMusic: CabinActivePlayback | null
  queuedTypes: CabinAnnouncementType[]
  boardingCompleted: boolean
  finalLoadsheet: CabinLoadsheetSnapshot | null
  play: (type: CabinAnnouncementType) => void
  stop: (type: CabinAnnouncementType) => void
  stopAll: () => void
  registerControls: (controls: {
    play: (type: CabinAnnouncementType) => void
    stop: (type: CabinAnnouncementType) => void
    stopAll: () => void
  }) => void
  publish: (status: Partial<Pick<CabinAnnouncementState,
    'company' | 'flightId' | 'simconnectConnected' | 'automationReady' | 'gsxDetected' | 'activeVoice' | 'activeMusic' | 'queuedTypes' |
    'boardingCompleted' | 'finalLoadsheet'
  >>) => void
}

const noOp = () => undefined

export const useCabinAnnouncementStore = create<CabinAnnouncementState>((set) => ({
  company: null,
  flightId: null,
  simconnectConnected: false,
  automationReady: false,
  gsxDetected: false,
  activeVoice: null,
  activeMusic: null,
  queuedTypes: [],
  boardingCompleted: false,
  finalLoadsheet: null,
  play: noOp,
  stop: noOp,
  stopAll: noOp,
  registerControls: (controls) => set(controls),
  publish: (status) => set(status)
}))
