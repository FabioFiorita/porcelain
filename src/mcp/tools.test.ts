import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { callTool } from './tools'

const dir = join(tmpdir(), 'porcelain-tools-test')
const file = join(dir, 'review-sets.json')
const notesFile = join(dir, 'notes.json')
const layersFile = join(dir, 'layers.json')
const reviewedFile = join(dir, 'reviewed.json')
const boardFile = join(dir, 'board.json')
const actionsFile = join(dir, 'actions.json')
const commentsFile = join(dir, 'comments.json')
const featureViewFile = join(dir, 'feature-view.json')

beforeEach(() => {
  process.env.PORCELAIN_REVIEW_SETS = file
  process.env.PORCELAIN_NOTES = notesFile
  process.env.PORCELAIN_LAYERS = layersFile
  process.env.PORCELAIN_REVIEWED = reviewedFile
  process.env.PORCELAIN_BOARD = boardFile
  process.env.PORCELAIN_ACTIONS = actionsFile
  process.env.PORCELAIN_COMMENTS = commentsFile
  process.env.PORCELAIN_FEATURE_VIEW = featureViewFile
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_REVIEW_SETS
  delete process.env.PORCELAIN_NOTES
  delete process.env.PORCELAIN_LAYERS
  delete process.env.PORCELAIN_REVIEWED
  delete process.env.PORCELAIN_BOARD
  delete process.env.PORCELAIN_ACTIONS
  delete process.env.PORCELAIN_COMMENTS
  delete process.env.PORCELAIN_FEATURE_VIEW
  rmSync(dir, { recursive: true, force: true })
})
const read = (): Record<string, { name: string; files: unknown[] }> =>
  JSON.parse(readFileSync(file, 'utf8'))
const readBoard = (): Record<string, unknown[]> => JSON.parse(readFileSync(boardFile, 'utf8'))
const readActions = (): Record<string, unknown[]> => JSON.parse(readFileSync(actionsFile, 'utf8'))

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
  it('get_feature_view describes the app-computed snapshot, or hints when absent', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      featureViewFile,
      JSON.stringify({
        '/repo': { name: 'X', files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }] },
      }),
    )
    expect(await callTool('get_feature_view', { repoPath: '/repo' })).toContain(
      'Feature view "X" for /repo',
    )
    expect(await callTool('get_feature_view', { repoPath: '/other' })).toContain(
      'No feature view computed',
    )
  })

  it('get_review_comments tags each comment with its feature-view source', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      commentsFile,
      JSON.stringify({
        '/repo': [
          { id: 'c1', path: 'server/svc.ts', body: 'check', resolved: false, createdAt: 1 },
        ],
      }),
    )
    writeFileSync(
      featureViewFile,
      JSON.stringify({
        '/repo': { name: 'X', files: [{ path: 'server/svc.ts', source: 'shipped', layer: 'Svc' }] },
      }),
    )
    const text = await callTool('get_review_comments', { repoPath: '/repo' })
    expect(text).toContain('[c1] server/svc.ts (shipped)')
  })

  it('get_repo_notes reads the human notes scratchpad', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(notesFile, JSON.stringify({ '/repo': '# conventions\n- no any' }))
    const text = await callTool('get_repo_notes', { repoPath: '/repo' })
    expect(text).toContain('# conventions')
    expect(await callTool('get_repo_notes', { repoPath: '/other' })).toContain('No project notes')
  })
  it('get_reviewed_files lists the human-reviewed paths', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(reviewedFile, JSON.stringify({ '/repo': ['src/a.ts', 'src/b.ts'] }))
    const text = await callTool('get_reviewed_files', { repoPath: '/repo' })
    expect(text).toContain('src/a.ts')
    expect(text).toContain('src/b.ts')
    expect(await callTool('get_reviewed_files', { repoPath: '/other' })).toContain(
      'No files marked reviewed',
    )
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

describe('board + actions', () => {
  it('create_card with a title writes a card in todo by default', async () => {
    await callTool('create_card', { repoPath: '/repo', title: 'Ship it' })
    const cards = readBoard()['/repo'] as Array<{ title: string; status: string }>
    expect(cards).toHaveLength(1)
    expect(cards[0]?.title).toBe('Ship it')
    expect(cards[0]?.status).toBe('todo')
  })

  it('create_card without title rejects with "title is required"', async () => {
    await expect(callTool('create_card', { repoPath: '/repo' })).rejects.toThrow(
      'title is required',
    )
  })

  it('update_card edits the title and body of an existing card', async () => {
    await callTool('create_card', { repoPath: '/repo', title: 'Old' })
    const id = (readBoard()['/repo'] as Array<{ id: string }>)[0]?.id as string
    const result = await callTool('update_card', {
      repoPath: '/repo',
      id,
      title: 'New',
      body: 'detail',
    })
    expect(result).toContain('Updated card')
    const cards = readBoard()['/repo'] as Array<{ title: string; body: string }>
    expect(cards[0]?.title).toBe('New')
    expect(cards[0]?.body).toBe('detail')
  })

  it('move_card to a valid status moves it', async () => {
    await callTool('create_card', { repoPath: '/repo', title: 'Task' })
    const id = (readBoard()['/repo'] as Array<{ id: string }>)[0]?.id as string
    const result = await callTool('move_card', { repoPath: '/repo', id, status: 'doing' })
    expect(result).toContain('Moved card')
    const cards = readBoard()['/repo'] as Array<{ status: string }>
    expect(cards[0]?.status).toBe('doing')
  })

  it('move_card with a bad status rejects with "status must be one of todo|doing|done"', async () => {
    await callTool('create_card', { repoPath: '/repo', title: 'Task' })
    const id = (readBoard()['/repo'] as Array<{ id: string }>)[0]?.id as string
    await expect(
      callTool('move_card', { repoPath: '/repo', id, status: 'invalid' }),
    ).rejects.toThrow('status must be one of todo|doing|done')
  })

  it('move_card for a missing id returns the "No card" string without throwing', async () => {
    const result = await callTool('move_card', {
      repoPath: '/repo',
      id: 'no-such-id',
      status: 'done',
    })
    expect(result).toContain('No card')
  })

  it('delete_card removes the card', async () => {
    await callTool('create_card', { repoPath: '/repo', title: 'Gone' })
    const id = (readBoard()['/repo'] as Array<{ id: string }>)[0]?.id as string
    const result = await callTool('delete_card', { repoPath: '/repo', id })
    expect(result).toContain('Deleted card')
    expect((readBoard()['/repo'] as unknown[]).length).toBe(0)
  })

  it('create_action with title+command writes an action', async () => {
    await callTool('create_action', { repoPath: '/repo', title: 'Dev', command: 'pnpm dev' })
    const actions = readActions()['/repo'] as Array<{ title: string; command: string }>
    expect(actions).toHaveLength(1)
    expect(actions[0]?.title).toBe('Dev')
    expect(actions[0]?.command).toBe('pnpm dev')
  })

  it('create_action without command rejects with "command is required"', async () => {
    await expect(callTool('create_action', { repoPath: '/repo', title: 'Dev' })).rejects.toThrow(
      'command is required',
    )
  })

  it('update_action edits the title and command', async () => {
    await callTool('create_action', { repoPath: '/repo', title: 'Dev', command: 'pnpm dev' })
    const id = (readActions()['/repo'] as Array<{ id: string }>)[0]?.id as string
    const result = await callTool('update_action', {
      repoPath: '/repo',
      id,
      title: 'Build',
      command: 'pnpm build',
    })
    expect(result).toContain('Updated action')
    const actions = readActions()['/repo'] as Array<{ title: string; command: string }>
    expect(actions[0]?.title).toBe('Build')
    expect(actions[0]?.command).toBe('pnpm build')
  })

  it('delete_action removes the action', async () => {
    await callTool('create_action', { repoPath: '/repo', title: 'Dev', command: 'pnpm dev' })
    const id = (readActions()['/repo'] as Array<{ id: string }>)[0]?.id as string
    const result = await callTool('delete_action', { repoPath: '/repo', id })
    expect(result).toContain('Deleted action')
    expect((readActions()['/repo'] as unknown[]).length).toBe(0)
  })
})
