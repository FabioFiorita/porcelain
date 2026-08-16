import { execFileSync } from 'node:child_process'
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client'
import {
  E2E_BROWSER_TOKEN,
  expect,
  loc,
  openSurface,
  seedIsolatedState,
  spawnDaemon,
  TestIds,
  test,
  waitForShell,
} from './helpers/app'
import { createFixtureRepo } from './helpers/fixture-repo'
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

/**
 * Use the same authenticated HTTP/tRPC boundary as the browser client, but from the Node test
 * process so a second daemon can be observed without pretending the browser shell can fan out.
 * Browser clients intentionally own exactly one daemon session; Electron's shell is the
 * multi-Environment aggregator. The response is still the real daemon contract, not a fixture.
 */
async function daemonQuery<Value>(
  url: string,
  token: string,
  procedure: string,
  input?: unknown,
): Promise<Value> {
  const client = createTRPCUntypedClient({
    links: [
      httpBatchLink({
        url: `${url}/trpc`,
        headers: {
          authorization: `Bearer ${token}`,
          [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
        },
      }),
    ],
  })
  return (await client.query(procedure, input)) as Value
}

async function seedRemoteDaemon(repoDir: string) {
  const seeded = await seedIsolatedState(repoDir, true, null, null)
  const commonGitDir = await realpathGitCommonDir(repoDir)
  await writeFile(
    join(seeded.udBase, 'hub-inventory.json'),
    JSON.stringify({
      version: 1,
      value: {
        projects: [
          {
            id: 'e2e-secondary-project',
            commonGitDir,
            groupingKey: 'name:porcelain-e2e-secondary',
            name: 'porcelain-e2e-secondary',
            worktrees: [{ id: 'e2e-secondary-worktree', gitDir: commonGitDir }],
          },
        ],
      },
    }),
  )
  await seedLegacy(repoDir)
  await runFixtureCli(['migrate', 'apply', '--repo', repoDir], seeded.env, repoDir)
  return seeded
}

async function realpathGitCommonDir(repoDir: string): Promise<string> {
  const relative = execFileSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: repoDir,
    encoding: 'utf8',
  }).trim()
  return realpath(join(repoDir, relative))
}

test.setTimeout(120_000)

test('composed daemon proof: targets, Canvas Review, migration, Tasks, Actions, and process lifetime', async ({
  page,
  repoDir,
  seeded,
}) => {
  const secondaryRepo = join(tmpdir(), 'porcelain-e2e-secondary')
  let secondarySeed: Awaited<ReturnType<typeof seedIsolatedState>> | null = null
  let secondaryChild: Awaited<ReturnType<typeof spawnDaemon>>['child'] | null = null
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

  // Two actual Environment daemons are alive together. The browser renderer intentionally
  // cannot aggregate them (that is Electron shell responsibility), so observe both through
  // their authenticated daemon contracts in this same composed run. Each side has an isolated
  // Playground, home, identity, migrated Canvas, Task, and Action records.
  try {
    await createFixtureRepo(secondaryRepo)
    secondarySeed = await seedRemoteDaemon(secondaryRepo)
    const secondary = await spawnDaemon(secondarySeed, { port: 43220, host: 'e2e-secondary' })
    secondaryChild = secondary.child
    const secondaryUrl = `http://127.0.0.1:${secondary.port}`
    const primaryUrl = new URL(page.url()).origin
    const [primaryIdentity, secondaryIdentity] = await Promise.all([
      daemonQuery<{ host: string }>(primaryUrl, E2E_BROWSER_TOKEN, 'daemonInfo'),
      daemonQuery<{ host: string }>(secondaryUrl, E2E_BROWSER_TOKEN, 'daemonInfo'),
    ])
    expect(primaryIdentity.host).not.toBe(secondaryIdentity.host)
    expect(secondaryIdentity.host).toBe('e2e-secondary')
    const [primaryInventory, secondaryInventory] = await Promise.all([
      daemonQuery<{
        environment: { id: string; name: string }
        projects: { id: string; environmentId: string; worktrees: { id: string }[] }[]
      }>(primaryUrl, E2E_BROWSER_TOKEN, 'hubInventory'),
      daemonQuery<{
        environment: { id: string; name: string }
        projects: { id: string; environmentId: string; worktrees: { id: string }[] }[]
      }>(secondaryUrl, E2E_BROWSER_TOKEN, 'hubInventory'),
    ])
    expect(primaryInventory.environment.id).not.toBe(secondaryInventory.environment.id)
    expect(primaryInventory.projects[0]?.environmentId).toBe(primaryInventory.environment.id)
    expect(secondaryInventory.projects[0]?.environmentId).toBe(secondaryInventory.environment.id)
    expect(secondaryInventory.projects[0]?.id).toBe('e2e-secondary-project')

    const remoteTasks = await daemonQuery<{ id: string; title: string }[]>(
      secondaryUrl,
      E2E_BROWSER_TOKEN,
      'listTasks',
    )
    const remoteActions = await daemonQuery<{ title: string }[]>(
      secondaryUrl,
      E2E_BROWSER_TOKEN,
      'actions',
      { projectId: 'e2e-secondary-project' },
    )
    const remoteCanvases = await daemonQuery<{ id: string; title: string }[]>(
      secondaryUrl,
      E2E_BROWSER_TOKEN,
      'listCanvases',
      { projectId: 'e2e-secondary-project' },
    )
    expect(remoteTasks).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Migrated task' })]),
    )
    expect(remoteActions).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Migrated action' })]),
    )
    const remoteReview = remoteCanvases.find((canvas) => canvas.title === 'Migrated Review Canvas')
    expect(remoteReview).toBeDefined()
    if (remoteReview === undefined)
      throw new Error('secondary daemon lost its migrated Review Canvas')
    const remoteReviewContent = await daemonQuery<{ content: string }>(
      secondaryUrl,
      E2E_BROWSER_TOKEN,
      'readCanvas',
      { projectId: 'e2e-secondary-project', canvasId: remoteReview.id },
    )
    expect(remoteReviewContent.content).toContain('Migrated Review Canvas')
    expect(remoteReviewContent.content).toContain('migration proof')
  } finally {
    if (secondaryChild !== null && secondaryChild.exitCode === null) {
      const exited = new Promise<void>((resolve) => secondaryChild?.once('exit', () => resolve()))
      secondaryChild.kill('SIGTERM')
      await exited
    }
    if (secondarySeed !== null) {
      await rm(secondarySeed.udBase, { recursive: true, force: true })
      await rm(secondarySeed.userData, { recursive: true, force: true })
    }
    await rm(secondaryRepo, { recursive: true, force: true })
  }
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
