import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, loc, selectTab, test, waitForShell } from './helpers/app'

const DIVERTED = 'HUB-VIEWER-DIVERGED-README'

test('switching Worktree keeps existing tabs on their original target', async ({ page }) => {
  await waitForShell(page)
  await expect(loc.hubInventory(page)).toBeVisible()
  await expect(loc.hubWorktreeSummary(page)).toBeVisible()
  await selectTab(page, 'Files')
  await expect(page.getByText('Pinned', { exact: true })).toBeVisible()
  await expect(page.getByText('All Files', { exact: true })).toBeVisible()
  await expect(page.getByText('Notes', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Collapse all folders' })).toBeVisible()
  await loc.treeEntry(page, 'README.md').click()
  await expect(loc.viewerCard(page)).toContainText('A fixture repo for Porcelain e2e tests.')
  const tab = loc.viewerTab(page, 'README.md')
  const task = loc.viewerCard(page).getByRole('button', { name: 'Task', exact: true })
  await expect(tab).toBeVisible()
  await expect(task).toBeVisible()
  const tabBox = await tab.boundingBox()
  const taskBox = await task.boundingBox()
  if (tabBox === null || taskBox === null) throw new Error('expected header tab and task button')
  expect(Math.abs(tabBox.y - taskBox.y)).toBeLessThanOrEqual(1)
  expect(tabBox.x + tabBox.width).toBeLessThan(taskBox.x)

  const originalWorktreeId = await page
    .locator('[data-hub-worktree]')
    .first()
    .getAttribute('data-hub-worktree')
  expect(originalWorktreeId).toBeTruthy()
  if (originalWorktreeId === null) return

  const projectId = (await loc.hubProjects(page).first().getAttribute('data-testid'))?.replace(
    'hub-project-',
    '',
  )
  expect(projectId).toBeTruthy()
  if (projectId === undefined || projectId === '') return

  const before = await loc.hubWorktrees(page).count()
  await loc.hubCreateWorktree(page, projectId).click()
  await loc.hubCreateWorktreeBranch(page).fill('hub-viewer')
  await loc.hubCreateWorktreeSubmit(page).click()
  await expect(loc.hubWorktrees(page)).toHaveCount(before + 1)

  await writeFile(
    join(tmpdir(), 'porcelain-e2e-fixture-worktrees', 'hub-viewer', 'README.md'),
    `# Diverted\n\n${DIVERTED}\n`,
  )

  const worktreeTestIds = await loc
    .hubWorktrees(page)
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute('data-testid'))
        .filter((id): id is string => id !== null),
    )
  const nextId = worktreeTestIds.find((id) => !id.endsWith(originalWorktreeId))
  expect(nextId).toBeTruthy()
  if (nextId === undefined) return
  await page.getByTestId(nextId).click()

  await expect(loc.hubTabTargets(page, originalWorktreeId)).toHaveCount(1)
  await expect(loc.viewerCard(page)).toContainText('A fixture repo for Porcelain e2e tests.')
  await expect(loc.viewerCard(page)).not.toContainText(DIVERTED)
})

test('Project headers collapse without becoming navigation targets', async ({ page }) => {
  await waitForShell(page)
  await expect(loc.hubWorktreeSummary(page)).toBeVisible()

  const project = loc.hubProjects(page).first()
  const worktrees = loc.hubWorktrees(page)
  const before = await worktrees.count()

  await project.getByRole('button', { name: /Collapse project/ }).click()
  await expect(worktrees.first()).toBeHidden()
  await expect(loc.hubWorktreeSummary(page)).toBeVisible()

  await project.getByRole('button', { name: /Expand project/ }).click()
  await expect(worktrees).toHaveCount(before)
})
