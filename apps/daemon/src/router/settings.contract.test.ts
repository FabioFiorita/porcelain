// @vitest-environment node
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'
import { createSettingsRouter } from './settings'

const settingsRouter = createSettingsRouter()

const REQUEST_ID = '00000000-0000-4000-8000-000000000019'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const

function caller() {
  return settingsRouter.createCaller(PUBLIC_CONTEXT)
}

/** Deliver raw untrusted input the typed caller cannot express — the wire's own entry point. */
async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router: settingsRouter,
    path,
    type,
    ctx: PUBLIC_CONTEXT,
    getRawInput: async () => input,
    signal: undefined,
    batchIndex: 0,
  })
}

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

function expectPublicCode(error: unknown, code: string, unexpected: boolean) {
  const normalized = normalizePublicError(error, REQUEST_ID)
  expect(normalized.unexpected).toBe(unexpected)
  expect(publicErrorSchema.parse(normalized.error)).toMatchObject({ code, requestId: REQUEST_ID })
}

let root = ''
let repo = ''

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-settings-contract-'))
  repo = join(root, 'repo')
  await mkdir(repo, { recursive: true })
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('settings router contract', () => {
  it('owns only repoScope', () => {
    expect(Object.keys(settingsRouter._def.procedures)).toEqual(['repoScope'])
  })

  it('rejects an object where a bare repository-path query is contracted', async () => {
    expectPublicCode(
      await rejected(() => callWithRawInput('repoScope', 'query', { repoPath: repo })),
      'request.invalid',
      false,
    )
  })

  it('serializes an unconfigured repo scope as two empty arrays', async () => {
    expect(await caller().repoScope(repo)).toEqual({ hiddenPaths: [], pinnedPaths: [] })
  })
})
