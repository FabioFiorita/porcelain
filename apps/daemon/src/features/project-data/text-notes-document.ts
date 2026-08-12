import { PROJECT_FILES } from '@shared/project-porcelain'
import { readProjectText, writeProjectText } from '../../net/project-channel'
import type { NotesDocument } from './project-data-capabilities'

/**
 * Project notes — freeform markdown in `<repo>/.porcelain/notes.md`.
 * ONE-WAY app→agent: only the app writes; CLI reads.
 */
export function createTextNotesDocument(): NotesDocument {
  return {
    read(repoPath) {
      return readProjectText(repoPath, PROJECT_FILES.notes)
    },
    async write(repoPath, notes) {
      await writeProjectText(repoPath, PROJECT_FILES.notes, notes)
    },
  }
}
