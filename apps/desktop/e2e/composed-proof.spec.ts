import { execFileSync } from 'node:child_process'
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
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

const SECONDARY_BRANCH = 'composed-secondary-only'
const SECONDARY_ONLY_FILE = 'secondary-only.txt'
const SECONDARY_ONLY_CONTENT = 'SECONDARY-DAEMON-ONLY-CONTENT'

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

async function seedCanvas(homeDir: string, projectId: string, worktreeId: string): Promise<void> {
  const indexPath = canvasIndexPath(homeDir, projectId)
  let current: { version?: number; value: { canvases: Record<string, unknown>[] } }
  try {
    current = JSON.parse(await readFile(indexPath, 'utf8')) as {
      value: { canvases: Record<string, unknown>[] }
    }
  } catch {
    await mkdir(join(homeDir, 'projects', projectId, 'canvases'), { recursive: true })
    current = { version: 1, value: { canvases: [] } }
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

async function seedRemoteDaemon(repoDir: string) {
  const seeded = await seedIsolatedState(repoDir, true, null)
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

test('composed daemon proof: targets, Canvas, Tasks, Actions, and process lifetime', async ({
  page,
  seeded,
}) => {
  const secondaryRepo = join(tmpdir(), 'porcelain-e2e-secondary')
  let secondarySeed: Awaited<ReturnType<typeof seedIsolatedState>> | null = null
  let secondaryChild: Awaited<ReturnType<typeof spawnDaemon>>['child'] | null = null
  try {
    await createFixtureRepo(secondaryRepo)
    await writeFile(join(secondaryRepo, SECONDARY_ONLY_FILE), `${SECONDARY_ONLY_CONTENT}\n`)
    execFileSync('git', ['switch', '-c', SECONDARY_BRANCH], { cwd: secondaryRepo })
    secondarySeed = await seedRemoteDaemon(secondaryRepo)
    const secondary = await spawnDaemon(secondarySeed, {
      port: 43220,
      host: 'e2e-secondary',
      allowedOrigin: new URL(page.url()).origin,
      // Exercise the published standalone-daemon entrypoint and its supported
      // --allowed-origin configuration, rather than bypassing it with the raw bundle.
      cli: true,
    })
    secondaryChild = secondary.child
    const secondaryIdentity = await waitForProject(secondarySeed.udBase)
    await seedCanvas(
      secondarySeed.udBase,
      secondaryIdentity.projectId,
      secondaryIdentity.worktreeId,
    )
    await waitForShell(page)
    // Configure the secondary Environment through the shipped browser Remotes UI. This
    // deliberately exercises URL/token verification and client-local persistence rather than
    // planting the connection in localStorage, which would only prove a test fixture seam.
    await loc.railSettings(page).click()
    await loc.settingsDialog(page).waitFor()
    await loc.settingsSection(page, 'remotes').click()
    await expect(loc.settingsHeading(page)).toHaveText('Remotes')
    await loc.browserEnvironmentLabel(page).fill('e2e-secondary')
    await loc.browserEnvironmentUrl(page).fill(`http://127.0.0.1:${secondary.port}`)
    await loc.browserEnvironmentToken(page).fill(E2E_BROWSER_TOKEN)
    await loc.browserEnvironmentAdd(page).click()
    const configuredSecondary = loc.browserEnvironmentConnections(page).getByText('e2e-secondary', {
      exact: true,
    })
    await expect(configuredSecondary).toBeVisible()
    await expect(loc.browserEnvironmentConnections(page)).toContainText(
      /e2e-secondary · linux · daemon/,
    )
    // The saved token is never rendered back into the connection card or page text.
    await expect(page.getByText(E2E_BROWSER_TOKEN, { exact: true })).toHaveCount(0)
    await expect(loc.browserEnvironmentToken(page)).toHaveValue('')
    await loc.settingsDialog(page).getByRole('button', { name: 'Close' }).click()
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
    await seedCanvas(seeded.udBase, projectId, worktreeId)

    // Both Environment identities, Projects, and Worktrees are now visible in one browser page.
    const secondaryEnvironment = JSON.parse(
      await readFile(join(secondarySeed.udBase, 'environment-identity.json'), 'utf8'),
    ) as { value: { id: string; name: string } }
    await expect(loc.hubWorktrees(page)).toHaveCount(2)
    const environmentIds = await loc
      .hubWorktrees(page)
      .evaluateAll((nodes) => [
        ...new Set(nodes.map((node) => node.getAttribute('data-hub-environment'))),
      ])
    expect(environmentIds).toEqual(expect.arrayContaining([secondaryEnvironment.value.id]))
    expect(environmentIds).toHaveLength(2)

    const secondaryWorktreeId = (
      await page
        .locator(
          `[data-testid^="hub-worktree-"][data-hub-environment="${secondaryEnvironment.value.id}"]`,
        )
        .first()
        .getAttribute('data-testid')
    )?.replace('hub-worktree-', '')
    if (secondaryWorktreeId === undefined) throw new Error('secondary Worktree did not render')
    await loc.hubWorktree(page, secondaryWorktreeId).click()
    // Ordinary repo surfaces must follow the selected secondary Environment too: the
    // Files tree/content and Git working-tree query are not allowed to fall back to primary.
    await expect(loc.glance(page).getByText(SECONDARY_BRANCH, { exact: true })).toBeVisible()
    await openSurface(page, 'Files')
    await expect(loc.treeEntry(page, SECONDARY_ONLY_FILE)).toBeVisible()
    await loc.treeEntry(page, SECONDARY_ONLY_FILE).click()
    await expect(loc.viewerCard(page)).toContainText(SECONDARY_ONLY_CONTENT)
    await expect(loc.treeEntry(page, 'README.md')).toBeVisible()
    await loc.treeEntry(page, 'README.md').click()
    await expect(loc.viewerCard(page)).toContainText('A fixture repo for Porcelain e2e tests.')
    await openSurface(page, 'Changes')
    await expect(page.getByTestId(TestIds.changesList)).toBeVisible()
    const secondaryChange = loc.changesFile(page, SECONDARY_ONLY_FILE)
    await expect(secondaryChange).toBeVisible()
    await expect(secondaryChange.getByRole('img', { name: 'untracked' })).toBeVisible()
    await openSurface(page, 'Canvas')
    // Multiple Worktrees and explicit target-aware tabs/splits.
    const original = await page
      .locator('[data-testid^="hub-worktree-"]:not([data-hub-environment="e2e-secondary"])')
      .first()
      .getAttribute('data-testid')
    const projectTestId = await page
      .locator('[data-testid^="hub-project-"]:not([data-hub-environment="e2e-secondary"])')
      .first()
      .getAttribute('data-testid')
    if (original === null || projectTestId === null) throw new Error('missing Hub target')
    const project = projectTestId.replace('hub-project-', '')
    await loc.hubWorktree(page, original.replace('hub-worktree-', '')).click()
    await loc.hubCreateWorktree(page, project).click()
    await loc.hubCreateWorktreeBranch(page).fill('composed-proof')
    await loc.hubCreateWorktreeSubmit(page).click()
    await expect(loc.hubWorktrees(page)).toHaveCount(3)
    const worktreeIds = await loc.hubWorktrees(page).evaluateAll(
      (nodes, secondaryEnvironmentId) =>
        nodes
          .filter((node) => node.getAttribute('data-hub-environment') !== secondaryEnvironmentId)
          .map((node) => node.getAttribute('data-testid'))
          .filter((id): id is string => id !== null),
      secondaryEnvironment.value.id,
    )
    const other = worktreeIds.find((id) => id !== original)
    if (other === undefined) throw new Error('second Worktree did not appear')
    const originalWorktreeId = original.replace('hub-worktree-', '')
    const otherWorktreeId = other.replace('hub-worktree-', '')
    const originalTarget = {
      environmentId:
        (await loc.hubWorktree(page, originalWorktreeId).getAttribute('data-hub-environment')) ??
        '',
      projectId:
        (await loc.hubWorktree(page, originalWorktreeId).getAttribute('data-hub-project')) ?? '',
      worktreeId: originalWorktreeId,
    }
    const otherTarget = {
      environmentId:
        (await loc.hubWorktree(page, otherWorktreeId).getAttribute('data-hub-environment')) ?? '',
      projectId:
        (await loc.hubWorktree(page, otherWorktreeId).getAttribute('data-hub-project')) ?? '',
      worktreeId: otherWorktreeId,
    }
    expect(originalTarget.environmentId).not.toBe('')
    expect(originalTarget.projectId).toBe(project)
    expect(otherTarget).toMatchObject({
      environmentId: originalTarget.environmentId,
      projectId: project,
    })
    await loc.hubWorktree(page, originalWorktreeId).click()
    await openReadme(page)
    await expect(loc.hubTabTarget(page, originalTarget)).toHaveCount(1)
    await loc.viewerTab(page, 'README.md').dblclick()
    await loc.viewerTab(page, 'README.md').click({ button: 'right' })
    await loc.viewerTabOpenToSide(page).click()
    await loc.hubWorktree(page, otherWorktreeId).click()
    await openReadme(page)
    const duplicateOriginal = loc.hubTabTarget(page, originalTarget).last()
    await duplicateOriginal.locator('button[aria-label^="Close "]').click()
    const renderedTargets = await loc.viewerTabs(page).evaluateAll((nodes) =>
      nodes.map((node) => ({
        environment: node.getAttribute('data-hub-environment'),
        project: node.getAttribute('data-hub-project'),
        worktree: node.getAttribute('data-hub-worktree'),
      })),
    )
    const targetedRenderedTargets = renderedTargets.filter(
      (target): target is { environment: string; project: string; worktree: string } =>
        target.environment !== null && target.project !== null && target.worktree !== null,
    )
    if (targetedRenderedTargets.length !== 2)
      throw new Error(`expected two targeted tabs: ${JSON.stringify(renderedTargets)}`)
    const originalTabCount = await loc.hubTabTarget(page, originalTarget).count()
    const otherTabCount = await loc.hubTabTarget(page, otherTarget).count()
    if (originalTabCount !== 1 || otherTabCount !== 1) {
      throw new Error(
        `split tabs lost target identity: ${JSON.stringify({ originalTarget, otherTarget, renderedTargets })}`,
      )
    }

    // Canvas bundles remain visible after target switching.
    await openSurface(page, 'Canvas')
    await expect(loc.canvasListItem(page, 'composed-notes')).toBeVisible()
    await loc.canvasListItem(page, 'composed-notes').click()
    await expect(
      page.frameLocator(`[data-testid="${TestIds.canvasIframe}"]`).locator('#proof'),
    ).toHaveText('Composed notes')
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
})

async function openReadme(page: Parameters<typeof waitForShell>[0]): Promise<void> {
  await openSurface(page, 'Files')
  await loc.treeEntry(page, 'README.md').click()
  await expect(loc.viewerTab(page, 'README.md').last()).toBeVisible()
}
