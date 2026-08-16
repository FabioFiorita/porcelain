import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { canvasBundleDir, canvasIndexPath, projectCanvasesDir } from './canvas-porcelain'
import {
  type MigrationReport,
  migrateCompanion,
  renderMigrationReport,
} from './companion-migration'
import { inferWorktree } from './companion-migration-records'
import { readMigrationLedger } from './companion-migration-store'
import {
  projectActionsPath,
  projectMigrationLedgerPath,
  projectOverridesPath,
} from './project-store'
import { htmlFragment } from './review-canvas'
import { tasksIndexPath } from './tasks-porcelain'

const PROJECT_ID = 'project-under-test'
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

let root: string
let repo: string
let home: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-migration-'))
  repo = join(root, 'repo')
  home = join(root, 'home')
  await mkdir(join(repo, '.porcelain'), { recursive: true })
  await mkdir(home, { recursive: true })
})

afterEach(async () => {
  // The failure test drops write permission on a directory; restore it or rm fails.
  await chmod(projectCanvasesDir(home, PROJECT_ID), 0o700).catch(() => undefined)
  await rm(root, { recursive: true, force: true })
})

const companion = (...parts: string[]): string => join(repo, '.porcelain', ...parts)

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, JSON.stringify(value, null, 2))
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
}

/** A review directory shaped exactly like the legacy companion wrote one. */
async function seedReview(
  dir: string,
  options: { html?: boolean; withAssets?: boolean; archivedId?: string } = {},
): Promise<void> {
  await writeJson(join(dir, 'review.json'), {
    name: 'Ship the review layer',
    thesis: 'Agent work has to become trusted work.',
    files: [{ path: 'apps/daemon/src/server.ts', source: 'changed', note: 'the entry point' }],
    sections: [
      {
        title: 'How it was built',
        prose: 'One store, two readers.',
        ...(options.html === true
          ? {
              html: '<html><head><style>b{color:red}</style></head><body><b>diagram</b></body></html>',
            }
          : {}),
        anchors: [],
      },
    ],
  })
  await writeJson(join(dir, 'intent', 'meta.json'), {
    version: 1,
    tabs: [{ file: 'why.md', label: 'Why' }],
  })
  await writeFile(join(dir, 'intent', 'why.md'), '# Why\n\nBecause the loop must close.\n')
  await writeJson(join(dir, 'evidence', 'meta.json'), {
    title: 'Proof',
    repoPath: repo,
    updatedAt: '2026-08-01T00:00:00.000Z',
    checks: [{ label: 'pnpm test', status: 'pass', detail: '1348 passed' }],
  })
  await mkdir(join(dir, 'evidence', 'results'), { recursive: true })
  await writeFile(join(dir, 'evidence', 'results', 'index.md'), '# Results\n\nAll green.\n')
  if (options.withAssets !== false) {
    await mkdir(join(dir, 'evidence', 'assets'), { recursive: true })
    await writeFile(join(dir, 'evidence', 'assets', 'shot.png'), PNG)
  }
  if (options.archivedId !== undefined) {
    await writeJson(join(dir, 'meta.json'), {
      id: options.archivedId,
      name: `Archived ${options.archivedId}`,
      archivedAt: '2026-07-01T00:00:00.000Z',
    })
  }
}

function run(
  overrides: Partial<Parameters<typeof migrateCompanion>[0]> = {},
): Promise<MigrationReport> {
  return migrateCompanion({
    repoPath: repo,
    homeDir: home,
    projectId: PROJECT_ID,
    worktreeId: 'worktree-1',
    now: () => '2026-08-15T12:00:00.000Z',
    ...overrides,
  })
}

async function canvasIndex(): Promise<Record<string, unknown>[]> {
  const envelope = await readJson(canvasIndexPath(home, PROJECT_ID))
  const value = envelope.value as { canvases: Record<string, unknown>[] }
  return value.canvases
}

describe('review → Canvas', () => {
  it('builds an HTML Review Canvas with the four sections and the evidence image', async () => {
    await seedReview(companion('active-review'), { html: true })

    const report = await run()

    const [canvas] = await canvasIndex()
    expect(canvas).toMatchObject({
      title: 'Ship the review layer',
      kind: 'html',
      entryFile: 'index.html',
      template: 'review',
      worktreeId: 'worktree-1',
    })
    const bundle = canvasBundleDir(home, PROJECT_ID, String(canvas?.id))
    const entry = await readFile(join(bundle, 'index.html'), 'utf8')
    expect(entry).toContain('<section id="intent">')
    expect(entry).toContain('<section id="process">')
    expect(entry).toContain('<section id="execution">')
    expect(entry).toContain('<section id="evidence">')
    // Intent, Process, Execution, Evidence each carry their legacy source.
    expect(entry).toContain('Agent work has to become trusted work.')
    expect(entry).toContain('One store, two readers.')
    expect(entry).toContain('apps/daemon/src/server.ts')
    expect(entry).toContain('pnpm test')
    expect(entry).toContain('<img src="assets/shot.png"')
    // The legacy section HTML arrives as a fragment, not a nested document.
    expect(entry).toContain('<b>diagram</b>')
    expect(entry).not.toContain('<head><style>')
    expect(await readFile(join(bundle, 'assets', 'shot.png'))).toEqual(PNG)
    expect(report.counts.converted).toBeGreaterThanOrEqual(1)
  })

  it('builds a Markdown Canvas when no source carried HTML', async () => {
    await seedReview(companion('active-review'))

    await run()

    const [canvas] = await canvasIndex()
    expect(canvas).toMatchObject({ kind: 'markdown', entryFile: 'index.md' })
    const entry = await readFile(
      join(canvasBundleDir(home, PROJECT_ID, String(canvas?.id)), 'index.md'),
      'utf8',
    )
    expect(entry).toContain('## Intent')
    expect(entry).toContain('## Evidence')
    expect(entry).toContain('![shot.png](assets/shot.png)')
  })

  it('converts archived reviews too, keeping their archived timestamp', async () => {
    await seedReview(companion('reviews', '2026-07-01-alpha'), { archivedId: '2026-07-01-alpha' })

    const report = await run()

    const [canvas] = await canvasIndex()
    expect(canvas).toMatchObject({ createdAt: '2026-07-01T00:00:00.000Z', template: 'review' })
    expect(report.items.some((item) => item.source === '.porcelain/reviews/2026-07-01-alpha')).toBe(
      true,
    )
  })

  it('refuses a traversing or symlinked evidence asset', async () => {
    await seedReview(companion('active-review'))
    const secret = join(root, 'id_rsa')
    await writeFile(secret, 'PRIVATE KEY')
    const assets = companion('active-review', 'evidence', 'assets')
    await symlink(secret, join(assets, 'stolen.png'))
    await symlink(root, join(assets, 'escape'))
    await writeFile(join(assets, '.gitconfig'), 'x')

    await run()

    const [canvas] = await canvasIndex()
    const bundleAssets = join(canvasBundleDir(home, PROJECT_ID, String(canvas?.id)), 'assets')
    await expect(readFile(join(bundleAssets, 'stolen.png'), 'utf8')).rejects.toThrow()
    await expect(readFile(join(bundleAssets, '.gitconfig'), 'utf8')).rejects.toThrow()
    expect(await readFile(join(bundleAssets, 'shot.png'))).toEqual(PNG)
  })
})

describe('board → Tasks', () => {
  const CARD_A = '11111111-1111-4111-8111-111111111111'
  const CARD_B = '22222222-2222-4222-8222-222222222222'
  const CARD_C = '33333333-3333-4333-8333-333333333333'

  beforeEach(async () => {
    await writeJson(companion('board.json'), {
      version: 1,
      cards: [
        {
          id: CARD_A,
          title: 'Fix the tree',
          status: 'doing',
          order: 0,
          createdAt: 1_700_000_000_000,
        },
        {
          id: CARD_B,
          title: 'Land hub-actions',
          body: 'on branch work/hub-actions',
          status: 'todo',
          order: 1,
          createdAt: 1_700_000_001_000,
        },
        { id: CARD_C, title: 'Odd column', status: 'icebox', order: 2, createdAt: 0 },
        { id: 'not-a-card', status: 'todo' },
      ],
    })
  })

  async function tasks(): Promise<Record<string, unknown>[]> {
    const envelope = await readJson(tasksIndexPath(home))
    return (envelope.value as { tasks: Record<string, unknown>[] }).tasks
  }

  it('maps columns to statuses, keeps the card id, and tags an unknown column', async () => {
    await run()

    const rows = await tasks()
    expect(rows.map((task) => task.id)).toEqual([CARD_A, CARD_B, CARD_C])
    expect(rows[0]).toMatchObject({
      title: 'Fix the tree',
      status: 'doing',
      references: { projectId: PROJECT_ID },
      createdAt: new Date(1_700_000_000_000).toISOString(),
    })
    expect(rows[2]).toMatchObject({ status: 'todo', tags: ['migrated'] })
  })

  it('infers the Worktree a card names by branch', async () => {
    await run({
      worktrees: [
        { id: 'wt-main', path: '/checkouts/main', branch: 'main' },
        { id: 'wt-hub', path: '/checkouts/hub', branch: 'work/hub-actions' },
      ],
    })

    const rows = await tasks()
    expect(rows.find((task) => task.id === CARD_B)?.references).toEqual({
      projectId: PROJECT_ID,
      worktreeId: 'wt-hub',
    })
    expect(rows.find((task) => task.id === CARD_A)?.references).toEqual({ projectId: PROJECT_ID })
  })

  it('reports a card it cannot read instead of dropping it silently', async () => {
    const report = await run()

    expect(
      report.items.find(
        (item) => item.source === '.porcelain/board.json' && item.outcome === 'unsupported',
      )?.detail,
    ).toContain('1 card(s)')
  })

  it('never guesses a Worktree from a partial branch match', () => {
    expect(
      inferWorktree(
        { id: 'c', title: 'work/hub-actions-follow-up', status: 'todo', createdAt: 0 },
        [{ id: 'wt', path: '/nowhere', branch: 'work/hub-actions' }],
      ),
    ).toBeUndefined()
  })
})

describe('actions and hide/pin', () => {
  beforeEach(async () => {
    await writeJson(companion('actions.json'), {
      version: 1,
      actions: [
        { id: 'a1', title: 'Dev daemon', command: 'pnpm dev:daemon', order: 0, createdAt: 1 },
        { id: 'a2', title: 'Verify', command: 'pnpm verify', order: 1, createdAt: 2 },
      ],
    })
    await writeJson(projectActionsPath(home, PROJECT_ID), {
      version: 1,
      actions: [
        { id: 'existing', title: 'Verify', command: 'pnpm verify', order: 0, createdAt: 0 },
      ],
    })
    await writeJson(companion('scope.json'), {
      hiddenPaths: ['apps/legacy'],
      pinnedPaths: ['apps/web'],
    })
  })

  it('adds only the Actions the Project store does not already have', async () => {
    const report = await run()

    const stored = await readJson(projectActionsPath(home, PROJECT_ID))
    expect((stored.actions as { title: string }[]).map((action) => action.title)).toEqual([
      'Verify',
      'Dev daemon',
    ])
    expect(report.items.find((item) => item.source === '.porcelain/actions.json#a2')?.outcome).toBe(
      'already-migrated',
    )
  })

  it('writes hide/pin to the PRIVATE Project overrides, never the tracked overlay', async () => {
    await run()

    const stored = await readJson(projectOverridesPath(home, PROJECT_ID))
    expect(stored.value).toEqual({
      hiddenPaths: ['apps/legacy'],
      pinnedPaths: ['apps/web'],
      worktrees: {},
    })
    await expect(readFile(companion('project.json'), 'utf8')).rejects.toThrow()
  })
})

describe('unsupported and retired channels', () => {
  it('reports layers, notes, and terminal image passthrough without copying them', async () => {
    await writeFile(companion('layers.json'), '{"version":1,"layers":[]}')
    await writeFile(companion('notes.md'), 'Standing brief.')

    const report = await run()

    const retired = report.items.filter((item) => item.kind === 'retired')
    expect(retired.map((item) => item.source)).toEqual([
      '.porcelain/layers.json',
      '.porcelain/notes.md',
      'terminal image passthrough',
    ])
    for (const item of retired) expect(item.outcome).toBe('unsupported')
    expect(renderMigrationReport(report)).toContain('Legacy files were left in place')
  })

  it('leaves every legacy file exactly where it was', async () => {
    await seedReview(companion('active-review'))
    await writeFile(companion('notes.md'), 'Standing brief.')

    await run()

    expect(await readFile(companion('notes.md'), 'utf8')).toBe('Standing brief.')
    expect(await readFile(companion('active-review', 'review.json'), 'utf8')).toContain(
      'Ship the review layer',
    )
  })
})

describe('idempotency, dry run, and resume', () => {
  beforeEach(async () => {
    await seedReview(companion('active-review'))
    await writeJson(companion('board.json'), {
      version: 1,
      cards: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Fix the tree',
          status: 'todo',
          order: 0,
          createdAt: 1,
        },
      ],
    })
    await writeJson(companion('scope.json'), { hiddenPaths: ['apps/legacy'], pinnedPaths: [] })
  })

  it('converts nothing twice on a second run', async () => {
    const first = await run()
    expect(first.counts.converted).toBe(3)

    const second = await run()

    expect(second.counts.converted).toBe(0)
    expect(second.counts.alreadyMigrated).toBe(3)
    expect(await canvasIndex()).toHaveLength(1)
    const ledger = await readMigrationLedger(home, PROJECT_ID)
    expect(Object.keys(ledger.entries).sort()).toEqual([
      'board-card:11111111-1111-4111-8111-111111111111',
      'overrides:scope',
      'review:active',
    ])
  })

  it('writes nothing at all on a dry run, and plans the same work', async () => {
    const plan = await run({ dryRun: true })

    expect(plan.dryRun).toBe(true)
    expect(plan.counts.converted).toBe(3)
    await expect(readFile(canvasIndexPath(home, PROJECT_ID), 'utf8')).rejects.toThrow()
    await expect(readFile(tasksIndexPath(home), 'utf8')).rejects.toThrow()
    await expect(readFile(projectMigrationLedgerPath(home, PROJECT_ID), 'utf8')).rejects.toThrow()
    expect(renderMigrationReport(plan)).toContain('nothing was written')
  })

  it('reports a failed item, keeps going, and converts it on the next run', async () => {
    // A Canvas store the process cannot write into: the review fails, everything
    // after it still lands, and the ledger never claims the failure succeeded.
    await mkdir(projectCanvasesDir(home, PROJECT_ID), { recursive: true })
    await chmod(projectCanvasesDir(home, PROJECT_ID), 0o500)

    const first = await run()

    expect(first.counts.failed).toBe(1)
    expect(first.items.find((item) => item.outcome === 'failed')?.kind).toBe('review')
    expect(first.counts.converted).toBe(2)
    expect((await readMigrationLedger(home, PROJECT_ID)).entries['review:active']).toBeUndefined()

    await chmod(projectCanvasesDir(home, PROJECT_ID), 0o700)
    const second = await run()

    expect(second.counts.failed).toBe(0)
    expect(second.items.find((item) => item.kind === 'review')?.outcome).toBe('converted')
    expect(await canvasIndex()).toHaveLength(1)
  })
})

describe('nothing to migrate', () => {
  it('says so when the checkout has no companion directory', async () => {
    await rm(companion(), { recursive: true, force: true })

    const report = await run()

    expect(report.items).toEqual([
      {
        kind: 'retired',
        source: '.porcelain',
        outcome: 'already-migrated',
        detail: 'this checkout has no repo-local companion directory; nothing to migrate',
      },
    ])
  })
})

describe('htmlFragment', () => {
  it('lifts the body out of a full document and passes a fragment through', () => {
    expect(htmlFragment('<html><head><title>t</title></head><body><p>hi</p></body></html>')).toBe(
      '<p>hi</p>',
    )
    expect(htmlFragment('<p>already a fragment</p>')).toBe('<p>already a fragment</p>')
  })
})
