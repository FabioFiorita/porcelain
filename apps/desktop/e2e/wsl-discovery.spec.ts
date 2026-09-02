import { execFileSync } from 'node:child_process'
import { expect, openSettings, test, TestIds, waitForShell } from './helpers/app'

function installedUserDistributions(): string[] {
  const output = execFileSync('wsl.exe', ['--list', '--quiet'])
  const sample = output.subarray(0, Math.min(output.length, 200))
  const zeroes = sample.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0)
  return output
    .toString(zeroes > sample.length / 5 ? 'utf16le' : 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter((name) => name !== '' && !/^docker-desktop(?:-data)?$/i.test(name))
}

test('the Windows shell presents WSL distributions as separate candidate Environments', async ({
  app,
  page,
}) => {
  test.skip(process.platform !== 'win32', 'WSL discovery belongs to the Windows Electron shell')
  test.skip(app === null, 'WSL discovery belongs to the Electron shell')
  const distributions = installedUserDistributions()
  test.skip(distributions.length === 0, 'this Windows host has no user WSL distribution')
  const distributionName = distributions[0]
  if (distributionName === undefined)
    throw new Error('WSL distribution disappeared after discovery')

  await waitForShell(page)
  await openSettings(page)
  await page.getByTestId(TestIds.settingsSection('remotes')).first().click()

  await expect(page.getByRole('heading', { name: 'Windows Subsystem for Linux' })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText(distributionName, { exact: true })).toBeVisible()
  await expect(page.getByText(/does not open them through a Windows UNC path/)).toBeVisible()
})
