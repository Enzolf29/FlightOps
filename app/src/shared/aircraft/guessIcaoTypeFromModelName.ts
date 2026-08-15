interface ModelPattern {
  icaoType: string
  test: RegExp
}

/**
 * AeroDataBox renvoie souvent un nom de modèle descriptif (ex. "Airbus A220-300") plutôt qu'un
 * code OACI brut. Ordre important : les variantes les plus spécifiques (neo/MAX/E2/ER/LR/-600…)
 * doivent être testées avant leur base (A320 avant, A320neo doit matcher avant A320 simple, etc.)
 * pour éviter qu'un motif générique n'avale une variante plus précise en premier.
 */
const MODEL_PATTERNS: ModelPattern[] = [
  { icaoType: 'A19N', test: /A319\s*NEO/ },
  { icaoType: 'A20N', test: /A320\s*NEO/ },
  { icaoType: 'A21N', test: /A321\s*NEO/ },
  { icaoType: 'A318', test: /A318/ },
  { icaoType: 'A319', test: /A319/ },
  { icaoType: 'A320', test: /A320/ },
  { icaoType: 'A321', test: /A321/ },
  { icaoType: 'A338', test: /A330\s*800/ },
  { icaoType: 'A339', test: /A330\s*900/ },
  { icaoType: 'A332', test: /A330\s*200/ },
  { icaoType: 'A333', test: /A330\s*300/ },
  { icaoType: 'A342', test: /A340\s*200/ },
  { icaoType: 'A343', test: /A340\s*300/ },
  { icaoType: 'A345', test: /A340\s*500/ },
  { icaoType: 'A346', test: /A340\s*600/ },
  { icaoType: 'A35K', test: /A350\s*1000/ },
  { icaoType: 'A359', test: /A350\s*900/ },
  { icaoType: 'A388', test: /A380/ },
  { icaoType: 'BCS1', test: /(A220\s*100|CS100)/ },
  { icaoType: 'BCS3', test: /(A220\s*300|CS300)/ },
  { icaoType: 'B38M', test: /737\s*MAX\s*8/ },
  { icaoType: 'B39M', test: /737\s*MAX\s*9/ },
  { icaoType: 'B3XM', test: /737\s*MAX\s*10/ },
  { icaoType: 'B734', test: /737\s*400/ },
  { icaoType: 'B735', test: /737\s*500/ },
  { icaoType: 'B736', test: /737\s*600/ },
  { icaoType: 'B737', test: /737\s*700/ },
  { icaoType: 'B738', test: /737\s*800/ },
  { icaoType: 'B739', test: /737\s*900/ },
  { icaoType: 'B744', test: /747\s*400/ },
  { icaoType: 'B748', test: /747\s*8/ },
  { icaoType: 'B752', test: /757\s*200/ },
  { icaoType: 'B753', test: /757\s*300/ },
  { icaoType: 'B762', test: /767\s*200/ },
  { icaoType: 'B763', test: /767\s*300/ },
  { icaoType: 'B764', test: /767\s*400/ },
  { icaoType: 'B77L', test: /777\s*200\s*LR/ },
  { icaoType: 'B77W', test: /777\s*300\s*ER/ },
  { icaoType: 'B772', test: /777\s*200/ },
  { icaoType: 'B773', test: /777\s*300/ },
  { icaoType: 'B778', test: /777\s*8/ },
  { icaoType: 'B779', test: /777\s*9/ },
  { icaoType: 'B788', test: /787\s*8/ },
  { icaoType: 'B789', test: /787\s*9/ },
  { icaoType: 'B78X', test: /787\s*10/ },
  { icaoType: 'CRJ7', test: /CRJ\s*700/ },
  { icaoType: 'CRJ9', test: /CRJ\s*900/ },
  { icaoType: 'CRJX', test: /CRJ\s*1000/ },
  { icaoType: 'E290', test: /E\s*190\s*E2/ },
  { icaoType: 'E295', test: /E\s*195\s*E2/ },
  { icaoType: 'E170', test: /E\s*170/ },
  { icaoType: 'E175', test: /E\s*175/ },
  { icaoType: 'E190', test: /E\s*190/ },
  { icaoType: 'E195', test: /E\s*195/ },
  { icaoType: 'AT45', test: /ATR\s*42/ },
  { icaoType: 'AT76', test: /ATR\s*72\s*600/ },
  { icaoType: 'AT72', test: /ATR\s*72/ },
  { icaoType: 'DH8D', test: /(DASH\s*8|DHC\s*8|Q400)/ }
]

/**
 * Couvre le tiret ASCII (-), le tiret bas (_), et toute la plage Unicode des tirets typographiques
 * (U+2010 hyphen à U+2015 horizontal bar, dont le tiret demi-cadratin – souvent utilisé par les
 * sources de données aviation, ex. "Airbus A220–300") — un simple `-` ne les couvre pas et faisait
 * silencieusement échouer la détection.
 */
function normalize(model: string): string {
  return model
    .toUpperCase()
    .replace(/[-_‐-―]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Devine le code OACI d'un type d'avion à partir d'un nom de modèle descriptif en texte libre
 * (ex. "Airbus A220-300" -> "BCS3"). Retourne null si aucun motif connu ne correspond.
 */
export function guessIcaoTypeFromModelName(model: string): string | null {
  const normalized = normalize(model)
  for (const pattern of MODEL_PATTERNS) {
    if (pattern.test.test(normalized)) return pattern.icaoType
  }
  return null
}
