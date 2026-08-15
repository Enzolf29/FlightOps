import fallbackNamesRaw from './airportFallbackNames.json'

const FALLBACK_AIRPORT_NAMES = fallbackNamesRaw as Record<string, string>

/**
 * Noms d'aéroports en français, par code OACI (ICAO).
 * Couverture volontairement limitée aux réseaux probables des 12 compagnies de FlightOps
 * (France, Europe, Amérique du Nord, quelques hubs long-courrier et DOM-TOM) — ce sont les noms
 * à privilégier quand ils existent. Pour tout autre aéroport, `getAirportLabel` retombe sur le
 * nom (anglais) du jeu de données public OurAirports plutôt que d'afficher juste le code OACI.
 */
export const AIRPORT_NAMES: Record<string, string> = {
  // France
  LFPG: 'Paris Charles de Gaulle',
  LFPO: 'Paris Orly',
  LFPB: 'Paris Le Bourget',
  LFBO: 'Toulouse Blagnac',
  LFML: 'Marseille Provence',
  LFLL: 'Lyon Saint-Exupéry',
  LFMN: 'Nice Côte d’Azur',
  LFBD: 'Bordeaux Mérignac',
  LFRS: 'Nantes Atlantique',
  LFST: 'Strasbourg Entzheim',
  LFRB: 'Brest Bretagne',
  LFRN: 'Rennes',
  LFMT: 'Montpellier Méditerranée',
  LFKB: 'Bastia Poretta',
  LFKJ: 'Ajaccio Napoléon Bonaparte',
  LFTH: 'Toulon-Hyères',
  LFOB: 'Beauvais-Tillé',
  LFLC: 'Clermont-Ferrand Auvergne',
  LFBZ: 'Biarritz Pays Basque',
  LFBP: 'Pau Pyrénées',

  // Royaume-Uni / Irlande
  EGLL: 'Londres Heathrow',
  EGKK: 'Londres Gatwick',
  EGSS: 'Londres Stansted',
  EGGW: 'Londres Luton',
  EGLC: 'Londres City',
  EGCC: 'Manchester',
  EGPH: 'Édimbourg',
  EGPF: 'Glasgow',
  EIDW: 'Dublin',

  // Bénélux
  EHAM: 'Amsterdam Schiphol',
  EBBR: 'Bruxelles National',
  EBCI: 'Charleroi',
  ELLX: 'Luxembourg',

  // Allemagne / Autriche / Suisse
  EDDF: 'Francfort',
  EDDM: 'Munich',
  EDDB: 'Berlin Brandebourg',
  EDDH: 'Hambourg',
  EDDK: 'Cologne-Bonn',
  EDDL: 'Düsseldorf',
  EDDS: 'Stuttgart',
  LOWW: 'Vienne',
  LSZH: 'Zurich',
  LSGG: 'Genève',
  LSZB: 'Berne',

  // Espagne / Portugal
  LEMD: 'Madrid Barajas',
  LEBL: 'Barcelone El Prat',
  LEPA: 'Palma de Majorque',
  LEAL: 'Alicante',
  LEMG: 'Malaga',
  LEVC: 'Valence',
  LESO: 'Saint-Sébastien',
  LEZL: 'Séville',
  LPPT: 'Lisbonne',
  LPPR: 'Porto',
  LPFR: 'Faro',

  // Italie
  LIRF: 'Rome Fiumicino',
  LIML: 'Milan Linate',
  LIMC: 'Milan Malpensa',
  LIRN: 'Naples',
  LIPZ: 'Venise Marco Polo',
  LIRQ: 'Florence',
  LICJ: 'Palerme',
  LICC: 'Catane',

  // Scandinavie / Nordiques
  EKCH: 'Copenhague',
  ESSA: 'Stockholm Arlanda',
  ENGM: 'Oslo Gardermoen',
  EFHK: 'Helsinki Vantaa',
  BIKF: 'Reykjavik Keflavik',

  // Europe de l'Est
  LKPR: 'Prague',
  EPWA: 'Varsovie Chopin',
  LHBP: 'Budapest',
  LROP: 'Bucarest Henri-Coandă',
  LBSF: 'Sofia',
  LDZA: 'Zagreb',
  LJLJ: 'Ljubljana',
  EVRA: 'Riga',
  EYVI: 'Vilnius',
  EETN: 'Tallinn',

  // Grèce / Turquie
  LGAV: 'Athènes',
  LTFM: 'Istanbul',

  // Afrique du Nord / Moyen-Orient
  GMMN: 'Casablanca Mohammed V',
  DTTA: 'Tunis Carthage',
  DAAG: 'Alger Houari-Boumédiène',
  HECA: 'Le Caire',
  OMDB: 'Dubaï',
  OTHH: 'Doha',
  OERK: 'Riyad',

  // Amérique du Nord
  KJFK: 'New York JFK',
  KEWR: 'Newark',
  KLAX: 'Los Angeles',
  KORD: 'Chicago O’Hare',
  KATL: 'Atlanta',
  KMIA: 'Miami',
  KBOS: 'Boston',
  KIAD: 'Washington Dulles',
  KSFO: 'San Francisco',
  CYYZ: 'Toronto Pearson',
  CYUL: 'Montréal-Trudeau',

  // Asie / Océanie
  RJTT: 'Tokyo Haneda',
  RJAA: 'Tokyo Narita',
  VHHH: 'Hong Kong',
  WSSS: 'Singapour',
  ZBAA: 'Pékin Capitale',
  ZSPD: 'Shanghai Pudong',
  YSSY: 'Sydney',
  NZAA: 'Auckland',

  // Outre-mer français
  TFFR: 'Pointe-à-Pitre',
  TFFF: 'Fort-de-France',
  FMEE: 'La Réunion Roland-Garros',
  FMMI: 'Antananarivo',
  SOCA: 'Cayenne Félix-Éboué'
}

export function getAirportLabel(icaoCode: string): string {
  const name = AIRPORT_NAMES[icaoCode] ?? FALLBACK_AIRPORT_NAMES[icaoCode.trim().toUpperCase()]
  return name ? `${icaoCode} ${name}` : icaoCode
}
