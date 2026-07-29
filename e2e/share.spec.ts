import { expect, loc, openSettings, test, waitForShell } from './helpers/app'

test('shows host administration only in a local Electron window', async ({ page, appMode }) => {
  await waitForShell(page)
  await openSettings(page)

  if (appMode === 'browser') {
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Remotes', exact: true })).toHaveCount(0)
    return
  }

  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await expect(loc.shareStatus(page)).toBeVisible()
  await expect(loc.shareStatus(page)).toContainText('E2E browser')
  await expect(page.getByText('No paired devices yet.')).toHaveCount(0)

  const deviceRow = loc.shareStatus(page).getByText('E2E browser').locator('..').locator('..')
  await deviceRow.getByRole('button', { name: 'Revoke' }).click()
  await expect(loc.shareStatus(page)).not.toContainText('E2E browser')
  await expect(loc.shareStatus(page)).toContainText('No paired devices yet.')
})
