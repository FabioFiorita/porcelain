import type {
  ChannelDispositionValue,
  CompanionDispositionValue,
  Layer,
  MigrateCompanionInput,
} from '@porcelain/contracts/project-data'
import type { CompanionMigration, CompanionMigrationResult } from './companion-migration-operation'
import { DEFAULT_LAYERS } from './default-layers'
import { createCompanionGitVisibility, createGitignoreDispositions } from './gitignore-dispositions'
import { createJsonLayersDocument } from './json-layers-document'
import type {
  CompanionDispositionsPort,
  CompanionGitVisibilityPort,
  LayersDocument,
  NotesDocument,
} from './project-data-capabilities'
import { createTextNotesDocument } from './text-notes-document'

export type ProjectDataOperations = {
  repoNotes: (repoPath: string) => Promise<string>
  setRepoNotes: (input: { repoPath: string; notes: string }) => Promise<void>
  repoLayers: (repoPath: string) => Promise<{ layers: Layer[]; custom: boolean }>
  setRepoLayers: (input: { repoPath: string; layers: Layer[] | null }) => Promise<void>
  companionDispositions: (repoPath: string) => Promise<ChannelDispositionValue[]>
  companionGitVisibility: (repoPath: string) => Promise<{ hidden: boolean }>
  setCompanionGitVisibility: (input: {
    repoPath: string
    hidden: boolean
  }) => Promise<{ changed: boolean }>
  setCompanionDisposition: (input: {
    repoPath: string
    key: string
    disposition: CompanionDispositionValue
  }) => Promise<{ untracked: string[]; revealed: boolean }>
  recordPublishedReview: (repoPath: string, id: string) => Promise<void>
  /**
   * The one-time companion migration (#27). Absent when the daemon was composed
   * without a Project-store home — the procedure then refuses rather than
   * guessing where the new owners live.
   */
  migrateCompanion: (input: MigrateCompanionInput) => Promise<CompanionMigrationResult>
}

export function createProjectDataOperations(options?: {
  notes?: NotesDocument
  layers?: LayersDocument
  dispositions?: CompanionDispositionsPort
  visibility?: CompanionGitVisibilityPort
  migration?: CompanionMigration
}): ProjectDataOperations {
  const notes = options?.notes ?? createTextNotesDocument()
  const layers = options?.layers ?? createJsonLayersDocument()
  const dispositions = options?.dispositions ?? createGitignoreDispositions()
  const visibility = options?.visibility ?? createCompanionGitVisibility()

  return Object.freeze({
    repoNotes: (repoPath) => notes.read(repoPath),
    setRepoNotes: (input) => notes.write(input.repoPath, input.notes),
    async repoLayers(repoPath) {
      const stored = await layers.read(repoPath)
      return { layers: stored ?? DEFAULT_LAYERS, custom: stored !== null }
    },
    setRepoLayers: (input) => layers.write(input.repoPath, input.layers),
    companionDispositions: (repoPath) => dispositions.read(repoPath),
    companionGitVisibility: (repoPath) => visibility.read(repoPath),
    setCompanionGitVisibility: (input) => visibility.set(input.repoPath, input.hidden),
    setCompanionDisposition: (input) =>
      dispositions.set(input.repoPath, input.key, input.disposition),
    recordPublishedReview: (repoPath, id) => dispositions.recordPublishedReview(repoPath, id),
    migrateCompanion: async (input) => {
      const migration = options?.migration
      if (migration === undefined) return { ok: false, error: { code: 'request.invalid' } }
      return await migration.migrateCompanion(input)
    },
  })
}
