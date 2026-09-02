import { execFileSync } from 'node:child_process'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
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
    await page.getByRole('button', { name: 'Set up and open' }).click()

    await expect
      .poll(
        () =>
          page.evaluate(
            async ([header, version]) => {
              const daemon = window.porcelain?.daemon
              if (daemon === undefined) return null
              const response = await fetch(`${daemon.url}/trpc/daemonInfo`, {
                headers: { authorization: `Bearer ${daemon.token}`, [header]: version },
              })
              if (!response.ok) return null
              const body = (await response.json()) as {
                result?: { data?: { platform?: string } }
              }
              return body.result?.data?.platform ?? null
            },
            [PROTOCOL_VERSION_HEADER, String(PROTOCOL_VERSION)] as const,
          ),
        { timeout: 2 * 60_000 },
      )
      .toBe('linux')
    await waitForShell(page)

    const result = await page.evaluate(
      async ([repoPath, header, version]) => {
        const daemon = window.porcelain?.daemon
        if (daemon === undefined) return { error: 'missing daemon pair', platform: null }
        const info = await fetch(`${daemon.url}/trpc/daemonInfo`, {
          headers: { authorization: `Bearer ${daemon.token}`, [header]: version },
        })
        const opened = await fetch(`${daemon.url}/trpc/openRepoPath`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${daemon.token}`,
            'content-type': 'application/json',
            [header]: version,
          },
          body: JSON.stringify(repoPath),
        })
        const body = (await info.json()) as { result?: { data?: { platform?: string } } }
        return {
          error: opened.ok ? null : `openRepoPath failed: ${opened.status}`,
          platform: body.result?.data?.platform ?? null,
        }
      },
      [WSL_REPO, PROTOCOL_VERSION_HEADER, String(PROTOCOL_VERSION)] as const,
    )
    expect(result).toEqual({ error: null, platform: 'linux' })

    await page.reload()
    await waitForShell(page)
    await expect(loc.hubInventory(page)).toBeVisible({ timeout: 60_000 })
    await expect(
      loc.hubInventory(page).getByText('porcelain-wsl-e2e-project').first(),
    ).toBeVisible()
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
