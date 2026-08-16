import type {
  ChannelDispositionValue,
  CompanionDispositionValue,
} from '@porcelain/contracts/project-data'
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
}

export function createProjectDataOperations(options?: {
  dispositions?: CompanionDispositionsPort
  visibility?: CompanionGitVisibilityPort
}): ProjectDataOperations {
  const dispositions = options?.dispositions ?? createGitignoreDispositions()
  const visibility = options?.visibility ?? createCompanionGitVisibility()

  return Object.freeze({
    companionDispositions: (repoPath) => dispositions.read(repoPath),
    companionGitVisibility: (repoPath) => visibility.read(repoPath),
    setCompanionGitVisibility: (input) => visibility.set(input.repoPath, input.hidden),
    setCompanionDisposition: (input) =>
      dispositions.set(input.repoPath, input.key, input.disposition),
  })
}
