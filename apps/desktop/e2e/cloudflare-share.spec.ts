import { expect, loc, openSettings, test, waitForShell } from './helpers/app'

test('Electron Share saves an external Cloudflare hostname for pairing', async ({ page }) => {
  await waitForShell(page)
  await openSettings(page)

  const dialog = loc.settingsDialog(page)
  await dialog.getByRole('button', { name: 'Share' }).click()
  const lan = dialog.getByRole('switch', { name: 'Local network', exact: true })
  if ((await lan.getAttribute('aria-checked')) !== 'true') await lan.click()
  await dialog.getByText('Configure Cloudflare', { exact: true }).click()
  await dialog
    .getByRole('combobox', { name: 'Cloudflare connection type' })
    .selectOption('hostname')
  await dialog.getByPlaceholder('https://porcelain.example.com').fill('remote.example.com')
  await dialog.getByRole('button', { name: 'Apply Cloudflare configuration', exact: true }).click()

  await expect(dialog.getByPlaceholder('https://porcelain.example.com')).toHaveValue(
    /^https:\/\/remote\.example\.com\/?$/,
  )
  await expect(dialog.getByRole('button', { name: 'Create Cloudflare link' })).toBeVisible()
})
