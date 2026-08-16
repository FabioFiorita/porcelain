import {
  ACTIVE_FILES,
  PROJECT_FILES,
  PROJECT_REVIEWS_DIR,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import type { ReadStrictJsonDocument } from '../../project-data/strict-json-document'
import type { ProjectManifestValue } from './project-manifest'

export const PROJECT_DATA_DOMAIN_KEYS = [
  'projects',
  'files',
  'git',
  'search',
  'review',
  'actions',
  'terminal',
  'project-data',
  'remote',
] as const
export type ProjectDataDomainKey = (typeof PROJECT_DATA_DOMAIN_KEYS)[number]

export const PROJECT_DATA_DOMAIN_FILES: {
  readonly [K in ProjectDataDomainKey]: readonly string[]
} = {
  actions: [PROJECT_FILES.actions],
  files: [],
  review: [
    ACTIVE_FILES.review,
    ACTIVE_FILES.comments,
    ACTIVE_FILES.reviewed,
    PROJECT_FILES.activeReview,
    `${PROJECT_REVIEWS_DIR}/`,
  ],
  'project-data': [PROJECT_FILES.layers, PROJECT_FILES.gitignore, PROJECT_FILES.manifest],
  projects: [],
  git: [],
  search: [],
  terminal: [],
  remote: [],
}

export type ProjectDomainFiles = {
  readonly domain: ProjectDataDomainKey
  readonly files: readonly string[]
  path(repoPath: string, fileName: string): string
}

export function projectDataFilesForDomain(domainKey: ProjectDataDomainKey): ProjectDomainFiles {
  const files = PROJECT_DATA_DOMAIN_FILES[domainKey]
  return {
    domain: domainKey,
    files,
    path(repoPath: string, fileName: string): string {
      if (!files.includes(fileName)) {
        throw new Error(`project-data: ${fileName} is not a ${domainKey} companion file`)
      }
      return projectPorcelainPath(repoPath, fileName)
    },
  }
}

export type ProjectDataRootError =
  | { readonly code: 'project-data.manifest-corrupt'; readonly backupPath: string }
  | { readonly code: 'project-data.manifest-incompatible'; readonly version: number }
  | {
      readonly code: 'project-data.manifest-too-large'
      readonly byteLength: number
      readonly maxBytes: number
    }

export type ProjectDataRootResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: ProjectDataRootError }

export type ProjectDataStore = {
  ensureRoot(repoPath: string): Promise<ProjectDataRootResult>
  readManifest(repoPath: string): Promise<ReadStrictJsonDocument<ProjectManifestValue>>
  forDomain(domainKey: ProjectDataDomainKey): ProjectDomainFiles
}
