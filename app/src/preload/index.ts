import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { AppSettings } from '@shared/types/settings'
import type { HomeDashboard } from '@shared/types/home'
import type { Company, CompanyPatch } from '@shared/types/company'
import type { Aircraft, AircraftInput, AircraftPatch, AircraftWithStats } from '@shared/types/aircraft'
import type { SimbriefOfp } from '@shared/types/simbrief'
import type { AdsbdbAircraftLookup } from '@shared/types/adsbdb'
import type { RealRoute, RealRouteSearchResult } from '@shared/types/realFlights'
import type { CreateFlightFromOfpInput } from '@shared/types/booking'
import type { FlightWithRelations } from '@shared/types/flight'
import type { PirepApproachProfilePoint, PirepFlightPathPoint, PirepTelemetrySample, PirepWithFlight } from '@shared/types/pirep'
import type { FlightRecorderStatus, SimConnectStatus, SimTelemetry } from '@shared/types/simconnect'
import type { StatisticsOverview } from '@shared/types/statistics'
import type { FlightEvent } from '@shared/flightStatus/evaluateFlightEvents'
import type { CabinAnnouncementFile, CabinAnnouncementType } from '@shared/types/cabinAnnouncements'
import type { TabletCabinCommand, TabletCabinStatus, TabletServerInfo } from '@shared/types/tablet'
import type { AppUpdateStatus } from '@shared/types/appUpdate'
import type { FlightopsApi } from '@shared/ipc/api'

const flightopsApi: FlightopsApi = {
  home: {
    getDashboard: (): Promise<HomeDashboard> => ipcRenderer.invoke(IPC.home.getDashboard)
  },
  fleet: {
    companies: {
      list: (): Promise<Company[]> => ipcRenderer.invoke(IPC.fleet.companies.list),
      update: (id: number, patch: CompanyPatch): Promise<Company> =>
        ipcRenderer.invoke(IPC.fleet.companies.update, id, patch)
    },
    aircraft: {
      list: (companyId?: number): Promise<AircraftWithStats[]> => ipcRenderer.invoke(IPC.fleet.aircraft.list, companyId),
      create: (input: AircraftInput): Promise<Aircraft> => ipcRenderer.invoke(IPC.fleet.aircraft.create, input),
      update: (id: number, patch: AircraftPatch): Promise<Aircraft> =>
        ipcRenderer.invoke(IPC.fleet.aircraft.update, id, patch),
      delete: (id: number): Promise<void> => ipcRenderer.invoke(IPC.fleet.aircraft.delete, id)
    }
  },
  pilot: {
    getSimbriefUserId: (): Promise<string | null> => ipcRenderer.invoke(IPC.pilot.getSimbriefUserId),
    setSimbriefUserId: (simbriefUserId: string | null): Promise<string | null> =>
      ipcRenderer.invoke(IPC.pilot.setSimbriefUserId, simbriefUserId),
    getAerodataboxApiKey: (): Promise<string | null> => ipcRenderer.invoke(IPC.pilot.getAerodataboxApiKey),
    setAerodataboxApiKey: (apiKey: string | null): Promise<string | null> =>
      ipcRenderer.invoke(IPC.pilot.setAerodataboxApiKey, apiKey)
  },
  simbrief: {
    fetchLatestOfp: (): Promise<SimbriefOfp> => ipcRenderer.invoke(IPC.simbrief.fetchLatestOfp)
  },
  adsbdb: {
    lookupByRegistration: (registration: string): Promise<AdsbdbAircraftLookup> =>
      ipcRenderer.invoke(IPC.adsbdb.lookupByRegistration, registration)
  },
  realFlights: {
    searchRoutes: (companyId: number, departureIcao: string, forceRefresh?: boolean): Promise<RealRouteSearchResult> =>
      ipcRenderer.invoke(IPC.realFlights.searchRoutes, companyId, departureIcao, forceRefresh),
    suggestFlightNumber: (routeId: number): Promise<string | null> =>
      ipcRenderer.invoke(IPC.realFlights.suggestFlightNumber, routeId),
    listKnownRoutes: (companyId: number): Promise<RealRoute[]> =>
      ipcRenderer.invoke(IPC.realFlights.listKnownRoutes, companyId),
    refreshCompanyRoutes: (companyId: number): Promise<RealRouteSearchResult> =>
      ipcRenderer.invoke(IPC.realFlights.refreshCompanyRoutes, companyId)
  },
  booking: {
    createFromOfp: (input: CreateFlightFromOfpInput): Promise<FlightWithRelations> =>
      ipcRenderer.invoke(IPC.booking.createFromOfp, input)
  },
  pireps: {
    list: (): Promise<PirepWithFlight[]> => ipcRenderer.invoke(IPC.pireps.list),
    listByAircraft: (aircraftId: number): Promise<PirepWithFlight[]> =>
      ipcRenderer.invoke(IPC.pireps.listByAircraft, aircraftId),
    getById: (id: number): Promise<PirepWithFlight | null> => ipcRenderer.invoke(IPC.pireps.getById, id),
    getFlightPath: (id: number): Promise<PirepFlightPathPoint[]> => ipcRenderer.invoke(IPC.pireps.getFlightPath, id),
    getApproachProfile: (id: number): Promise<PirepApproachProfilePoint[]> =>
      ipcRenderer.invoke(IPC.pireps.getApproachProfile, id),
    getEvents: (id: number): Promise<FlightEvent[]> => ipcRenderer.invoke(IPC.pireps.getEvents, id),
    getTelemetrySamples: (id: number): Promise<PirepTelemetrySample[]> => ipcRenderer.invoke(IPC.pireps.getTelemetrySamples, id)
  },
  flights: {
    list: (): Promise<FlightWithRelations[]> => ipcRenderer.invoke(IPC.flights.list),
    cancel: (id: number): Promise<FlightWithRelations> => ipcRenderer.invoke(IPC.flights.cancel, id),
    delete: (id: number): Promise<void> => ipcRenderer.invoke(IPC.flights.delete, id),
    getOfpJson: (id: number): Promise<string | null> => ipcRenderer.invoke(IPC.flights.getOfpJson, id)
  },
  simconnect: {
    getStatus: (): Promise<SimConnectStatus> => ipcRenderer.invoke(IPC.simconnect.getStatus),
    onStatusChange: (listener: (status: SimConnectStatus) => void): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, status: SimConnectStatus): void => listener(status)
      ipcRenderer.on(IPC.simconnect.statusChanged, wrapped)
      return () => ipcRenderer.removeListener(IPC.simconnect.statusChanged, wrapped)
    },
    onTelemetry: (listener: (telemetry: SimTelemetry) => void): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, telemetry: SimTelemetry): void => listener(telemetry)
      ipcRenderer.on(IPC.simconnect.telemetry, wrapped)
      return () => ipcRenderer.removeListener(IPC.simconnect.telemetry, wrapped)
    },
    armFlight: (flightId: number): Promise<void> => ipcRenderer.invoke(IPC.simconnect.armFlight, flightId),
    disarmFlight: (): Promise<void> => ipcRenderer.invoke(IPC.simconnect.disarmFlight),
    getArmedFlightId: (): Promise<number | null> => ipcRenderer.invoke(IPC.simconnect.getArmedFlightId),
    getActualDepartureIso: (): Promise<string | null> => ipcRenderer.invoke(IPC.simconnect.getActualDepartureIso),
    getLiveFlightPath: (): Promise<PirepFlightPathPoint[]> => ipcRenderer.invoke(IPC.simconnect.getLiveFlightPath),
    completeManually: (): Promise<void> => ipcRenderer.invoke(IPC.simconnect.completeManually),
    getMetar: (icaoCode: string): Promise<string> => ipcRenderer.invoke(IPC.simconnect.getMetar, icaoCode),
    getFlightEvents: (): Promise<FlightEvent[]> => ipcRenderer.invoke(IPC.simconnect.getFlightEvents),
    onFlightEvent: (listener: (event: FlightEvent) => void): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, flightEvent: FlightEvent): void => listener(flightEvent)
      ipcRenderer.on(IPC.simconnect.flightEvent, wrapped)
      return () => ipcRenderer.removeListener(IPC.simconnect.flightEvent, wrapped)
    },
    getRecorderStatus: (): Promise<FlightRecorderStatus> => ipcRenderer.invoke(IPC.simconnect.getRecorderStatus),
    onRecorderStatusChange: (listener: (status: FlightRecorderStatus) => void): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, status: FlightRecorderStatus): void => listener(status)
      ipcRenderer.on(IPC.simconnect.recorderStatusChanged, wrapped)
      return () => ipcRenderer.removeListener(IPC.simconnect.recorderStatusChanged, wrapped)
    }
  },
  stats: {
    getOverview: (): Promise<StatisticsOverview> => ipcRenderer.invoke(IPC.stats.getOverview)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.settings.get),
    set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC.settings.set, key, value)
  },
  cabinAnnouncements: {
    list: (companyId: number): Promise<CabinAnnouncementFile[]> =>
      ipcRenderer.invoke(IPC.cabinAnnouncements.list, companyId),
    import: (companyId: number, type: CabinAnnouncementType): Promise<CabinAnnouncementFile | null> =>
      ipcRenderer.invoke(IPC.cabinAnnouncements.import, companyId, type),
    remove: (companyId: number, type: CabinAnnouncementType): Promise<void> =>
      ipcRenderer.invoke(IPC.cabinAnnouncements.remove, companyId, type),
    setVolume: (companyId: number, type: CabinAnnouncementType, volume: number): Promise<CabinAnnouncementFile> =>
      ipcRenderer.invoke(IPC.cabinAnnouncements.setVolume, companyId, type, volume)
  },
  tablet: {
    getServerInfo: (): Promise<TabletServerInfo> => ipcRenderer.invoke(IPC.tablet.getServerInfo),
    publishCabinStatus: (status: TabletCabinStatus): Promise<void> =>
      ipcRenderer.invoke(IPC.tablet.publishCabinStatus, status),
    onCabinCommand: (listener: (command: TabletCabinCommand) => void): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, command: TabletCabinCommand): void => listener(command)
      ipcRenderer.on(IPC.tablet.cabinCommand, wrapped)
      return () => ipcRenderer.removeListener(IPC.tablet.cabinCommand, wrapped)
    }
  },
  updates: {
    getStatus: (): Promise<AppUpdateStatus> => ipcRenderer.invoke(IPC.updates.getStatus),
    check: (): Promise<AppUpdateStatus> => ipcRenderer.invoke(IPC.updates.check),
    install: (): Promise<void> => ipcRenderer.invoke(IPC.updates.install),
    onStatusChange: (listener: (status: AppUpdateStatus) => void): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, status: AppUpdateStatus): void => listener(status)
      ipcRenderer.on(IPC.updates.statusChanged, wrapped)
      return () => ipcRenderer.removeListener(IPC.updates.statusChanged, wrapped)
    }
  },
  app: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.app.openExternal, url),
    deleteAllData: (): Promise<boolean> => ipcRenderer.invoke(IPC.app.deleteAllData)
  }
}

contextBridge.exposeInMainWorld('flightops', flightopsApi)
