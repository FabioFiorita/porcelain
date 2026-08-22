import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { z } from 'zod'
import {
  createStrictJsonDocument,
  type ReadStrictJsonDocument,
  type StrictJsonDocument,
} from '../../project-data/strict-json-document'

export const ENVIRONMENT_IDENTITY_FILE_MAX_BYTES = 16 * 1024

const environmentIdentityValueSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .strict()

export type EnvironmentIdentityRecord = z.infer<typeof environmentIdentityValueSchema>
export type EnvironmentIdentityError = { readonly code: 'projects.unavailable' }
export type EnvironmentIdentityResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: EnvironmentIdentityError }

export type EnvironmentIdentityStore = Readonly<{
  read: () => Promise<EnvironmentIdentityResult<EnvironmentIdentityRecord>>
  /**
   * Set the human's nickname for this Environment. A blank or whitespace-only name
   * CLEARS it: the record falls back to the machine-derived default rather than
   * persisting an empty label nothing could render.
   */
  rename: (name: string) => Promise<EnvironmentIdentityResult<EnvironmentIdentityRecord>>
  /** The machine-derived name a cleared nickname falls back to. */
  defaultName: () => string
}>

const unavailable = (): EnvironmentIdentityResult<never> => ({
  ok: false,
  error: { code: 'projects.unavailable' },
})

function reportUnavailable(
  result: Exclude<ReadStrictJsonDocument<EnvironmentIdentityRecord>, { kind: 'missing' }>,
): void {
  if (result.kind === 'corrupt') {
    console.error(
      `porcelain: environment identity document is corrupt; backup at ${result.backupPath}`,
    )
    return
  }
  if (result.kind === 'incompatible-version') {
    console.error(
      `porcelain: environment identity document has unsupported version ${result.version}`,
    )
    return
  }
  if (result.kind === 'schema-mismatch') {
    console.error('porcelain: environment identity document no longer matches the expected shape')
    return
  }
  if (result.kind === 'too-large') {
    console.error(
      `porcelain: environment identity document is ${result.byteLength} bytes (> ${ENVIRONMENT_IDENTITY_FILE_MAX_BYTES})`,
    )
  }
}

export function createEnvironmentIdentityStore(options: {
  path: string
  defaultName: string
  createId?: () => string
}): EnvironmentIdentityStore {
  const document: StrictJsonDocument<EnvironmentIdentityRecord> = createStrictJsonDocument({
    path: options.path,
    valueSchema: environmentIdentityValueSchema,
    maxBytes: ENVIRONMENT_IDENTITY_FILE_MAX_BYTES,
  })
  const createId = options.createId ?? randomUUID
  const defaultName = options.defaultName.trim() || 'This device'
  let mutationChain: Promise<void> = Promise.resolve()

  function serialize<Value>(
    run: () => Promise<EnvironmentIdentityResult<Value>>,
  ): Promise<EnvironmentIdentityResult<Value>> {
    const next = mutationChain.then(run, run)
    mutationChain = Promise.allSettled([next]).then(() => undefined)
    return next
  }

  /**
   * Read-or-create, WITHOUT the serializer. Both public methods run inside `serialize`
   * already; calling a serialized method from another one would wait on a chain link
   * that cannot advance until the caller returns.
   */
  async function load(): Promise<EnvironmentIdentityResult<EnvironmentIdentityRecord>> {
    let result: ReadStrictJsonDocument<EnvironmentIdentityRecord>
    try {
      result = await document.read()
    } catch {
      return unavailable()
    }
    if (result.kind === 'valid') return { ok: true, value: result.value }
    if (result.kind !== 'missing') {
      reportUnavailable(result)
      return unavailable()
    }
    const created = { id: createId(), name: defaultName }
    try {
      await document.write(created)
    } catch {
      return unavailable()
    }
    return { ok: true, value: created }
  }

  return Object.freeze({
    read(): Promise<EnvironmentIdentityResult<EnvironmentIdentityRecord>> {
      return serialize<EnvironmentIdentityRecord>(load)
    },

    rename(name: string): Promise<EnvironmentIdentityResult<EnvironmentIdentityRecord>> {
      return serialize<EnvironmentIdentityRecord>(async () => {
        const current = await load()
        if (!current.ok) return current
        // The id is the Environment's identity and never moves; only the label does.
        const next = { ...current.value, name: name.trim() || defaultName }
        if (next.name === current.value.name) return { ok: true, value: current.value }
        try {
          await document.write(next)
        } catch {
          return unavailable()
        }
        return { ok: true, value: next }
      })
    },

    defaultName(): string {
      return defaultName
    },
  })
}

let configuredStore: EnvironmentIdentityStore | null = null

export function initEnvironmentIdentityStore(options: {
  directory: string
  defaultName: string
}): EnvironmentIdentityStore {
  configuredStore = createEnvironmentIdentityStore({
    path: join(options.directory, 'environment-identity.json'),
    defaultName: options.defaultName,
  })
  return configuredStore
}

export function configuredEnvironmentIdentityStore(): EnvironmentIdentityStore {
  if (configuredStore === null) {
    throw new Error('environment-identity-store: initEnvironmentIdentityStore has not been called')
  }
  return configuredStore
}
