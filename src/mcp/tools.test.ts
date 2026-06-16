import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { callTool } from './tools'

const dir = join(tmpdir(), 'porcelain-tools-test')
const file = join(dir, 'review-sets.json')

beforeEach(() => {
  process.env.PORCELAIN_REVIEW_SETS = file
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_REVIEW_SETS
  rmSync(dir, { recursive: true, force: true })
})
const read = (): Record<string, { name: string; files: unknown[] }> =>
  JSON.parse(readFileSync(file, 'utf8'))

describe('callTool', () => {
  it('requires repoPath', async () => {
    await expect(callTool('set_feature_review', { files: [] })).rejects.toThrow(
      'repoPath is required',
    )
  })
  it('rejects an unknown tool', async () => {
    await expect(callTool('bogus', { repoPath: '/repo' })).rejects.toThrow('unknown tool')
  })
  it('set_feature_review writes a repo-keyed set', async () => {
    await callTool('set_feature_review', {
      repoPath: '/repo',
      name: 'X',
      files: [{ path: 'a.ts' }],
    })
    expect(read()['/repo']).toEqual({ name: 'X', files: [{ path: 'a.ts' }] })
  })
  it('add_review_files merges into the existing set', async () => {
    await callTool('set_feature_review', { repoPath: '/repo', files: [{ path: 'a.ts' }] })
    await callTool('add_review_files', { repoPath: '/repo', files: [{ path: 'b.ts' }] })
    expect(read()['/repo']?.files).toEqual([{ path: 'a.ts' }, { path: 'b.ts' }])
  })
  it('clear_feature_review removes the set', async () => {
    await callTool('set_feature_review', { repoPath: '/repo', files: [{ path: 'a.ts' }] })
    await callTool('clear_feature_review', { repoPath: '/repo' })
    expect(read()['/repo']).toBeUndefined()
  })
  it('get_feature_review describes the stored set', async () => {
    await callTool('set_feature_review', {
      repoPath: '/repo',
      name: 'X',
      files: [{ path: 'a.ts' }],
    })
    const text = await callTool('get_feature_review', { repoPath: '/repo' })
    expect(text).toContain('Feature review "X" for /repo')
  })
})
