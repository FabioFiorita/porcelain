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

  return Object.freeze({
    read(): Promise<EnvironmentIdentityResult<EnvironmentIdentityRecord>> {
      return serialize<EnvironmentIdentityRecord>(async () => {
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
      })
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
