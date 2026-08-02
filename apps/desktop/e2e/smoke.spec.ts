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

test('All changes can collapse and expand an individual diff', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  await page.getByRole('button', { name: 'All changes' }).click()

  const collapse = loc.diffCollapse(page, 'src/pages/Home.tsx')
  const lines = page.locator('[data-file="src/pages/Home.tsx"]')
  await expect(collapse).toHaveAttribute('aria-label', 'Collapse diff')
  await expect(lines.first()).toBeVisible()

  await collapse.click()
  await expect(collapse).toHaveAttribute('aria-label', 'Expand diff')
  await expect(lines).toHaveCount(0)

  await collapse.click()
  await expect(collapse).toHaveAttribute('aria-label', 'Collapse diff')
  await expect(lines.first()).toBeVisible()

  await loc.diffReviewed(page, 'src/pages/Home.tsx').click()
  await expect(collapse).toHaveAttribute('aria-label', 'Expand diff')
  await expect(lines).toHaveCount(0)
})

test('Board tab keeps the Quick Access toggle (Focus card detail)', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  await expect(loc.toggleRightSidebar(page)).toBeVisible()
  // Board Focus companion (selected card detail) keeps the right rail.
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
