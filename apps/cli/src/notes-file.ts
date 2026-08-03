import { PROJECT_FILES } from '@shared/project-porcelain'
import { readProjectText } from './project-io'

// Project notes — <repo>/.porcelain/notes.md (app writes; CLI reads).

export function readNotes(repoPath: string): string {
  return readProjectText(repoPath, PROJECT_FILES.notes)
}

export function describeNotes(repoPath: string, notes: string): string {
  if (notes.trim() === '') {
    return `No project notes for ${repoPath}. The human keeps a freeform scratchpad in Porcelain (Files → Notes) at .porcelain/notes.md.`
  }
  return `Project notes for ${repoPath} (.porcelain/notes.md):\n\n${notes}`
}
