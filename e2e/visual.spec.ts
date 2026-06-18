import { expect, openSettings, selectTab, test, waitForShell } from './helpers/electron'

// Screenshot baselines = the regression net. DOM-only (no native chrome /
// vibrancy), per-platform (`-darwin`). Deliberately NOT screenshotting the
// History list — its relative timestamps drift. Regenerate after intentional UI
// changes with `pnpm test:e2e:update`.

test('empty viewer', async ({ page }) => {
  await waitForShell(page)
  await expect(page.getByText('Review changes as a story')).toBeVisible()
  await expect(page).toHaveScreenshot('empty-viewer.png')
})

test('changes tab', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  await expect(page.getByText('2 changed files')).toBeVisible()
  await expect(page).toHaveScreenshot('changes-tab.png')
})

// Element-scoped baseline for the icon rail (Files…Terminal). The rail is a ~56px
// column, so adding/restyling a tab icon changes far fewer pixels than the full-page
// 2% tolerance and slips through the page shots untouched — framing just the rail
// makes such a change actually fail.
test('sidebar icon rail', async ({ page }) => {
  await waitForShell(page)
  const rail = page.locator('[data-slot="sidebar-menu"]').first()
  await expect(rail.getByRole('button', { name: 'Terminal' })).toBeVisible()
  await expect(rail).toHaveScreenshot('sidebar-rail.png')
})

// Element-scoped companion to the full-page `changes tab` shot. A restyle
// confined to the ~270px-wide right Quick Access column changes far fewer pixels
// than the full-page 2% tolerance, so it slips through that baseline untouched.
// Framing just the panel makes its buttons fill the shot, so the same restyle
// exceeds the per-element diff. The Commit composer renders only when the repo
// has commit conventions — the fixture's conventional-commit history guarantees
// it — so we assert the Commit button is present before the snapshot.
test('quick access — changes', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  const panel = page.locator(
    '[data-slot="sidebar-container"][data-side="right"] [data-slot="sidebar-inner"]',
  )
  await expect(panel.getByRole('button', { name: 'Commit', exact: true })).toBeVisible()
  await expect(panel).toHaveScreenshot('quick-access-changes.png')
})

test('settings dialog', async ({ page }) => {
  await waitForShell(page)
  await openSettings(page)
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveScreenshot('settings-general.png')
})

test.describe('without a seeded repo', () => {
  test.use({ seedRepo: false })

  test('welcome screen', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Open repository' })).toBeVisible()
    await expect(page).toHaveScreenshot('welcome.png')
  })
})
