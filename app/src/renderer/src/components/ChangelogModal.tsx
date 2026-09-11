import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { useReleaseChangelog } from '@renderer/hooks/useAppUpdate'

interface ChangelogModalProps {
  version: string
  onClose: () => void
}

/** Rendu minimal et sûr (pas de HTML injecté) des notes de version GitHub : titres `##`, listes à
 * puces `- `/`* ` et liens `[texte](url)` inline — suffisant pour un changelog, sans dépendance à
 * une librairie markdown complète. */
function renderChangelogBody(body: string): ReactNode[] {
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g

  function renderInline(text: string, keyPrefix: string): ReactNode[] {
    const parts: ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    let index = 0
    linkPattern.lastIndex = 0
    while ((match = linkPattern.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
      parts.push(
        <a key={`${keyPrefix}-link-${index}`} href={match[2]} onClick={(event) => {
          event.preventDefault()
          window.flightops.app.openExternal(match![2])
        }}>
          {match[1]}
        </a>
      )
      lastIndex = match.index + match[0].length
      index += 1
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex))
    return parts
  }

  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let currentList: string[] = []

  function flushList(key: string) {
    if (currentList.length === 0) return
    blocks.push(
      <ul key={key}>
        {currentList.map((item, i) => (
          <li key={i}>{renderInline(item, `${key}-${i}`)}</li>
        ))}
      </ul>
    )
    currentList = []
  }

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim()
    if (line.startsWith('## ')) {
      flushList(`list-${i}`)
      blocks.push(<h4 key={i}>{renderInline(line.slice(3), `h-${i}`)}</h4>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      currentList.push(line.slice(2))
    } else if (line.length === 0) {
      flushList(`list-${i}`)
    } else {
      flushList(`list-${i}`)
      blocks.push(<p key={i}>{renderInline(line, `p-${i}`)}</p>)
    }
  })
  flushList('list-end')

  return blocks
}

export function ChangelogModal({ version, onClose }: ChangelogModalProps) {
  const { data, isLoading } = useReleaseChangelog(true)

  return (
    <Modal title={`Nouveautés — version ${version}`} onClose={onClose}>
      {isLoading ? (
        <p className="empty-hint">Chargement…</p>
      ) : data?.body?.trim() ? (
        <div className="changelog-body">{renderChangelogBody(data.body)}</div>
      ) : (
        <p className="empty-hint">Notes de version indisponibles pour cette version.</p>
      )}
    </Modal>
  )
}
