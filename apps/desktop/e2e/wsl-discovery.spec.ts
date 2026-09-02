import { execFileSync } from 'node:child_process'
import {
  expect,
  expectTerminalText,
  loc,
  openSettings,
  openTerminals,
  spawnPanelTerminal,
  TestIds,
  test,
  waitForShell,
} from './helpers/app'

const WSL_REPO = '/tmp/porcelain-wsl-e2e-project'

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

test('Windows provisions Ubuntu, opens a Linux project, and runs its terminal in WSL', async ({
  app,
  page,
}) => {
  test.skip(process.platform !== 'win32', 'WSL integration belongs to the Windows Electron shell')
  test.skip(app === null, 'WSL integration belongs to the Electron shell')
  const distribution = installedUserDistributions().find((name) => name === 'Ubuntu')
  test.skip(distribution === undefined, 'this Windows host has no Ubuntu distribution')
  if (distribution === undefined) throw new Error('Ubuntu disappeared after discovery')

  execFileSync('wsl.exe', [
    '--distribution',
    distribution,
    '--exec',
    'sh',
    '-lc',
    `set -eu; rm -rf -- '${WSL_REPO}'; mkdir -p '${WSL_REPO}'; cd '${WSL_REPO}'; git init -q; git config user.name 'Porcelain E2E'; git config user.email 'porcelain@example.test'; printf '# WSL Porcelain proof\\n' > README.md; git add README.md; git commit -qm 'Initial WSL proof'`,
  ])

  try {
    await waitForShell(page)
    await openSettings(page)
    await page.getByTestId(TestIds.settingsSection('remotes')).first().click()
    const rendererMarker = `renderer-${Date.now()}`
    await page.evaluate((marker) => {
      ;(window as Window & { __porcelainRendererMarker?: string }).__porcelainRendererMarker =
        marker
    }, rendererMarker)
    await page
      .getByRole('button', { name: /Set up WSL Environment|Browse projects|Try again/ })
      .click()

    const environmentPicker = page.getByTestId(TestIds.projectPickerEnvironment)
    await expect(environmentPicker).toContainText('WSL', { timeout: 2 * 60_000 })
    expect(
      await page.evaluate(
        () => (window as Window & { __porcelainRendererMarker?: string }).__porcelainRendererMarker,
      ),
    ).toBe(rendererMarker)

    const up = page.getByRole('button', { name: 'Up', exact: true })
    const currentPath = page.locator('[role="dialog"] p[dir="rtl"]')
    for (let depth = 0; depth < 12 && (await up.isEnabled()); depth += 1) {
      const previousPath = await currentPath.getAttribute('title')
      await up.click()
      if (previousPath !== null)
        await expect(currentPath).not.toHaveAttribute('title', previousPath)
    }
    await page.getByRole('button', { name: 'tmp', exact: true }).click()
    await page
      .getByRole('button', { name: /porcelain-wsl-e2e-project/ })
      .first()
      .click()
    await page.getByRole('button', { name: 'Open this folder' }).click()

    await expect(loc.hubInventory(page)).toBeVisible({ timeout: 60_000 })
    await expect(loc.hubInventory(page).getByText('WSL').first()).toBeVisible()
    await page.getByRole('button', { name: /master porcelain-wsl-e2e-project/ }).click()
    await page.getByRole('button', { name: /Files Browse the project tree/ }).click()
    await expect(loc.treeEntry(page, 'README.md')).toBeVisible({ timeout: 60_000 })

    await openTerminals(page)
    await spawnPanelTerminal(page)
    await expectTerminalText(page, 0, '/tmp/porcelain-wsl-e2e-project')
  } finally {
    execFileSync('wsl.exe', ['--distribution', distribution, '--exec', 'rm', '-rf', '--', WSL_REPO])
  }
})
