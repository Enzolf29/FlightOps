/**
 * Extrait le briefing texte complet (mise en page SimBrief d'origine) depuis le JSON brut d'un OFP
 * (`flights.simbrief_ofp_json`, champ `text.plan_html`). SimBrief marque chaque section par un
 * commentaire `<!--BKMK///Titre///Niveau-->` : on les remplace par des ancres pour permettre une
 * table des matières cliquable, sans toucher au reste de la mise en page (tableaux ASCII alignés).
 */

export interface BriefingSection {
  id: string
  title: string
  level: number
}

export interface BriefingDocument {
  html: string
  sections: BriefingSection[]
}

const BOOKMARK_PATTERN = /<!--BKMK\/\/\/([^/]*)\/\/\/(\d+)-->/g

export function parseBriefingHtml(rawOfpJson: string | null): BriefingDocument | null {
  if (!rawOfpJson) return null

  let planHtml: unknown
  try {
    const parsed: unknown = JSON.parse(rawOfpJson)
    planHtml = (parsed as { text?: { plan_html?: unknown } })?.text?.plan_html
  } catch {
    return null
  }
  if (typeof planHtml !== 'string' || !planHtml.trim()) return null

  const sections: BriefingSection[] = []
  let index = 0
  const html = planHtml.replace(BOOKMARK_PATTERN, (_match, title: string, level: string) => {
    const id = `briefing-sec-${index}`
    sections.push({ id, title: title.trim() || 'Section', level: Number(level) || 0 })
    index += 1
    return `<a id="${id}"></a>`
  })

  return { html, sections }
}
