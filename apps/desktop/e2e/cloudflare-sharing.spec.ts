import { expect, openSettings, TestIds, test, waitForShell } from './helpers/app'

test('custom Cloudflare sharing has a coherent mode, LAN dependency, and off transition', async ({
  page,
}) => {
  await waitForShell(page)
  await openSettings(page)
  await page.getByTestId(TestIds.settingsSection('share')).first().click()
  const lan = page.getByRole('switch', { name: 'Local network', exact: true })
  const cloudflare = page.getByRole('switch', { name: 'Cloudflare', exact: true })
  const hostname = page.getByRole('textbox', { name: 'Custom Cloudflare hostname' })
  const apply = page.getByRole('button', { name: 'Use custom hostname' })
  await hostname.fill('remote.example.com')
  await expect(apply).toBeDisabled()
  await lan.click()
  await expect(lan).toBeChecked()
  await expect(page.getByText('Cloudflare service URL:', { exact: false })).toBeVisible()
  await expect(hostname).toHaveValue('remote.example.com')
  await expect(apply).toBeEnabled()
  await apply.click()
  await expect(cloudflare).toBeChecked()
  await expect(lan).toBeDisabled()
  await expect(page.getByText('Custom hostname selected:', { exact: false })).toContainText(
    'https://remote.example.com',
  )
  await expect(page.getByRole('button', { name: 'Use managed tunnel' })).toBeVisible()

  await page.getByPlaceholder('Device name, e.g. My iPhone').fill('Test phone')
  await page.getByRole('button', { name: 'Create Cloudflare link' }).click()
  await expect(page.getByAltText('Pairing QR code')).toBeVisible()
  await expect(page.getByText(/^https:\/\/remote\.example\.com\/pair#/)).toBeVisible()

  await cloudflare.click()
  await expect(cloudflare).not.toBeChecked()
  await expect(lan).toBeEnabled()
  await expect(hostname).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Create Cloudflare link' })).toHaveCount(0)
  await expect(page.getByAltText('Pairing QR code')).toHaveCount(0)
  await lan.click()
  await expect(lan).not.toBeChecked()
})
