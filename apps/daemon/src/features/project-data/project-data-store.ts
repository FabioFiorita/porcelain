import { mkdir } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { projectPorcelainDir } from '@shared/project-porcelain'
import { ensureCompanionHidden } from '../../project/git-exclude'
import { applyCompanionPolicy } from './companion-policy'
import {
  type ProjectDataDomainKey,
  type ProjectDataRootResult,
  type ProjectDataStore,
  projectDataFilesForDomain,
} from './project-data-ports'
import { createProjectManifestDocument, defaultProjectManifestValue } from './project-manifest'

const runs = new Map<string, Promise<ProjectDataRootResult>>()

let processStore: ProjectDataStore | null = null

function reportRootFailure(result: Exclude<ProjectDataRootResult, { ok: true }>): void {
  const { error } = result
  if (error.code === 'project-data.manifest-corrupt') {
    console.error(`porcelain: project-data manifest is corrupt; backup at ${error.backupPath}`)
    return
  }
  if (error.code === 'project-data.manifest-incompatible') {
    console.error(`porcelain: project-data manifest has unsupported version ${error.version}`)
    return
  }
  console.error(
    `porcelain: project-data manifest is ${error.byteLength} bytes (> ${error.maxBytes})`,
  )
}

async function performEnsureRoot(repoPath: string): Promise<ProjectDataRootResult> {
  await ensureCompanionHidden(repoPath)
  await mkdir(projectPorcelainDir(repoPath), { recursive: true })
  await applyCompanionPolicy(repoPath)

  const document = createProjectManifestDocument(repoPath)
  const result = await document.read()
  if (result.kind === 'missing') {
    await document.write(defaultProjectManifestValue())
    return { ok: true }
  }
  if (result.kind === 'valid') return { ok: true }

  const failed: Exclude<ProjectDataRootResult, { ok: true }> =
    result.kind === 'corrupt'
      ? {
          ok: false,
          error: { code: 'project-data.manifest-corrupt', backupPath: result.backupPath },
        }
      : result.kind === 'incompatible-version'
        ? {
            ok: false,
            error: { code: 'project-data.manifest-incompatible', version: result.version },
          }
        : {
            ok: false,
            error: {
              code: 'project-data.manifest-too-large',
              byteLength: result.byteLength,
              maxBytes: result.maxBytes,
            },
          }
  reportRootFailure(failed)
  return failed
}

function ensureRoot(repoPath: string): Promise<ProjectDataRootResult> {
  if (!isAbsolute(repoPath)) {
    throw new Error(`project-data: repoPath must be absolute, got: ${repoPath}`)
  }
  const inFlight = runs.get(repoPath)
  if (inFlight) return inFlight
  const run = performEnsureRoot(repoPath).then(
    (result) => {
      if (!result.ok) runs.delete(repoPath)
      return result
    },
    (error: unknown) => {
      runs.delete(repoPath)
      throw error
    },
  )
  runs.set(repoPath, run)
  return run
}

export function createProjectDataStore(): ProjectDataStore {
  return {
    ensureRoot,
    readManifest(repoPath) {
      return createProjectManifestDocument(repoPath).read()
    },
    forDomain(domainKey: ProjectDataDomainKey) {
      return projectDataFilesForDomain(domainKey)
    },
  }
}

export function ensureProjectDataRoot(repoPath: string): Promise<ProjectDataRootResult> {
  processStore ??= createProjectDataStore()
  return processStore.ensureRoot(repoPath)
}

export function resetProjectDataRootMemo(): void {
  runs.clear()
}
