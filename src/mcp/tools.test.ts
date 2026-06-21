import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { callTool } from './tools'

const dir = join(tmpdir(), 'porcelain-tools-test')
const file = join(dir, 'review-sets.json')
const notesFile = join(dir, 'notes.json')
const layersFile = join(dir, 'layers.json')

beforeEach(() => {
  process.env.PORCELAIN_REVIEW_SETS = file
  process.env.PORCELAIN_NOTES = notesFile
  process.env.PORCELAIN_LAYERS = layersFile
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_REVIEW_SETS
  delete process.env.PORCELAIN_NOTES
  delete process.env.PORCELAIN_LAYERS
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
  it('get_repo_notes reads the human notes scratchpad', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(notesFile, JSON.stringify({ '/repo': '# conventions\n- no any' }))
    const text = await callTool('get_repo_notes', { repoPath: '/repo' })
    expect(text).toContain('# conventions')
    expect(await callTool('get_repo_notes', { repoPath: '/other' })).toContain('No project notes')
  })
  it('get_flow_layers shows the defaults when none are custom', async () => {
    const text = await callTool('get_flow_layers', { repoPath: '/repo' })
    expect(text).toContain('built-in defaults')
  })
  it('set_flow_layers writes a repo-keyed ordered set', async () => {
    await callTool('set_flow_layers', {
      repoPath: '/repo',
      layers: [{ label: 'Pages', pattern: '(^|/)pages/' }],
    })
    const text = await callTool('get_flow_layers', { repoPath: '/repo' })
    expect(text).toContain('Custom flow layers')
    expect(text).toContain('Pages')
  })
  it('set_flow_layers rejects an invalid regex', async () => {
    await expect(
      callTool('set_flow_layers', { repoPath: '/repo', layers: [{ label: 'Bad', pattern: '(' }] }),
    ).rejects.toThrow('valid regular expression')
  })
  it('reset_flow_layers drops the custom set', async () => {
    await callTool('set_flow_layers', {
      repoPath: '/repo',
      layers: [{ label: 'Pages', pattern: '(^|/)pages/' }],
    })
    await callTool('reset_flow_layers', { repoPath: '/repo' })
    expect(await callTool('get_flow_layers', { repoPath: '/repo' })).toContain('built-in defaults')
  })
})
