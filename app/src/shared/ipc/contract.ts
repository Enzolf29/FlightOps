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
    listKnownRoutes: 'realFlights:listKnownRoutes'
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
    getEvents: 'pireps:getEvents'
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
    getFlightEvents: 'simconnect:getFlightEvents'
  },
  stats: {
    getOverview: 'stats:getOverview'
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set'
  },
  app: {
    deleteAllData: 'app:deleteAllData',
    openExternal: 'app:openExternal'
  }
} as const
