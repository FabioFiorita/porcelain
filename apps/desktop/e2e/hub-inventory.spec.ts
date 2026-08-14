import { expect, loc, test, waitForShell } from './helpers/app'

test('Hub inventory lists the Environment, Project, and Worktrees without a delete control', async ({
  page,
}) => {
  await waitForShell(page)
  await expect(loc.hubInventory(page)).toBeVisible()
  await expect(loc.hubProjects(page)).toHaveCount(1)
  await expect(loc.hubWorktrees(page)).toHaveCount(1)

  const projectId = (await loc.hubProjects(page).first().getAttribute('data-testid'))?.replace(
    'hub-project-',
    '',
  )
  expect(projectId).toBeTruthy()
  if (projectId === undefined || projectId === '') return

  await expect(loc.hubCreateWorktree(page, projectId)).toBeVisible()
  await expect(page.getByLabel(/delete worktree/i)).toHaveCount(0)

  await loc.hubCreateWorktree(page, projectId).click()
  await page.getByLabel('New worktree branch').fill('hub-topic')
  await page.getByRole('button', { name: 'Add' }).click()

  await expect(loc.hubWorktrees(page)).toHaveCount(2)
  await expect(page.getByTestId(/^hub-worktree-/).filter({ hasText: 'hub-topic' })).toBeVisible()
})
