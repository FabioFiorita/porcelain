import { join } from 'node:path'
import { z } from 'zod'
import {
  createStrictJsonDocument,
  type ReadStrictJsonDocument,
  type StrictJsonDocument,
} from '../../project-data/strict-json-document'
import type { StoredHubProject, StoredHubWorktree } from './hub-identity'

export const HUB_INVENTORY_FILE_MAX_BYTES = 256 * 1024

const storedWorktreeSchema = z
  .object({
    id: z.string().min(1),
    gitDir: z.string().min(1),
  })
  .strict()

const storedProjectSchema = z
  .object({
    id: z.string().min(1),
    commonGitDir: z.string().min(1),
    groupingKey: z.string().min(1),
    name: z.string().min(1),
    worktrees: z.array(storedWorktreeSchema),
  })
  .strict()

const hubInventoryValueSchema = z
  .object({
    projects: z.array(storedProjectSchema),
  })
  .strict()

export type HubInventoryError = { readonly code: 'projects.unavailable' }
export type HubInventoryStoreResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: HubInventoryError }

export type HubInventoryStore = Readonly<{
  readProjects: () => Promise<HubInventoryStoreResult<StoredHubProject[]>>
  writeProjects: (projects: readonly StoredHubProject[]) => Promise<HubInventoryStoreResult<void>>
}>

type HubInventoryValue = z.infer<typeof hubInventoryValueSchema>

const unavailable = (): HubInventoryStoreResult<never> => ({
  ok: false,
  error: { code: 'projects.unavailable' },
})

function reportUnavailable(
  result: Exclude<ReadStrictJsonDocument<HubInventoryValue>, { kind: 'missing' }>,
): void {
  if (result.kind === 'corrupt') {
    console.error(`porcelain: hub inventory document is corrupt; backup at ${result.backupPath}`)
    return
  }
  if (result.kind === 'incompatible-version') {
    console.error(`porcelain: hub inventory document has unsupported version ${result.version}`)
    return
  }
  if (result.kind === 'too-large') {
    console.error(
      `porcelain: hub inventory document is ${result.byteLength} bytes (> ${HUB_INVENTORY_FILE_MAX_BYTES})`,
    )
  }
}

function cloneProjects(projects: readonly StoredHubProject[]): Array<{
  id: string
  commonGitDir: string
  groupingKey: string
  name: string
  worktrees: StoredHubWorktree[]
}> {
  return projects.map((project) => ({
    id: project.id,
    commonGitDir: project.commonGitDir,
    groupingKey: project.groupingKey,
    name: project.name,
    worktrees: project.worktrees.map((worktree) => ({
      id: worktree.id,
      gitDir: worktree.gitDir,
    })),
  }))
}

export function createHubInventoryStore(options: { path: string }): HubInventoryStore {
  const document: StrictJsonDocument<HubInventoryValue> = createStrictJsonDocument({
    path: options.path,
    valueSchema: hubInventoryValueSchema,
    maxBytes: HUB_INVENTORY_FILE_MAX_BYTES,
  })
  let mutationChain: Promise<void> = Promise.resolve()

  function serialize<Value>(
    run: () => Promise<HubInventoryStoreResult<Value>>,
  ): Promise<HubInventoryStoreResult<Value>> {
    const next = mutationChain.then(run, run)
    mutationChain = Promise.allSettled([next]).then(() => undefined)
    return next
  }

  async function readProjects(): Promise<HubInventoryStoreResult<StoredHubProject[]>> {
    let result: ReadStrictJsonDocument<HubInventoryValue>
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
    return { ok: true, value: cloneProjects(result.value.projects) }
  }

  return Object.freeze({
    readProjects,
    writeProjects(projects: readonly StoredHubProject[]): Promise<HubInventoryStoreResult<void>> {
      return serialize<void>(async () => {
        try {
          await document.write({ projects: cloneProjects(projects) })
          return { ok: true, value: undefined }
        } catch {
          return unavailable()
        }
      })
    },
  })
}

let configuredStore: HubInventoryStore | null = null

export function initHubInventoryStore(directory: string): HubInventoryStore {
  configuredStore = createHubInventoryStore({
    path: join(directory, 'hub-inventory.json'),
  })
  return configuredStore
}

export function configuredHubInventoryStore(): HubInventoryStore {
  if (configuredStore === null) {
    throw new Error('hub-inventory-store: initHubInventoryStore has not been called')
  }
  return configuredStore
}
