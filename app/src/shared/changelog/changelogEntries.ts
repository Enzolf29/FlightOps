export interface ChangelogEntry {
  version: string
  changes: string[]
}

/**
 * Changelog maintenu à la main, une entrée par version publiée — affiché tel quel dans la popup
 * "Changelog" des paramètres. Les notes générées automatiquement à partir des commits ne sont pas
 * assez lisibles pour un utilisateur final (ce dépôt pousse directement sans passer par des PR),
 * d'où une liste de points écrits explicitement à chaque publication plutôt qu'une extraction
 * automatique. À compléter à chaque nouvelle version, la plus récente en tête.
 */
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: '1.0.26',
    changes: ["Déplacement du réglage du prix du bagage en soute vers la page Économie, par compagnie"]
  },
  {
    version: '1.0.25',
    changes: [
      'Remplacement du prix fret par un prix de bagage en soute, fixé par compagnie et appliqué à tous ses vols',
      'Une part aléatoire des passagers vendus enregistre un bagage en soute à chaque vol',
      'Ajout d’une surtaxe propre à chaque ligne (en plus de la surtaxe aéroport), basée sur sa part d’observations par rapport aux autres lignes du même aéroport',
      'La colonne "Prix fret" de la page Économie devient "Surtaxes" et détaille l’aéroport et la ligne',
      'Le vrai changelog n’affiche plus de barre de défilement horizontale parasite dans les paramètres'
    ]
  },
  {
    version: '1.0.24',
    changes: [
      'Ajout d’un vrai changelog consultable depuis les paramètres',
      'Avertissement dans la barre latérale dès qu’une mise à jour est disponible'
    ]
  },
  {
    version: '1.0.23',
    changes: [
      'Correction du positionnement tarifaire des compagnies low-cost (Ryanair, Transavia, Volotea, Vueling, airBaltic, easyJet)',
      'Recalibrage de la surtaxe "petit aéroport" à partir de l’activité réellement observée par ligne',
      'Ajout du supplément business/première classe sur les vols long-courrier',
      'Les prix affichés ne montrent plus la mention de surtaxe (le calcul reste appliqué en interne)',
      'Correction du carré de sélection parasite au clic sur les cartes (Économie et Vols réels)'
    ]
  },
  {
    version: '1.0.22',
    changes: [
      'Recalibrage des tarifs de référence avec des frais fixes par vol, en plus du tarif au NM',
      'Ajout d’une surtaxe "petit aéroport" basée sur l’activité réelle connue (Vols réels)',
      'Ajout d’une carte des lignes tarifiées sur la page Économie'
    ]
  },
  {
    version: '1.0.21',
    changes: [
      'Ajout du mode économie : tarifs par ligne, demande simulée, suivi du profit par compagnie et par appareil',
      'Correction d’un mélange de factures GSX entre deux vols consécutifs sur le même appareil'
    ]
  },
  {
    version: '1.0.20',
    changes: [
      'Intégration des factures de services au sol GSX, consultables directement dans l’application',
      'La fin d’un vol attend désormais la fin de l’annonce cabine de débarquement'
    ]
  },
  {
    version: '1.0.19',
    changes: ['Correction du numéro de vol affiché sur la tablette (préfixe IATA au lieu d’ICAO)']
  }
]
