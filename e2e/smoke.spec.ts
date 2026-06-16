import { expect, openSettings, selectTab, test, waitForShell } from './helpers/electron'

test('boots and restores the seeded repo into the shell', async ({ page }) => {
  await waitForShell(page)
  // The empty viewer's quick-start is the default landing surface.
  await expect(page.getByText('Review changes as a story')).toBeVisible()
})

test('Changes tab lists the working-tree changes', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  await expect(page.getByText('2 changed files')).toBeVisible()
  await expect(page.getByText('Home.tsx')).toBeVisible()
  await expect(page.getByText('Card.tsx')).toBeVisible()
})

test('Board tab hides the Quick Access panel', async ({ page }) => {
  await waitForShell(page)
  // The toggle is present on a tab that has Quick Access content…
  await selectTab(page, 'Changes')
  await expect(page.getByRole('button', { name: 'Toggle quick access sidebar' })).toBeVisible()
  // …and gone on the Board tab, which has none.
  await selectTab(page, 'Board')
  await expect(page.getByRole('button', { name: 'Toggle quick access sidebar' })).toHaveCount(0)
})

test('Settings dialog opens to the General section', async ({ page }) => {
  await waitForShell(page)
  await openSettings(page)
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible()
})

test.describe('without a seeded repo', () => {
  test.use({ seedRepo: false })

  test('shows the Welcome screen', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Open repository' })).toBeVisible()
    await expect(page.getByText('Review changes as a story')).toBeVisible()
  })
})
