import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { expect, loc, openSurface, TestIds, test, waitForShell } from './helpers/app'
import { PNG_1PX, runFixtureCli } from './helpers/review-fixture'

const MIGRATED_CARD = '22222222-2222-4222-8222-222222222222'

async function waitForProject(homeDir: string): Promise<{ projectId: string; worktreeId: string }> {
  const inventoryPath = join(homeDir, 'hub-inventory.json')
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const parsed = JSON.parse(await readFile(inventoryPath, 'utf8')) as {
        value: { projects: { id: string; worktrees: { id: string }[] }[] }
      }
      const project = parsed.value.projects[0]
      const worktree = project?.worktrees[0]
      if (project !== undefined && worktree !== undefined) {
        return { projectId: project.id, worktreeId: worktree.id }
      }
    } catch {
      // Inventory is written asynchronously on first project open.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('hub inventory did not produce a Project + Worktree')
}

/** The retiring repo-local shape, deliberately used only to exercise migration. */
async function seedLegacy(repoDir: string): Promise<void> {
  const companion = join(repoDir, '.porcelain')
  const review = join(companion, 'active-review')
  await mkdir(join(review, 'evidence', 'assets'), { recursive: true })
  await writeFile(
    join(review, 'review.json'),
    JSON.stringify({
      name: 'Migrated Review Canvas',
      thesis: 'A legacy story becomes a daemon-root Canvas.',
      files: [{ path: 'README.md', source: 'changed' }],
      sections: [
        {
          title: 'Migration',
          prose: 'The old companion is read once.',
          html: '<p id="migration-proof">The old companion is read once.</p>',
          anchors: [],
        },
      ],
    }),
  )
  await writeFile(
    join(review, 'evidence', 'meta.json'),
    JSON.stringify({
      title: 'Migrated evidence',
      repoPath: repoDir,
      updatedAt: '2026-08-15T00:00:00.000Z',
      checks: [{ label: 'migration proof', status: 'pass' }],
    }),
  )
  await writeFile(join(review, 'evidence', 'assets', 'migration.png'), PNG_1PX)
  await writeFile(
    join(companion, 'board.json'),
    JSON.stringify({
      version: 1,
      cards: [
        { id: MIGRATED_CARD, title: 'Migrated task', status: 'doing', order: 0, createdAt: 1 },
      ],
    }),
  )
  await writeFile(
    join(companion, 'actions.json'),
    JSON.stringify({
      version: 1,
      actions: [
        {
          id: 'migrated-echo',
          title: 'Migrated action',
          command: 'echo migrated-action',
          order: 0,
          createdAt: 1,
        },
      ],
    }),
  )
}

async function seedCanvas(homeDir: string, projectId: string, worktreeId: string): Promise<void> {
  const indexPath = canvasIndexPath(homeDir, projectId)
  const current = JSON.parse(await readFile(indexPath, 'utf8')) as {
    value: { canvases: Record<string, unknown>[] }
  }
  const record = {
    id: 'composed-notes',
    worktreeId,
    title: 'Composed notes',
    kind: 'html',
    entryFile: 'index.html',
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
  }
  current.value.canvases = [...current.value.canvases, record]
  await writeFile(indexPath, JSON.stringify(current))
  const bundle = canvasBundleDir(homeDir, projectId, 'composed-notes')
  await mkdir(bundle, { recursive: true })
  await writeFile(
    join(bundle, 'index.html'),
    '<!doctype html><html><body><h1 id="proof">Composed notes</h1></body></html>',
  )
}

test.setTimeout(120_000)

test('composed daemon proof: targets, Canvas Review, migration, Tasks, Actions, and process lifetime', async ({
  page,
  repoDir,
  seeded,
}) => {
  await waitForShell(page)
  // Process lifetime: start this while the default Glance surface owns the
  // daemon-backed process section, then prove it survives the renderer reload.
  await expect(loc.devServers(page)).toBeVisible()
  await loc.devServerLabelInput(page).fill('composed process')
  await loc
    .devServerCommandInput(page)
    .fill(
      'node -e \'require("http").createServer(function(q,s){s.end("alive")}).listen(0,"127.0.0.1")\'',
    )
  await loc.devServerSubmit(page).click()
  const processRow = loc.devServerRows(page).first()
  await expect(processRow).toBeVisible({ timeout: 30_000 })
  const processId = (await processRow.getAttribute('data-testid'))?.replace('dev-server-', '')
  if (processId === undefined) throw new Error('process row has no id')
  await page.reload()
  await waitForShell(page)
  await expect(loc.devServerRow(page, processId)).toHaveAttribute('data-status', 'running', {
    timeout: 30_000,
  })

  const { projectId, worktreeId } = await waitForProject(seeded.udBase)
  await seedLegacy(repoDir)
  await runFixtureCli(['migrate', 'apply', '--repo', repoDir], seeded.env, repoDir)
  await seedCanvas(seeded.udBase, projectId, worktreeId)
  const migratedIndex = JSON.parse(
    await readFile(canvasIndexPath(seeded.udBase, projectId), 'utf8'),
  ) as {
    value: { canvases: { id: string; template?: string }[] }
  }
  const migratedReview = migratedIndex.value.canvases.find((canvas) => canvas.template === 'review')
  if (migratedReview === undefined) throw new Error('migration did not create a Review Canvas')
  await page.reload()
  await waitForShell(page)

  // Multiple Worktrees and explicit target-aware tabs/splits.
  const original = await loc.hubWorktrees(page).first().getAttribute('data-testid')
  const projectTestId = await loc.hubProjects(page).first().getAttribute('data-testid')
  if (original === null || projectTestId === null) throw new Error('missing Hub target')
  const project = projectTestId.replace('hub-project-', '')
  await loc.hubCreateWorktree(page, project).click()
  await loc.hubCreateWorktreeBranch(page).fill('composed-proof')
  await loc.hubCreateWorktreeSubmit(page).click()
  await expect(loc.hubWorktrees(page)).toHaveCount(2)
  const worktreeIds = await loc
    .hubWorktrees(page)
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute('data-testid'))
        .filter((id): id is string => id !== null),
    )
  const other = worktreeIds.find((id) => id !== original)
  if (other === undefined) throw new Error('second Worktree did not appear')
  await loc.hubWorktree(page, original.replace('hub-worktree-', '')).click()
  await selectFilesAndSplit(page)
  await expect(loc.hubTabTargets(page, original.replace('hub-worktree-', ''))).toHaveCount(2)

  // Review is the structured Canvas template, and its Evidence is visible after migration.
  await openSurface(page, 'Canvas')
  await expect(loc.canvasListItem(page, 'composed-notes')).toBeVisible()
  await loc.canvasListItem(page, 'composed-notes').click()
  await expect(
    page.frameLocator(`[data-testid="${TestIds.canvasIframe}"]`).locator('#proof'),
  ).toHaveText('Composed notes')
  await openSurface(page, 'Canvas')
  await loc.canvasListItem(page, migratedReview.id).click()
  const reviewFrame = page.frameLocator(`[data-testid="${TestIds.canvasIframe}"]`)
  await expect(reviewFrame.locator('h1')).toHaveText('Migrated Review Canvas')
  await expect(reviewFrame.locator('#evidence')).toContainText('migration proof')
  await expect(reviewFrame.locator('#evidence img')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/,
  )

  // Migration produced daemon-root Tasks and Actions, not repo-local companions.
  await openSurface(page, 'Tasks')
  await loc.tasksOpen(page).click()
  await expect(loc.tasksRow(page, MIGRATED_CARD)).toContainText('Migrated task')
  await loc.actionsMenu(page).click()
  await expect(loc.actionRun(page, 'Migrated action')).toBeVisible()
})

async function selectFilesAndSplit(page: Parameters<typeof waitForShell>[0]): Promise<void> {
  await openSurface(page, 'Files')
  await loc.treeEntry(page, 'README.md').click()
  await expect(loc.viewerTab(page, 'README.md')).toBeVisible()
  await loc.viewerTab(page, 'README.md').click({ button: 'right' })
  await loc.viewerTabOpenToSide(page).click()
  await expect(page.locator('[data-hub-worktree]').first()).toBeVisible()
}
