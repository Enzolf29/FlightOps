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
    version: '1.0.30',
    changes: [
      'Annonces cabine : volume par défaut à 50 % pour toutes les annonces, y compris celles ajoutées par le joueur',
      'Annonces cabine : les Cabin Dim Takeoff ne se jouent plus que de nuit',
      'Annonces cabine : les fichiers réservés au jour ([Morning]/[Afternoon]) ou à la nuit ([Evening]/[Night]) ne sont jamais lus en dehors de leur période',
      'Annonces cabine : nouveau bouton « Réinitialiser les annonces » pour chaque compagnie, qui supprime les modifications du joueur et remet les annonces et volumes par défaut',
      'Annonces cabine : les annonces de base affichent à nouveau leur nom de fichier d’origine dans les paramètres',
      'Statistiques : les heures par compagnie et par avion sont affichées dans un second graphique à droite du nombre de vols'
    ]
  },
  {
    version: '1.0.29',
    changes: [
      'Suppression complète du mode économie (tarifs, passagers et fret calculés par l’application, bénéfice, capacités des avions) : SimBrief gère désormais les charges. Les factures GSX sont conservées à titre indicatif dans le suivi de vol, les PIREPs et les statistiques',
      'Statistiques : nouvelles cartes « Distance parcourue » (avec l’équivalent en tours de la Terre) et « Carburant consommé » (réellement brûlé, hors carburant non utilisé)',
      'Statistiques : nombre d’heures et distance ajoutés pour chaque compagnie et chaque avion, en plus du nombre de vols',
      'Loadsheet (application et tablette) : ajout du MACZFW en %',
      'Nouvelle application « GSX » sur la tablette EFB : statut en direct de tous les services GSX (embarquement, débarquement, carburant, pushback, catering, etc.) et contrôle du menu GSX',
      'Annonces cabine de base incluses dans l’application, par compagnie, toujours modifiables : le joueur peut les supprimer, en ajouter ou les remplacer',
      'Annonces cabine : plusieurs fichiers possibles pour une même annonce (un est choisi au hasard à la lecture) et variantes jour / nuit selon l’heure du simulateur',
      'Suppression de l’alerte « Inclinaison excessive » (plus de 30°) dans les journaux de vol'
    ]
  },
  {
    version: '1.0.28',
    changes: [
      'Correction du mode économie : le prix résolu à la réservation survit désormais à un redémarrage de l’application avant l’import du plan SimBrief',
      'Avertissement à l’import si une ligne tarifiée n’a aucune résolution économie en attente',
      'Nouvelle section "Finance" dans le PIREP : revenu, coût GSX, bénéfice et factures regroupés au même endroit',
      'Nouvelle section "Bénéfice" dans les statistiques, avec le détail par compagnie',
      'Badge "Économie" (vert/rouge) sur la page Suivi de vol, à côté des boutons d’annonces cabine',
      'Suppression des indicateurs de vol et anomalies détectées du PIREP',
      'La courbe de taux d’atterrissage affiche désormais la moyenne mensuelle plutôt qu’un point par vol, avec une info-bulle rappelant le barème des catégories'
    ]
  },
  {
    version: '1.0.27',
    changes: [
      "La clôture d'un vol attend désormais la fin réelle du débarquement GSX (en plus de l'annonce cabine), quand GSX a été utilisé pendant ce vol",
      "L'heure d'arrivée officielle reste celle de la coupure moteurs, inchangée"
    ]
  },
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
