import { expect, loc, test, waitForShell } from './helpers/app'

test('Hub inventory lists the Environment, Project, and Worktrees without a delete control', async ({
  page,
}) => {
  await waitForShell(page)
  await expect(loc.hubInventory(page)).toBeVisible()
  await expect(loc.hubProjects(page)).toHaveCount(1)
  const before = await loc.hubWorktrees(page).count()
  expect(before).toBeGreaterThan(0)

  const projectId = (await loc.hubProjects(page).first().getAttribute('data-testid'))?.replace(
    'hub-project-',
    '',
  )
  expect(projectId).toBeTruthy()
  if (projectId === undefined || projectId === '') return

  await expect(loc.hubCreateWorktree(page, projectId)).toBeVisible()
  await expect(page.getByLabel(/delete worktree/i)).toHaveCount(0)

  await loc.hubCreateWorktree(page, projectId).click()
  await loc.hubCreateWorktreeBranch(page).fill('hub-topic')
  await loc.hubCreateWorktreeSubmit(page).click()

  await expect(loc.hubWorktrees(page)).toHaveCount(before + 1)
  const created = page.getByTestId(/^hub-worktree-/).filter({ hasText: 'hub-topic' })
  await expect(created).toBeVisible()

  // Open the actual row context menu: checking for hidden labels alone misses
  // a destructive action that is only mounted after this interaction.
  await created.click({ button: 'right' })
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem', { name: /remove worktree/i })).toHaveCount(0)
  await expect(menu.getByRole('menuitem', { name: /delete worktree/i })).toHaveCount(0)
})
