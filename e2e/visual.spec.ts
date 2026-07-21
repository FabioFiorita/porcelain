import { expect, loc, openSettings, selectTab, test, waitForShell } from './helpers/app'

// Screenshot baselines = the regression net. DOM-only (no native window chrome /
// traffic lights — the UI is one opaque design, no vibrancy), per-platform.
// Deliberately NOT screenshotting the History list — its relative timestamps drift.
// Regenerate after intentional UI changes with `pnpm test:e2e:update`.

test('empty viewer', async ({ page }) => {
  await waitForShell(page)
  await expect(loc.glanceChangedFiles(page)).toHaveAttribute('data-count', '2')
  await expect(page).toHaveScreenshot('empty-viewer.png')
})

test('changes tab', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  await expect(loc.changesSummary(page)).toHaveAttribute('data-count', '2')
  await expect(page).toHaveScreenshot('changes-tab.png')
})

// Element-scoped baseline for the icon rail. Framing just the rail makes a tab
// restyle fail where full-page 2% tolerance would swallow it.
test('sidebar icon rail', async ({ page }) => {
  await waitForShell(page)
  const rail = loc.rail(page)
  await expect(loc.railTab(page, 'chat')).toBeVisible()
  await expect(loc.railTab(page, 'agent')).toBeVisible()
  await expect(loc.railTab(page, 'feature')).toBeVisible()
  await expect(rail).toHaveScreenshot('sidebar-rail.png')
})

// Element-scoped companion to the full-page `changes tab` shot.
test('quick access — changes', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  const panel = page.locator(
    '[data-slot="sidebar-container"][data-side="right"] [data-slot="sidebar-inner"]',
  )
  await expect(loc.commitButton(page)).toBeVisible()
  await expect(panel).toHaveScreenshot('quick-access-changes.png')
})

test('settings dialog', async ({ page }) => {
  await waitForShell(page)
  await openSettings(page)
  await expect(loc.settingsHeading(page)).toHaveText('General')
  await expect(loc.settingsDialog(page)).toHaveScreenshot('settings-general.png')
})

test.describe('without a seeded repo', () => {
  test.use({ seedRepo: false })

  test('welcome screen', async ({ page }) => {
    await expect(loc.welcomeOpenRepo(page)).toBeVisible()
    await expect(page).toHaveScreenshot('welcome.png')
  })
})
