import type { SessionChange } from '@porcelain/contracts/session'
import type { FilesChanges } from './files-ports'

/**
 * Map Files capability facts onto the session change vocabulary.
 * Delivery is best-effort; failures do not reverse durable I/O.
 */
export function createFilesChangesPublisher(
  publish: (change: SessionChange) => void,
): FilesChanges {
  return {
    publish(change) {
      if (change.type === 'files.content-changed') {
        publish({
          kind: 'files.content-changed',
          projectPath: change.projectPath,
          paths: [...change.paths],
        })
        return
      }
      publish({
        kind: 'files.tree-changed',
        projectPath: change.projectPath,
        paths: [...change.paths],
      })
    },
  }
}
