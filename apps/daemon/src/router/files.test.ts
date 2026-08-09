// @vitest-environment node
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publicErrorSchema } from '@porcelain/contracts'
import { afterEach, describe, expect, it } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'
import { filesRouter } from './files'

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'
const directories: string[] = []

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('files router expected failures', () => {
  it('maps an existing rename destination to state.conflict without overwriting it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'porcelain-files-router-'))
    directories.push(directory)
    const from = join(directory, 'from.txt')
    const to = join(directory, 'to.txt')
    await writeFile(from, 'source')
    await writeFile(to, 'destination')

    const caller = filesRouter.createCaller({ auth: { kind: 'admin' }, requestId: REQUEST_ID })
    const error = await rejected(() => caller.renamePath({ from, to }))
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'state.conflict',
      requestId: REQUEST_ID,
    })
    expect(await readFile(to, 'utf8')).toBe('destination')
    expect(existsSync(from)).toBe(true)
  })
})
