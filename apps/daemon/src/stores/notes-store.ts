import { PROJECT_FILES } from '@shared/project-porcelain'
import { readProjectText, writeProjectText } from '../net/project-channel'

/**
 * Project notes — freeform markdown in `<repo>/.porcelain/notes.md`.
 * ONE-WAY app→agent: only the app writes; CLI reads.
 */

export async function readNotes(repoPath: string): Promise<string> {
  return readProjectText(repoPath, PROJECT_FILES.notes)
}

export async function writeNotes(repoPath: string, notes: string): Promise<void> {
  await writeProjectText(repoPath, PROJECT_FILES.notes, notes)
}
