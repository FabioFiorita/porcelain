import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StoredThread } from './thread-store'
import { deleteThreadFile, listThreadFiles, readThread, writeThread } from './thread-store'

const dir = join(tmpdir(), 'porcelain-thread-store-test')

const sample = (id: string): StoredThread => ({
  meta: {
    id,
    repoPath: '/repo',
    title: 'A thread',
    provider: 'claude',
    model: 'sonnet',
    mode: 'full',
    createdAt: 1,
    updatedAt: 2,
  },
  sessionState: { resume: 'abc' },
  items: [{ kind: 'user', id: 'u1', text: 'hi' }],
})

beforeEach(() => {
  process.env.PORCELAIN_AGENT_THREADS = dir
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_AGENT_THREADS
  rmSync(dir, { recursive: true, force: true })
})

describe('thread-store', () => {
  it('writes a thread and reads it back', async () => {
    await writeThread('t1', sample('t1'))
    expect(await readThread('t1')).toEqual(sample('t1'))
  })

  it('returns null for an absent thread', async () => {
    expect(await readThread('nope')).toBeNull()
  })

  it('returns null (not throw) for a corrupt file', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 't1.json'), '{ not valid json')
    expect(await readThread('t1')).toBeNull()
  })

  it('returns null for a schema-invalid file', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 't1.json'), JSON.stringify({ meta: { id: 't1' } }))
    expect(await readThread('t1')).toBeNull()
  })

  it('lists thread ids, ignoring tmp and non-json entries', async () => {
    await writeThread('a', sample('a'))
    await writeThread('b', sample('b'))
    writeFileSync(join(dir, 'stray.txt'), 'x')
    writeFileSync(join(dir, 'c.json.tmp'), 'x')
    expect((await listThreadFiles()).sort()).toEqual(['a', 'b'])
  })

  it('returns [] when the directory does not exist', async () => {
    expect(await listThreadFiles()).toEqual([])
  })

  it('deletes a thread file and is idempotent', async () => {
    await writeThread('t1', sample('t1'))
    await deleteThreadFile('t1')
    expect(await readThread('t1')).toBeNull()
    await deleteThreadFile('t1') // no throw on a second delete
  })
})
