import { expect, openSettings, TestIds, test, waitForShell } from './helpers/app'

test('Windows exposes its local daemon and manual remote pairing without WSL setup', async ({
  app,
  page,
}) => {
  test.skip(process.platform !== 'win32' || app === null, 'Windows Electron boundary')
  await waitForShell(page)
  await openSettings(page)
  await page.getByTestId(TestIds.settingsSection('remotes')).first().click()
  await expect(page.getByTestId(TestIds.environmentRow('local'))).toBeVisible()
  await expect(page.getByRole('button', { name: 'Set up WSL Environment' })).toHaveCount(0)
  await expect(page.getByText(/For Linux or WSL, start Porcelain/)).toBeVisible()
  await page.getByRole('button', { name: 'Pair an environment group' }).click()
  await expect(page.getByPlaceholder('Connection link (https://…/pair#token=…)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pair environment', exact: true })).toBeDisabled()
})
