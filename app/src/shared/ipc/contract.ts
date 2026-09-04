export const IPC = {
  home: {
    getDashboard: 'home:getDashboard'
  },
  fleet: {
    companies: {
      list: 'fleet:companies:list',
      update: 'fleet:companies:update'
    },
    aircraft: {
      list: 'fleet:aircraft:list',
      create: 'fleet:aircraft:create',
      update: 'fleet:aircraft:update',
      delete: 'fleet:aircraft:delete'
    }
  },
  pilot: {
    getSimbriefUserId: 'pilot:getSimbriefUserId',
    setSimbriefUserId: 'pilot:setSimbriefUserId',
    getAerodataboxApiKey: 'pilot:getAerodataboxApiKey',
    setAerodataboxApiKey: 'pilot:setAerodataboxApiKey'
  },
  simbrief: {
    fetchLatestOfp: 'simbrief:fetchLatestOfp'
  },
  adsbdb: {
    lookupByRegistration: 'adsbdb:lookupByRegistration'
  },
  realFlights: {
    searchRoutes: 'realFlights:searchRoutes',
    suggestFlightNumber: 'realFlights:suggestFlightNumber',
    listKnownRoutes: 'realFlights:listKnownRoutes',
    refreshCompanyRoutes: 'realFlights:refreshCompanyRoutes'
  },
  booking: {
    createFromOfp: 'booking:createFromOfp'
  },
  pireps: {
    list: 'pireps:list',
    listByAircraft: 'pireps:listByAircraft',
    getById: 'pireps:getById',
    getFlightPath: 'pireps:getFlightPath',
    getApproachProfile: 'pireps:getApproachProfile',
    getEvents: 'pireps:getEvents',
    getTelemetrySamples: 'pireps:getTelemetrySamples'
  },
  flights: {
    list: 'flights:list',
    cancel: 'flights:cancel',
    delete: 'flights:delete',
    getOfpJson: 'flights:getOfpJson'
  },
  simconnect: {
    getStatus: 'simconnect:getStatus',
    statusChanged: 'simconnect:statusChanged',
    telemetry: 'simconnect:telemetry',
    armFlight: 'simconnect:armFlight',
    disarmFlight: 'simconnect:disarmFlight',
    getArmedFlightId: 'simconnect:getArmedFlightId',
    getActualDepartureIso: 'simconnect:getActualDepartureIso',
    getLiveFlightPath: 'simconnect:getLiveFlightPath',
    completeManually: 'simconnect:completeManually',
    getMetar: 'simconnect:getMetar',
    flightEvent: 'simconnect:flightEvent',
    getFlightEvents: 'simconnect:getFlightEvents',
    getRecorderStatus: 'simconnect:getRecorderStatus',
    recorderStatusChanged: 'simconnect:recorderStatusChanged'
  },
  stats: {
    getOverview: 'stats:getOverview'
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set'
  },
  cabinAnnouncements: {
    list: 'cabinAnnouncements:list',
    import: 'cabinAnnouncements:import',
    remove: 'cabinAnnouncements:remove',
    setVolume: 'cabinAnnouncements:setVolume'
  },
  tablet: {
    getServerInfo: 'tablet:getServerInfo',
    publishCabinStatus: 'tablet:publishCabinStatus',
    cabinCommand: 'tablet:cabinCommand'
  },
  updates: {
    getStatus: 'updates:getStatus',
    check: 'updates:check',
    install: 'updates:install',
    statusChanged: 'updates:statusChanged'
  },
  app: {
    deleteAllData: 'app:deleteAllData',
    openExternal: 'app:openExternal'
  }
} as const
