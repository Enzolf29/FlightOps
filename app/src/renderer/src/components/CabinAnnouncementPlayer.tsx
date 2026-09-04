import { useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useArmedFlightId } from '@renderer/hooks/useArmedFlight'
import { useSimConnectStatus, useSimTelemetry } from '@renderer/hooks/useSimConnect'
import { useCabinAnnouncementStore, type CabinPlaybackOrigin } from '@renderer/stores/cabinAnnouncementStore'
import type { CabinAnnouncementFile, CabinAnnouncementType } from '@shared/types/cabinAnnouncements'
import {
  evaluateCabinAnnouncementTriggers,
  INITIAL_CABIN_ANNOUNCEMENT_TRIGGER_STATE,
  type CabinAnnouncementAction,
  type CabinAnnouncementTriggerState
} from '@shared/cabinAnnouncements/evaluateCabinAnnouncementTriggers'
import type { SimTelemetry } from '@shared/types/simconnect'
import { isCabinAutomationEligible } from '@shared/cabinAnnouncements/isCabinAutomationEligible'
import {
  evaluateLoadsheetCompletion,
  INITIAL_LOADSHEET_COMPLETION_STATE,
  type LoadsheetCompletionState,
  type LoadsheetCompletionSource
} from '@shared/simbrief/evaluateLoadsheetCompletion'
import type { CabinLoadsheetSnapshot } from '@shared/types/loadsheet'

interface QueuedAnnouncement {
  type: CabinAnnouncementType
  origin: CabinPlaybackOrigin
}

function positiveOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function makeLoadsheetSnapshot(telemetry: SimTelemetry, captureSource: LoadsheetCompletionSource): CabinLoadsheetSnapshot {
  return {
    capturedAt: telemetry.simZuluIso,
    captureSource,
    passengersTarget: positiveOrNull(telemetry.gsxPassengersTarget),
    passengersBoarded: positiveOrNull(telemetry.gsxPassengersBoardedTotal),
    cargoBoardingPercent: positiveOrNull(telemetry.gsxCargoBoardingPercent),
    totalWeightKg: positiveOrNull(telemetry.totalWeightKg),
    emptyWeightKg: positiveOrNull(telemetry.emptyWeightKg),
    fuelWeightKg: positiveOrNull(telemetry.fuelTotalWeight),
    maxGrossWeightKg: positiveOrNull(telemetry.maxGrossWeightKg),
    maxZeroFuelWeightKg: positiveOrNull(telemetry.maxZeroFuelWeightKg),
    maxTakeoffWeightKg: positiveOrNull(telemetry.maxTakeoffWeightKg),
    maxLandingWeightKg: positiveOrNull(telemetry.maxLandingWeightKg)
  }
}

/**
 * Lecteur global monté dans AppLayout : SimConnect et les L:vars GSX sont surveillés quelle que
 * soit la page affichée. Les automatismes restent strictement liés au vol explicitement armé dans
 * le suivi et à l'état système "Sim" de MSFS : une ligne marquée « en cours » dans la base ou une
 * simple connexion SimConnect depuis les menus ne suffisent jamais à lancer un fichier audio.
 */
export function CabinAnnouncementPlayer() {
  const telemetry = useSimTelemetry()
  const simconnectStatus = useSimConnectStatus()
  const { data: armedFlightId = null } = useArmedFlightId()
  const { data: flights = [] } = useQuery({ queryKey: ['flights'], queryFn: () => window.flightops.flights.list() })
  const { data: companies = [] } = useQuery({
    queryKey: ['fleet', 'companies'],
    queryFn: () => window.flightops.fleet.companies.list()
  })

  const activeFlight = flights.find((flight) => flight.id === armedFlightId) ?? null
  const automationSessionReady = isCabinAutomationEligible({
    armedFlightId,
    activeFlightId: activeFlight?.id ?? null,
    simconnectConnected: simconnectStatus === 'connected',
    simulationActive: telemetry?.simulationActive === true
  })
  // Le code compagnie enregistré sur un vol SimBrief vient de general.icao_airline. On résout de
  // nouveau la bibliothèque par ce code OACI plutôt que de faire confiance à un ID implicite.
  const flightCompanyIcao = activeFlight?.company.icaoCode.trim().toUpperCase() ?? null
  const detectedCompany = flightCompanyIcao
    ? companies.find((company) => company.icaoCode.trim().toUpperCase() === flightCompanyIcao) ?? null
    : null
  const companyId = detectedCompany?.id ?? null
  const { data: files = [], isSuccess: filesReady } = useQuery({
    queryKey: ['cabin-announcements', companyId],
    queryFn: () => window.flightops.cabinAnnouncements.list(companyId!),
    enabled: companyId !== null
  })

  const filesRef = useRef<Map<CabinAnnouncementType, CabinAnnouncementFile>>(new Map())
  const queueRef = useRef<QueuedAnnouncement[]>([])
  const voiceRef = useRef<HTMLAudioElement | null>(null)
  const voiceTypeRef = useRef<CabinAnnouncementType | null>(null)
  const voiceOriginRef = useRef<CabinPlaybackOrigin | null>(null)
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const musicOriginRef = useRef<CabinPlaybackOrigin | null>(null)
  const musicBaseVolumeRef = useRef(1)
  const triggerStateRef = useRef<CabinAnnouncementTriggerState>(INITIAL_CABIN_ANNOUNCEMENT_TRIGGER_STATE)
  const previousTelemetryRef = useRef<SimTelemetry | null>(null)
  const activeFlightRef = useRef<number | null>(null)
  const loadsheetCompletionRef = useRef<LoadsheetCompletionState>(INITIAL_LOADSHEET_COMPLETION_STATE)
  const playbackAllowedRef = useRef(false)
  playbackAllowedRef.current = automationSessionReady

  const publishPlayback = useCallback(() => {
    useCabinAnnouncementStore.getState().publish({
      activeVoice: voiceTypeRef.current && voiceOriginRef.current
        ? { type: voiceTypeRef.current, origin: voiceOriginRef.current }
        : null,
      activeMusic: musicRef.current && musicOriginRef.current
        ? { type: 'boarding_music', origin: musicOriginRef.current }
        : null,
      queuedTypes: queueRef.current.map((item) => item.type)
    })
  }, [])

  useEffect(() => {
    filesRef.current = new Map(files.map((file) => [file.type, file]))
    const musicVolume = filesRef.current.get('boarding_music')?.volume ?? 1
    musicBaseVolumeRef.current = musicVolume
    if (musicRef.current) musicRef.current.volume = voiceRef.current ? musicVolume * 0.2 : musicVolume
  }, [files])

  const stopMusic = useCallback(() => {
    const music = musicRef.current
    if (music) {
      music.onended = null
      music.onerror = null
      music.pause()
      music.currentTime = 0
    }
    musicRef.current = null
    musicOriginRef.current = null
    publishPlayback()
  }, [publishPlayback])

  const playNext = useCallback(function playNextInQueue() {
    if (voiceRef.current || queueRef.current.length === 0) {
      if (!voiceRef.current && musicRef.current) musicRef.current.volume = musicBaseVolumeRef.current
      publishPlayback()
      return
    }
    const queued = queueRef.current.shift()!
    const file = filesRef.current.get(queued.type)
    if (!file) {
      publishPlayback()
      queueMicrotask(playNextInQueue)
      return
    }

    const audio = new Audio(file.audioUrl)
    audio.volume = file.volume
    voiceRef.current = audio
    voiceTypeRef.current = queued.type
    voiceOriginRef.current = queued.origin
    if (musicRef.current) musicRef.current.volume = musicBaseVolumeRef.current * 0.2
    publishPlayback()
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      if (voiceRef.current === audio) {
        voiceRef.current = null
        voiceTypeRef.current = null
        voiceOriginRef.current = null
      }
      audio.onended = null
      audio.onerror = null
      publishPlayback()
      playNextInQueue()
    }
    audio.onended = finish
    audio.onerror = finish
    audio.play().catch(finish)
  }, [publishPlayback])

  const startMusic = useCallback((origin: CabinPlaybackOrigin) => {
    if (musicRef.current) {
      musicOriginRef.current = origin
      publishPlayback()
      return
    }
    const file = filesRef.current.get('boarding_music')
    if (!file) return
    const audio = new Audio(file.audioUrl)
    audio.loop = true
    musicBaseVolumeRef.current = file.volume
    audio.volume = voiceRef.current ? file.volume * 0.2 : file.volume
    audio.onerror = () => {
      if (musicRef.current === audio) {
        musicRef.current = null
        musicOriginRef.current = null
        publishPlayback()
      }
    }
    musicRef.current = audio
    musicOriginRef.current = origin
    publishPlayback()
    audio.play().catch(() => {
      if (musicRef.current === audio) {
        musicRef.current = null
        musicOriginRef.current = null
        publishPlayback()
      }
    })
  }, [publishPlayback])

  const stopVoice = useCallback(() => {
    const voice = voiceRef.current
    if (voice) {
      voice.onended = null
      voice.onerror = null
      voice.pause()
      voice.currentTime = 0
    }
    voiceRef.current = null
    voiceTypeRef.current = null
    voiceOriginRef.current = null
    publishPlayback()
    queueMicrotask(playNext)
  }, [playNext, publishPlayback])

  const playManual = useCallback((type: CabinAnnouncementType) => {
    if (!playbackAllowedRef.current || !filesRef.current.has(type)) return
    if (type === 'boarding_music') startMusic('manual')
    else {
      queueRef.current.push({ type, origin: 'manual' })
      publishPlayback()
      playNext()
    }
  }, [playNext, publishPlayback, startMusic])

  const stopType = useCallback((type: CabinAnnouncementType) => {
    queueRef.current = queueRef.current.filter((item) => item.type !== type)
    if (type === 'boarding_music') stopMusic()
    else if (voiceTypeRef.current === type) stopVoice()
    else publishPlayback()
  }, [publishPlayback, stopMusic, stopVoice])

  const stopAll = useCallback(() => {
    queueRef.current = []
    const voice = voiceRef.current
    if (voice) {
      voice.onended = null
      voice.onerror = null
      voice.pause()
      voice.currentTime = 0
    }
    voiceRef.current = null
    voiceTypeRef.current = null
    voiceOriginRef.current = null
    stopMusic()
    publishPlayback()
  }, [publishPlayback, stopMusic])

  useEffect(() => {
    useCabinAnnouncementStore.getState().registerControls({ play: playManual, stop: stopType, stopAll })
  }, [playManual, stopAll, stopType])

  // La tablette pilote le même lecteur que la télécommande intégrée : le son reste joué par le PC
  // (et donc par la sortie audio du simulateur), jamais par le navigateur de la tablette.
  useEffect(() => window.flightops.tablet.onCabinCommand((command) => {
    if (command.action === 'play') playManual(command.type)
    else if (command.action === 'stop') stopType(command.type)
    else stopAll()
  }), [playManual, stopAll, stopType])

  // Publie uniquement l'état utile à la télécommande locale. Les URL et chemins des fichiers
  // audio ne quittent pas le renderer Electron.
  useEffect(() => {
    const publishToTablet = () => {
      const state = useCabinAnnouncementStore.getState()
      void window.flightops.tablet.publishCabinStatus({
        company: state.company ? {
          id: state.company.id,
          icaoCode: state.company.icaoCode,
          displayName: state.company.displayName
        } : null,
        automationReady: state.automationReady,
        gsxDetected: state.gsxDetected,
        activeVoice: state.activeVoice,
        activeMusic: state.activeMusic,
        queuedTypes: state.queuedTypes,
        availableTypes: files.map((file) => file.type),
        boardingCompleted: state.boardingCompleted,
        finalLoadsheet: state.finalLoadsheet
      })
    }
    publishToTablet()
    return useCabinAnnouncementStore.subscribe(publishToTablet)
  }, [files])

  useEffect(() => {
    useCabinAnnouncementStore.getState().publish({
      company: detectedCompany ? {
        id: detectedCompany.id,
        icaoCode: detectedCompany.icaoCode,
        displayName: detectedCompany.displayName,
        logoFilename: detectedCompany.logoFilename
      } : null,
      flightId: activeFlight?.id ?? null,
      simconnectConnected: simconnectStatus === 'connected',
      automationReady: Boolean(automationSessionReady && detectedCompany && filesReady),
      gsxDetected: Boolean(automationSessionReady && telemetry && ((telemetry.gsxBoardingState ?? 0) > 0 || (telemetry.gsxDepartureState ?? 0) > 0))
    })
  }, [activeFlight, automationSessionReady, detectedCompany, filesReady, simconnectStatus, telemetry])

  const executeActions = useCallback((actions: CabinAnnouncementAction[]) => {
    for (const action of actions) {
      if (action.kind === 'start_boarding_music') startMusic('automatic')
      else if (action.kind === 'stop_boarding_music') stopMusic()
      else queueRef.current.push(...action.types.map((type) => ({ type, origin: 'automatic' as const })))
    }
    publishPlayback()
    playNext()
  }, [playNext, publishPlayback, startMusic, stopMusic])

  useEffect(() => {
    const activeFlightId = activeFlight?.id ?? null
    if (activeFlightRef.current === activeFlightId) return
    activeFlightRef.current = activeFlightId
    stopAll()
    triggerStateRef.current = INITIAL_CABIN_ANNOUNCEMENT_TRIGGER_STATE
    loadsheetCompletionRef.current = INITIAL_LOADSHEET_COMPLETION_STATE
    previousTelemetryRef.current = null
    useCabinAnnouncementStore.getState().publish({ boardingCompleted: false, finalLoadsheet: null })
  }, [activeFlight?.id, stopAll])

  useEffect(() => {
    if (!telemetry || !activeFlight || !automationSessionReady) return
    // GSX 6 reste le signal prioritaire. Sans GSX, une variation importante de masse suivie de
    // cinq secondes stables valide aussi un chargement effectué depuis l'EFB de l'avion.
    const completion = evaluateLoadsheetCompletion(loadsheetCompletionRef.current, {
      totalWeightKg: telemetry.totalWeightKg,
      gsxBoardingState: telemetry.gsxBoardingState,
      onGround: telemetry.onGround,
      enginesRunning: telemetry.enginesRunning
    })
    loadsheetCompletionRef.current = completion.nextState
    if (completion.completedBy && !useCabinAnnouncementStore.getState().finalLoadsheet) {
      useCabinAnnouncementStore.getState().publish({
        boardingCompleted: true,
        finalLoadsheet: makeLoadsheetSnapshot(telemetry, completion.completedBy)
      })
    }
  }, [telemetry, activeFlight, automationSessionReady])

  useEffect(() => {
    if (!telemetry || !activeFlight || !detectedCompany || !filesReady || !automationSessionReady) return
    // Au retour d'un menu/chargement, la première télémétrie sert uniquement de référence. Cela
    // empêche de rejouer la séquence moteurs ou embarquement à partir de valeurs déjà actives.
    if (triggerStateRef.current.initialized && previousTelemetryRef.current === null) {
      previousTelemetryRef.current = telemetry
      return
    }
    const result = evaluateCabinAnnouncementTriggers(previousTelemetryRef.current, telemetry, triggerStateRef.current, Date.now())
    triggerStateRef.current = result.nextState
    previousTelemetryRef.current = telemetry
    executeActions(result.actions)
  }, [telemetry, activeFlight, detectedCompany, filesReady, automationSessionReady, executeActions])

  useEffect(() => {
    if (automationSessionReady) return
    stopAll()
    previousTelemetryRef.current = null
  }, [automationSessionReady, stopAll])

  useEffect(() => {
    if (simconnectStatus === 'connected') return
    stopAll()
  }, [simconnectStatus, stopAll])

  useEffect(() => () => stopAll(), [stopAll])

  return null
}
