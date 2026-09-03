import { expect, loc, openSettings, test, waitForShell } from './helpers/app'

test('Electron Share saves an external Cloudflare hostname for pairing', async ({ page }) => {
  await waitForShell(page)
  await openSettings(page)

  const dialog = loc.settingsDialog(page)
  await dialog.getByRole('button', { name: 'Share' }).click()
  await dialog.getByPlaceholder('https://porcelain.example.com').fill('remote.example.com')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(dialog.getByPlaceholder('https://porcelain.example.com')).toHaveValue(
    'https://remote.example.com',
  )
  await expect(dialog.getByRole('button', { name: 'Create Cloudflare link' })).toBeVisible()
})
