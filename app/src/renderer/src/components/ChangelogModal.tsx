import { Modal } from './Modal'
import { CHANGELOG_ENTRIES } from '@shared/changelog/changelogEntries'

interface ChangelogModalProps {
  onClose: () => void
}

export function ChangelogModal({ onClose }: ChangelogModalProps) {
  return (
    <Modal title="Changelog" onClose={onClose}>
      <div className="changelog-body">
        {CHANGELOG_ENTRIES.map((entry) => (
          <section key={entry.version} className="changelog-entry">
            <h4>Version {entry.version}</h4>
            <ul>
              {entry.changes.map((change, index) => (
                <li key={index}>{change}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}
