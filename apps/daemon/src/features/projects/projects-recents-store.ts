import { join } from 'node:path'
import { z } from 'zod'
import {
  createStrictJsonDocument,
  type ReadStrictJsonDocument,
  type StrictJsonDocument,
} from '../../project-data/strict-json-document'

export const MAX_RECENT_PROJECTS = 10
export const PROJECTS_RECENTS_FILE_MAX_BYTES = 64 * 1024

const projectsRecentsValueSchema = z
  .object({
    paths: z.array(z.string()).max(MAX_RECENT_PROJECTS),
  })
  .strict()

export type ProjectsRecentsError = { readonly code: 'projects.unavailable' }
export type ProjectsRecentsResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: ProjectsRecentsError }

export type ProjectsRecentsStore = Readonly<{
  readPaths: () => Promise<ProjectsRecentsResult<string[]>>
  addPath: (path: string) => Promise<ProjectsRecentsResult<void>>
  removePath: (path: string) => Promise<ProjectsRecentsResult<void>>
}>

type ProjectsRecentsValue = z.infer<typeof projectsRecentsValueSchema>

const unavailable = (): ProjectsRecentsResult<never> => ({
  ok: false,
  error: { code: 'projects.unavailable' },
})

function reportUnavailable(
  result: Exclude<ReadStrictJsonDocument<ProjectsRecentsValue>, { kind: 'missing' }>,
): void {
  if (result.kind === 'corrupt') {
    console.error(`porcelain: projects recents document is corrupt; backup at ${result.backupPath}`)
    return
  }
  if (result.kind === 'incompatible-version') {
    console.error(`porcelain: projects recents document has unsupported version ${result.version}`)
    return
  }
  if (result.kind === 'too-large') {
    console.error(
      `porcelain: projects recents document is ${result.byteLength} bytes (> ${result.maxBytes})`,
    )
  }
}

export function createProjectsRecentsStore(options: {
  path: string
  maxBytes?: number
}): ProjectsRecentsStore {
  const document: StrictJsonDocument<ProjectsRecentsValue> = createStrictJsonDocument({
    path: options.path,
    valueSchema: projectsRecentsValueSchema,
    maxBytes: options.maxBytes ?? PROJECTS_RECENTS_FILE_MAX_BYTES,
  })

  async function readPaths(): Promise<ProjectsRecentsResult<string[]>> {
    let result: ReadStrictJsonDocument<ProjectsRecentsValue>
    try {
      result = await document.read()
    } catch {
      return unavailable()
    }
    if (result.kind === 'missing') return { ok: true, value: [] }
    if (result.kind !== 'valid') {
      reportUnavailable(result)
      return unavailable()
    }
    return { ok: true, value: [...result.value.paths] }
  }

  async function writePaths(paths: readonly string[]): Promise<ProjectsRecentsResult<void>> {
    try {
      await document.write({ paths: [...paths] })
      return { ok: true, value: undefined }
    } catch {
      return unavailable()
    }
  }

  let mutationChain: Promise<void> = Promise.resolve()
  function serialize<Value>(
    run: () => Promise<ProjectsRecentsResult<Value>>,
  ): Promise<ProjectsRecentsResult<Value>> {
    const next = mutationChain.then(run, run)
    mutationChain = Promise.allSettled([next]).then(() => undefined)
    return next
  }

  return Object.freeze({
    readPaths,
    addPath(path: string): Promise<ProjectsRecentsResult<void>> {
      return serialize(async () => {
        const current = await readPaths()
        if (!current.ok) return current
        const paths = [path, ...current.value.filter((entry) => entry !== path)].slice(
          0,
          MAX_RECENT_PROJECTS,
        )
        return await writePaths(paths)
      })
    },
    removePath(path: string): Promise<ProjectsRecentsResult<void>> {
      return serialize(async () => {
        const current = await readPaths()
        if (!current.ok) return current
        return await writePaths(current.value.filter((entry) => entry !== path))
      })
    },
  })
}

let configuredStore: ProjectsRecentsStore | null = null

/** Configure the daemon's one user-data Projects-recents document before any consumer reads it. */
export function initProjectsRecentsDir(directory: string): ProjectsRecentsStore {
  configuredStore = createProjectsRecentsStore({
    path: join(directory, 'projects-recents.json'),
  })
  return configuredStore
}

export function configuredProjectsRecentsStore(): ProjectsRecentsStore {
  if (configuredStore === null) {
    throw new Error('projects-recents-store: initProjectsRecentsDir has not been called')
  }
  return configuredStore
}
