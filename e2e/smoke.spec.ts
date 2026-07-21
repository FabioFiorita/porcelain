import { expect, loc, openSettings, selectTab, test, waitForShell } from './helpers/app'

test('boots and restores the seeded repo into the shell', async ({ page }) => {
  await waitForShell(page)
  // Empty viewer = Glance (work in flight). Seeded fixture has 2 dirty files.
  await expect(loc.glanceChangedFiles(page)).toHaveAttribute('data-count', '2')
})

test('Changes tab lists the working-tree changes', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  await expect(loc.changesSummary(page)).toHaveAttribute('data-count', '2')
  await expect(loc.changesFile(page, 'Home.tsx')).toBeVisible()
  await expect(loc.changesFile(page, 'Card.tsx')).toBeVisible()
})

test('Board tab keeps the Quick Access toggle (notes/pins)', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  await expect(loc.toggleRightSidebar(page)).toBeVisible()
  // Board no longer suppresses the right rail (U18) — toggle stays.
  await selectTab(page, 'Board')
  await expect(loc.toggleRightSidebar(page)).toBeVisible()
})

test('Settings dialog opens to the General section', async ({ page }) => {
  await waitForShell(page)
  await openSettings(page)
  await expect(loc.settingsHeading(page)).toHaveText('General')
})

test.describe('without a seeded repo', () => {
  test.use({ seedRepo: false })

  test('shows the Welcome screen', async ({ page }) => {
    await expect(loc.welcomeOpenRepo(page)).toBeVisible()
    await expect(loc.welcome(page)).toBeVisible()
  })
})
