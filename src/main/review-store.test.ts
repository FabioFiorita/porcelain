import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearReviewSet } from './review-store'

describe('clearReviewSet', () => {
  const file = join(tmpdir(), 'porcelain-review-store-test', 'review-sets.json')
  const write = (data: unknown): void => {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(data))
  }
  const read = (): Record<string, unknown> => JSON.parse(readFileSync(file, 'utf8'))

  beforeEach(() => {
    process.env.PORCELAIN_REVIEW_SETS = file
    rmSync(dirname(file), { recursive: true, force: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_REVIEW_SETS
    rmSync(dirname(file), { recursive: true, force: true })
  })

  it('removes only the target repo, leaving the others', async () => {
    write({
      '/repo': { name: 'A', files: [{ path: 'a.ts' }] },
      '/other': { name: 'B', files: [{ path: 'b.ts' }] },
    })
    await clearReviewSet('/repo')
    const all = read()
    expect(all['/repo']).toBeUndefined()
    expect(all['/other']).toBeDefined()
  })

  it('is a no-op when the repo has no set', async () => {
    write({ '/other': { name: 'B', files: [] } })
    await clearReviewSet('/repo')
    expect(read()['/other']).toBeDefined()
  })

  it('is a no-op (no throw) when the file is absent', async () => {
    await expect(clearReviewSet('/repo')).resolves.toBeUndefined()
  })
})
