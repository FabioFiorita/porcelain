import { isAbsolute } from 'node:path'
import { PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { z } from 'zod'
import {
  createStrictJsonDocument,
  type StrictJsonDocument,
} from '../../project-data/strict-json-document'

export const PROJECT_MANIFEST_LAYOUT = 'project-companion-v1' as const
export const PROJECT_MANIFEST_FILE_MAX_BYTES = 16 * 1024

export const projectManifestValueSchema = z
  .object({ layout: z.literal(PROJECT_MANIFEST_LAYOUT) })
  .strict()
export type ProjectManifestValue = z.infer<typeof projectManifestValueSchema>

export const defaultProjectManifestValue = (): ProjectManifestValue => ({
  layout: PROJECT_MANIFEST_LAYOUT,
})

export function projectManifestPath(repoPath: string): string {
  return projectPorcelainPath(repoPath, PROJECT_FILES.manifest)
}

export function createProjectManifestDocument(
  repoPath: string,
  maxBytes = PROJECT_MANIFEST_FILE_MAX_BYTES,
): StrictJsonDocument<ProjectManifestValue> {
  if (!isAbsolute(repoPath)) {
    throw new Error(`strict-json-document path must be absolute, got: ${repoPath}`)
  }
  return createStrictJsonDocument({
    path: projectManifestPath(repoPath),
    valueSchema: projectManifestValueSchema,
    maxBytes,
  })
}
