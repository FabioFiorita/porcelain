import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { taskSchema } from '@porcelain/contracts/tasks'
import { migrateCompanion } from '@shared/companion-migration'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJsonActionsStore } from '../actions'
import { createCanvasStore } from '../projects'
import { createTasksStore } from '../tasks'
import { createCompanionMigration } from './companion-migration-operation'

/**
 * Two things this suite owns that the shared conversion tests cannot:
 *
 * 1. **The daemon's own stores read back what the migration wrote.** The shared
 *    module writes the store formats by hand (it is also the CLI's routine and
 *    the CLI may not import the daemon), so the only thing standing between a
 *    silent format drift and a corrupt table is an assertion that the real
 *    `createCanvasStore` / `createTasksStore` / `createJsonActionsStore` parse it.
 * 2. **The explicit target.** A `path` that is not a live Worktree of `projectId`
 *    is refused rather than guessed at.
 */

const PROJECT_ID = 'project-1'

let root: string
let repo: string
let home: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-migration-daemon-'))
  repo = join(root, 'repo')
  home = join(root, 'home')
  await mkdir(join(repo, '.porcelain'), { recursive: true })
  await mkdir(home, { recursive: true })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const companion = (...parts: string[]): string => join(repo, '.porcelain', ...parts)

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, JSON.stringify(value, null, 2))
}

async function seedCompanion(): Promise<void> {
  await writeJson(companion('active-review', 'review.json'), {
    name: 'Ship the review layer',
    thesis: 'Agent work has to become trusted work.',
    files: [],
    sections: [],
  })
  await writeJson(companion('board.json'), {
    version: 1,
    cards: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Fix the tree',
        status: 'doing',
        order: 0,
        createdAt: 1_700_000_000_000,
      },
    ],
  })
  await writeJson(companion('actions.json'), {
    version: 1,
    actions: [{ id: 'a1', title: 'Verify', command: 'pnpm verify', order: 0, createdAt: 1 }],
  })
}

describe('migrated data is readable by the daemon stores that own it', () => {
  it('lands a Review Canvas, a Task, and an Action the real stores parse', async () => {
    await seedCompanion()

    await migrateCompanion({
      repoPath: repo,
      homeDir: home,
      projectId: PROJECT_ID,
      worktreeId: 'worktree-1',
    })

    const canvases = await createCanvasStore({ homeDir: home }).listCanvases(PROJECT_ID)
    expect(canvases.ok && canvases.value).toMatchObject([
      { title: 'Ship the review layer', template: 'review' },
    ])

    const tasks = await createTasksStore({ homeDir: home }).read()
    expect(tasks.ok).toBe(true)
    expect(tasks.ok && tasks.value).toHaveLength(1)
    // The wire schema, not a hand-rolled shape: one bad field makes the WHOLE
    // table read as corrupt in production, so the migration's row is pinned to it.
    expect(taskSchema.safeParse(tasks.ok ? tasks.value[0] : null).success).toBe(true)

    const actions = await createJsonActionsStore({ homeDir: home }).read(PROJECT_ID)
    expect(actions.ok && actions.value.actions.map((action) => action.title)).toEqual(['Verify'])
  })

  it('serves the migrated Canvas entry document with its four sections', async () => {
    await seedCompanion()
    await migrateCompanion({ repoPath: repo, homeDir: home, projectId: PROJECT_ID })

    const store = createCanvasStore({ homeDir: home })
    const listed = await store.listCanvases(PROJECT_ID)
    const id = listed.ok ? (listed.value[0]?.id ?? '') : ''
    const entry = await store.readCanvasEntry(PROJECT_ID, id)

    expect(entry.ok && entry.value.content).toContain('## Evidence')
  })
})

describe('explicit migration target', () => {
  function operation(worktrees: readonly { id: string; path: string }[]) {
    return createCompanionMigration({
      homeDir: home,
      worktrees: { listWorktrees: async () => ({ ok: true, value: worktrees }) },
    })
  }

  it('runs against the checkout the caller named', async () => {
    await seedCompanion()

    const result = await operation([{ id: 'worktree-1', path: repo }]).migrateCompanion({
      projectId: PROJECT_ID,
      path: repo,
      dryRun: true,
    })

    expect(result.ok && result.value.dryRun).toBe(true)
    expect(result.ok && result.value.counts.converted).toBe(3)
  })

  it('refuses a path that is not a Worktree of this Project', async () => {
    const other = join(root, 'elsewhere')
    await mkdir(other, { recursive: true })

    const result = await operation([{ id: 'worktree-1', path: repo }]).migrateCompanion({
      projectId: PROJECT_ID,
      path: other,
    })

    expect(result).toEqual({ ok: false, error: { code: 'request.invalid' } })
  })

  it('refuses when the Project has no Worktrees to check against', async () => {
    const migration = createCompanionMigration({
      homeDir: home,
      worktrees: { listWorktrees: async () => ({ ok: false }) },
    })

    const result = await migration.migrateCompanion({ projectId: PROJECT_ID, path: repo })

    expect(result).toEqual({ ok: false, error: { code: 'request.invalid' } })
  })

  it('passes the resolved Worktree id and the full Worktree list to the conversion', async () => {
    const run = vi.fn(migrateCompanion)
    const worktrees = [{ id: 'worktree-1', path: repo }]
    const migration = createCompanionMigration({
      homeDir: home,
      worktrees: { listWorktrees: async () => ({ ok: true, value: worktrees }) },
      run,
    })

    await migration.migrateCompanion({ projectId: PROJECT_ID, path: repo })

    expect(run).toHaveBeenCalledWith({
      repoPath: repo,
      homeDir: home,
      projectId: PROJECT_ID,
      worktreeId: 'worktree-1',
      worktrees,
      dryRun: false,
    })
  })
})
