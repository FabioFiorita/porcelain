import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { expect, loc, openSurface, TestIds, test, waitForShell } from './helpers/app'

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

test.setTimeout(120_000)

// The daemon-owned process proof is `critical-wiring.spec.ts` — a PTY outliving a renderer
// reload. This scenario stays focused on cross-feature target, Canvas, Task, and Action wiring.
test('composed daemon proof: targets, Canvas, Tasks, and Actions', async ({ page, seeded }) => {
  await waitForShell(page)

  const { projectId, worktreeId } = await waitForProject(seeded.udBase)
  await seedCanvas(seeded.udBase, projectId, worktreeId)

  await expect(loc.hubWorktrees(page)).toHaveCount(1)
  await openSurface(page, 'Files')
  await expect(loc.treeEntry(page, 'README.md')).toBeVisible()
  await loc.treeEntry(page, 'README.md').click()
  await expect(loc.viewerCard(page)).toContainText('A fixture repo for Porcelain e2e tests.')
  await openSurface(page, 'Changes')
  await expect(page.getByTestId(TestIds.changesList)).toBeVisible()
  await openSurface(page, 'Canvas')
  const original = await page
    .locator('[data-testid^="hub-worktree-"]')
    .first()
    .getAttribute('data-testid')
  const projectTestId = await page
    .locator('[data-testid^="hub-project-"]')
    .first()
    .getAttribute('data-testid')
  if (original === null || projectTestId === null) throw new Error('missing Hub target')
  const project = projectTestId.replace('hub-project-', '')
  await loc.hubWorktree(page, original.replace('hub-worktree-', '')).click()
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
  const originalWorktreeId = original.replace('hub-worktree-', '')
  const otherWorktreeId = other.replace('hub-worktree-', '')
  const originalTarget = {
    environmentId:
      (await loc.hubWorktree(page, originalWorktreeId).getAttribute('data-hub-environment')) ?? '',
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
})

async function openReadme(page: Parameters<typeof waitForShell>[0]): Promise<void> {
  await openSurface(page, 'Files')
  await loc.treeEntry(page, 'README.md').click()
  await expect(loc.viewerTab(page, 'README.md').last()).toBeVisible()
}
