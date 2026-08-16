import type {
  ChannelDispositionValue,
  CompanionDispositionValue,
  MigrateCompanionInput,
} from '@porcelain/contracts/project-data'
import type { CompanionMigration, CompanionMigrationResult } from './companion-migration-operation'
import { createCompanionGitVisibility, createGitignoreDispositions } from './gitignore-dispositions'
import type {
  CompanionDispositionsPort,
  CompanionGitVisibilityPort,
} from './project-data-capabilities'

export type ProjectDataOperations = {
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
  dispositions?: CompanionDispositionsPort
  visibility?: CompanionGitVisibilityPort
  migration?: CompanionMigration
}): ProjectDataOperations {
  const dispositions = options?.dispositions ?? createGitignoreDispositions()
  const visibility = options?.visibility ?? createCompanionGitVisibility()

  return Object.freeze({
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
