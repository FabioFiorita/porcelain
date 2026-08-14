import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, loc, test, waitForShell } from './helpers/app'

const DIVERTED = 'HUB-VIEWER-DIVERGED-README'

test('switching Worktree keeps existing tabs on their original target', async ({ page }) => {
  await waitForShell(page)
  await expect(loc.hubInventory(page)).toBeVisible()
  await expect(loc.hubWorktreeSummary(page)).toBeVisible()
  await loc.treeEntry(page, 'README.md').click()
  await expect(loc.viewerCard(page)).toContainText('A fixture repo for Porcelain e2e tests.')

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
  await page.getByLabel('New worktree branch').fill('hub-viewer')
  await page.getByRole('button', { name: 'Add' }).click()
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

test('Home and Project selections render progressively scoped summaries', async ({ page }) => {
  await waitForShell(page)
  await expect(loc.hubWorktreeSummary(page)).toBeVisible()

  const environmentId = await loc
    .hubInventory(page)
    .locator('[data-testid^="hub-environment-"]')
    .first()
    .getAttribute('data-testid')
  expect(environmentId).toBeTruthy()
  if (environmentId === null) return

  const projectId = (await loc.hubProjects(page).first().getAttribute('data-testid'))?.replace(
    'hub-project-',
    '',
  )
  expect(projectId).toBeTruthy()
  if (projectId === undefined || projectId === '') return

  await loc.hubProject(page, projectId).getByRole('button').first().click()
  await expect(loc.hubProjectSummary(page)).toBeVisible()

  await page.getByTestId(environmentId).click()
  await expect(loc.hubHome(page)).toBeVisible()
})
