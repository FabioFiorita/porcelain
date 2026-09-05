import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  expect,
  expectTerminalText,
  loc,
  openSettings,
  openTerminals,
  TestIds,
  test,
  waitForShell,
} from './helpers/app'

const WSL_NAME = `porcelain-wsl-e2e-project-${randomUUID()}`
const WSL_REPO = `/tmp/${WSL_NAME}`

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
  test.setTimeout(3 * 60_000)
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
    `set -eu; mkdir '${WSL_REPO}'; cd '${WSL_REPO}'; git init -q -b master; git config user.name 'Porcelain E2E'; git config user.email 'porcelain@example.test'; printf '# WSL Porcelain proof\\n' > README.md; git add README.md; git commit -qm 'Initial WSL proof'`,
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
    for (let depth = 0; depth < 12; depth += 1) {
      const previousPath = (await currentPath.innerText()).trim()
      if (previousPath === '/') break
      await expect(up).toBeEnabled()
      await up.click()
      await expect(currentPath).not.toHaveText(previousPath)
    }
    await expect(currentPath).toHaveText('/')
    await page.getByRole('button', { name: 'tmp', exact: true }).click()
    await page
      .getByRole('button', { name: new RegExp(`^${WSL_NAME}(?: project)?$`) })
      .first()
      .click()
    await page.getByRole('button', { name: 'Open this folder' }).click()

    await expect(loc.hubInventory(page)).toBeVisible({ timeout: 60_000 })
    await expect(loc.hubInventory(page).getByText('WSL').first()).toBeVisible()
    await page.getByRole('button', { name: new RegExp(`master ${WSL_NAME}`) }).click()
    await page.getByRole('button', { name: /Files Browse the project tree/ }).click()
    await expect(loc.treeEntry(page, 'README.md')).toBeVisible({ timeout: 60_000 })

    await openTerminals(page)
    await expectTerminalText(page, 0, WSL_REPO)

    await openSettings(page)
    await page.getByTestId(TestIds.settingsSection('share')).first().click()
    await page.getByPlaceholder('Device name, e.g. My iPhone').fill('Android emulator')
    await page.getByRole('button', { name: 'Create Windows + WSL link' }).click()
    const bundleLink = page.getByText(/^http:\/\/[^/]+\/pair#token=.+&bundle=/)
    const bundleFailure = page.getByText('Create Windows + WSL link failed').first()
    const outcome = await Promise.race([
      bundleLink.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'created' as const),
      bundleFailure.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'failed' as const),
    ])
    if (outcome === 'failed') {
      throw new Error(await bundleFailure.locator('xpath=..').innerText())
    }
    await expect(bundleLink).toBeVisible()
  } finally {
    execFileSync('wsl.exe', ['--distribution', distribution, '--exec', 'rm', '-rf', '--', WSL_REPO])
  }
})
