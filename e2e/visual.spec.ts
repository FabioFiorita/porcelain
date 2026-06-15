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
