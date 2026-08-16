import { expect, loc, test, waitForShell } from './helpers/app'

test('Hub inventory creates a Worktree and removes it through a confirmation', async ({ page }) => {
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

  await loc.hubCreateWorktree(page, projectId).click()
  await loc.hubCreateWorktreeBranch(page).fill('hub-topic')
  await loc.hubCreateWorktreeSubmit(page).click()

  await expect(loc.hubWorktrees(page)).toHaveCount(before + 1)
  const created = page.getByTestId(/^hub-worktree-/).filter({ hasText: 'hub-topic' })
  await expect(created).toBeVisible()

  // Open the actual row context menu: the removal item and its confirmation are
  // only mounted after this interaction, which is exactly where this control was
  // dead once — a dialog inside the menu unmounts as the menu closes.
  await created.click({ button: 'right' })
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem', { name: /remove worktree/i })).toHaveCount(1)
  await menu.getByRole('menuitem', { name: /remove worktree/i }).click()

  await expect(loc.hubRemoveWorktreeDialog(page)).toBeVisible()
  await loc.hubRemoveWorktreeConfirm(page).click()

  await expect(loc.hubWorktrees(page)).toHaveCount(before)
  await expect(created).toHaveCount(0)
})
