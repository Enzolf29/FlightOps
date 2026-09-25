/**
 * Prépare les annonces cabine livrées avec l'application : lit les packs bruts (un dossier par code
 * OACI de compagnie), reconnaît chaque fichier (voir cabinAnnouncementNames.ts), compresse les WAV
 * en MP3 (les OGG sont copiés tels quels) et écrit le résultat normalisé dans
 * resources/cabin-announcements/<ICAO>/<type>/<variante>-<n>.<ext>, le dossier embarqué dans
 * l'installateur (voir extraResources) puis copié chez le joueur au premier lancement.
 *
 * Usage (ffmpeg requis, chemin via FFMPEG_PATH sinon "ffmpeg" du PATH) :
 *   node scripts/prepare-cabin-announcements.ts "<dossier des packs bruts>"
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { parseAnnouncementFilename } from './cabinAnnouncementNames.ts'

const SOURCE_DIR = resolve(process.argv[2] ?? '')
const OUTPUT_DIR = resolve(import.meta.dirname, '..', 'resources', 'cabin-announcements')
const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg'
const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.m4a', '.aac'])

if (!process.argv[2] || !existsSync(SOURCE_DIR)) {
  console.error('Dossier source introuvable. Usage : node scripts/prepare-cabin-announcements.ts "<dossier>"')
  process.exit(1)
}

interface Entry {
  file: string
  index: number | null
}

const unmapped: string[] = []
let bytesBefore = 0
let bytesAfter = 0

rmSync(OUTPUT_DIR, { recursive: true, force: true })

for (const company of readdirSync(SOURCE_DIR).filter((name) => statSync(join(SOURCE_DIR, name)).isDirectory())) {
  const groups = new Map<string, Entry[]>()
  for (const file of readdirSync(join(SOURCE_DIR, company))) {
    if (!AUDIO_EXTENSIONS.has(extname(file).toLowerCase())) continue
    const parsed = parseAnnouncementFilename(file)
    if (!parsed.type) {
      unmapped.push(`${company}/${file}`)
      continue
    }
    const key = `${parsed.type}|${parsed.variant}`
    groups.set(key, [...(groups.get(key) ?? []), { file, index: parsed.index }])
  }

  for (const [key, entries] of groups) {
    const [type, variant] = key.split('|')
    entries.sort((a, b) => (a.index ?? 0) - (b.index ?? 0) || a.file.localeCompare(b.file))
    const targetDir = join(OUTPUT_DIR, company, type)
    mkdirSync(targetDir, { recursive: true })

    entries.forEach((entry, position) => {
      const source = join(SOURCE_DIR, company, entry.file)
      const extension = extname(entry.file).toLowerCase()
      const isWav = extension === '.wav'
      const target = join(targetDir, `${variant}-${position + 1}${isWav ? '.mp3' : extension}`)
      bytesBefore += statSync(source).size

      if (isWav) {
        // Musique d'embarquement en meilleure qualité que les annonces parlées.
        const bitrate = type === 'boarding_music' ? '128k' : '96k'
        const result = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', source, '-vn', '-codec:a', 'libmp3lame', '-b:a', bitrate, target])
        if (result.status !== 0) {
          console.error(`Échec de conversion : ${company}/${entry.file}\n${result.stderr?.toString() ?? ''}`)
          process.exit(1)
        }
      } else {
        copyFileSync(source, target)
      }
      bytesAfter += statSync(target).size
      console.log(`${company}/${entry.file}  ->  ${type}/${variant}-${position + 1}`)
    })
  }
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)
console.log(`\nTaille : ${mb(bytesBefore)} Mo -> ${mb(bytesAfter)} Mo`)
if (unmapped.length > 0) {
  console.log(`\nFichiers sans type d'annonce correspondant (ignorés) :\n  ${unmapped.join('\n  ')}`)
}
