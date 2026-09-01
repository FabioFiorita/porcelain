import type { ChildProcess } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import {
  E2E_ADMIN_TOKEN,
  expect,
  loc,
  openSettings,
  REPO_DIR,
  seedIsolatedState,
  spawnDaemon,
  TestIds,
  test,
  waitForShell,
} from './helpers/app'
import { createFixtureRepo } from './helpers/fixture-repo'

/**
 * Nicknames for Environments, in the real Electron shell.
 *
 * The situation these pin is the one that produced the feature: TWO Porcelain daemons with
 * their own homes on ONE machine. They report the same host name, so before a nickname both
 * Settings rows read identically and nothing on screen says which is which. Everything here
 * is real — a second daemon with its own home, a real pairing exchange, and a rename that
 * lands on the daemon that owns the Environment rather than on this client.
 *
 * One scenario per test, each taking the screenshot that is its evidence. That split is not
 * style: a headless box drives this window with no attached display, so it produces frames
 * while the Settings dialog animates and then goes idle — only the FIRST capture of an app
 * launch returns, and every test gets its own app.
 */

const REMOTE_REPO_DIR = join(tmpdir(), 'porcelain-e2e-nickname-fixture')
const NICKNAME = 'Beelink (work)'
const LOCAL_NICKNAME = 'Studio'
// Outside Playwright's outputDir, which is wiped per run — these are the evidence.
const SHOTS = join(tmpdir(), 'porcelain-nickname-proof')

type Seeded = Awaited<ReturnType<typeof seedIsolatedState>>
type Remote = { child: ChildProcess; port: number }
type Paired = { remote: Remote | null; seed: Seeded | null }

async function daemonCall(port: number, procedure: string, input: unknown): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${port}/trpc/${procedure}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${E2E_ADMIN_TOKEN}`,
      'content-type': 'application/json',
      [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
    },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`${procedure} failed: ${response.status}`)
}

async function mintPairingLink(port: number): Promise<string> {
  const origin = `http://127.0.0.1:${port}`
  const response = await fetch(`${origin}/trpc/issuePairingLink`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${E2E_ADMIN_TOKEN}`,
      'content-type': 'application/json',
      [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
    },
    body: JSON.stringify({ label: 'E2E nickname environment', baseUrl: origin }),
  })
  if (!response.ok) throw new Error(`issuePairingLink failed: ${response.status}`)
  const body = (await response.json()) as { result?: { data?: { url?: string } } }
  const url = body.result?.data?.url
  if (url === undefined) throw new Error('issuePairingLink returned no url')
  return url
}

/**
 * Register a repository with the daemon THIS window is bound to, through the preload's
 * daemon pair — the Electron lane boots with an empty Hub, and "Add project" opens a native
 * file dialog Playwright cannot drive.
 */
async function registerOnWindowDaemon(page: Page, repoPath: string): Promise<void> {
  const failure = await page.evaluate(
    async ([path, header, version]) => {
      const daemon = window.porcelain?.daemon
      if (daemon === undefined) return 'no preload daemon pair'
      const response = await fetch(`${daemon.url}/trpc/openRepoPath`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${daemon.token}`,
          'content-type': 'application/json',
          [header]: version,
        },
        body: JSON.stringify(path),
      })
      return response.ok ? null : `openRepoPath failed: ${response.status}`
    },
    [repoPath, PROTOCOL_VERSION_HEADER, String(PROTOCOL_VERSION)] as const,
  )
  if (failure !== null) throw new Error(failure)
}

/** The label one Settings → Remotes row is showing right now. */
async function rowName(page: Page, rowId: string): Promise<string> {
  return (await page.getByTestId(TestIds.environmentName(rowId)).innerText()).trim()
}

/** Wait for a row's label to settle on `expected` — a rename round-trips to another daemon. */
async function expectRowName(page: Page, rowId: string, expected: string): Promise<void> {
  await expect.poll(async () => rowName(page, rowId), { timeout: 60_000 }).toBe(expected)
}

/** Type a name into one row's inline editor and save it. An empty name clears the nickname. */
async function setName(page: Page, rowId: string, name: string): Promise<void> {
  // Renaming is offered only once the status fan-out says that daemon answered — the row
  // renders its saved name before then, so waiting on the label is not enough.
  const open = page.getByTestId(TestIds.environmentRename(rowId))
  await expect(open).toBeEnabled({ timeout: 60_000 })
  // Real mouse clicks at each control's own coordinates. `force` skips only Playwright's
  // actionability wait, which never settles while the dialog's `enter` animation is reported
  // as running; anything covering these controls would still swallow the click and fail the
  // assertions that follow.
  await open.click({ force: true })
  await page.getByTestId(TestIds.environmentNameInput(rowId)).fill(name)
  await page.getByTestId(TestIds.environmentNameSave(rowId)).click({ force: true })
}

async function shot(page: Page, name: string): Promise<void> {
  await mkdir(SHOTS, { recursive: true })
  await page.screenshot({ path: join(SHOTS, name), animations: 'disabled', timeout: 30_000 })
}

async function openRemotes(page: Page): Promise<void> {
  await openSettings(page)
  await page.getByTestId(TestIds.settingsSection('remotes')).first().click()
}

/**
 * Bring up a second daemon with its own home and pair it as an Environment group, leaving
 * Settings → Remotes open on two rows: This device and the group. Both daemons run HERE, so
 * both announce the same machine name — which is the whole point.
 */
async function pairSecondEnvironment(
  page: Page,
  paired: Paired,
): Promise<{ groupId: string; machineName: string }> {
  await createFixtureRepo(REMOTE_REPO_DIR)
  paired.seed = await seedIsolatedState(REMOTE_REPO_DIR, true)
  paired.remote = await spawnDaemon(paired.seed)
  // Nothing opens this checkout in a window, so register it with its own daemon the way a
  // client would — that is what puts the Project in that daemon's Hub inventory.
  await daemonCall(paired.remote.port, 'openRepoPath', REMOTE_REPO_DIR)

  await waitForShell(page)
  await registerOnWindowDaemon(page, REPO_DIR)
  await page.reload()
  await waitForShell(page)
  await expect(loc.hubInventory(page)).toBeVisible()

  await openRemotes(page)
  await page.getByRole('button', { name: 'Pair an environment group' }).click()
  await page.getByPlaceholder('Connection link').fill(await mintPairingLink(paired.remote.port))
  await page.getByRole('button', { name: 'Pair environment' }).click()

  // Pairing adds a secondary session; the local Electron child remains primary and Settings
  // stays open. Wait for the paired group to appear in the current dialog.
  const groupRow = page.locator('[data-testid^="environment-name-"]').nth(1)
  await expect(groupRow).toBeVisible()
  const groupId = ((await groupRow.getAttribute('data-testid')) ?? '').replace(
    'environment-name-',
    '',
  )
  if (groupId === '') throw new Error('no environment group row appeared')
  return { groupId, machineName: await rowName(page, 'local') }
}

async function tearDown(paired: Paired): Promise<void> {
  const remote = paired.remote
  if (remote !== null) {
    const exited = new Promise<void>((resolve) => remote.child.once('exit', () => resolve()))
    remote.child.kill('SIGTERM')
    await exited
  }
  if (paired.seed !== null) {
    await rm(paired.seed.udBase, { recursive: true, force: true })
    await rm(paired.seed.userData, { recursive: true, force: true })
  }
  await rm(REMOTE_REPO_DIR, { recursive: true, force: true })
  await rm(`${REMOTE_REPO_DIR}-worktrees`, { recursive: true, force: true })
}

test.describe('Environment nicknames', () => {
  test.describe.configure({ timeout: 180_000 })

  test('two daemons on one machine read the same name until one is nicknamed', async ({
    page,
    app,
  }) => {
    test.skip(app === null, 'the shell owns Environment groups — this is the Electron lane')
    const paired: Paired = { remote: null, seed: null }
    try {
      const { groupId, machineName } = await pairSecondEnvironment(page, paired)

      // The problem, on screen: one machine, two Environments, one name.
      await expectRowName(page, groupId, machineName)
      await shot(page, '1-same-name-before.png')

      // Naming one of them separates the rows; the other is untouched.
      await setName(page, groupId, NICKNAME)
      await expectRowName(page, groupId, NICKNAME)
      expect(await rowName(page, 'local')).toBe(machineName)
    } finally {
      await tearDown(paired)
    }
  })

  test('each Environment carries its own nickname', async ({ page, app }) => {
    test.skip(app === null, 'the shell owns Environment groups — this is the Electron lane')
    const paired: Paired = { remote: null, seed: null }
    try {
      const { groupId } = await pairSecondEnvironment(page, paired)

      await setName(page, groupId, NICKNAME)
      await expectRowName(page, groupId, NICKNAME)
      await setName(page, 'local', LOCAL_NICKNAME)
      await expectRowName(page, 'local', LOCAL_NICKNAME)

      await shot(page, '2-both-named.png')
    } finally {
      await tearDown(paired)
    }
  })

  test('the Hub names its Environments by the same nickname', async ({ page, app }) => {
    test.skip(app === null, 'the shell owns Environment groups — this is the Electron lane')
    const paired: Paired = { remote: null, seed: null }
    try {
      const { groupId } = await pairSecondEnvironment(page, paired)

      await setName(page, groupId, NICKNAME)
      await expectRowName(page, groupId, NICKNAME)

      // The Hub reads the daemon-owned name through `hubInventory`, with no shell state in
      // the path. Scoped to the Hub tree, so a Settings row mounted behind the dialog
      // cannot satisfy this.
      await page.keyboard.press('Escape')
      await waitForShell(page)
      await expect(loc.hubInventory(page)).toBeVisible()
      await expect(loc.hubInventory(page).getByText(NICKNAME).first()).toBeVisible({
        timeout: 60_000,
      })
      await shot(page, '3-hub-badges.png')
    } finally {
      await tearDown(paired)
    }
  })

  test('clearing a nickname falls back to the machine name, never a blank label', async ({
    page,
    app,
  }) => {
    test.skip(app === null, 'the shell owns Environment groups — this is the Electron lane')
    const paired: Paired = { remote: null, seed: null }
    try {
      const { groupId, machineName } = await pairSecondEnvironment(page, paired)

      await setName(page, groupId, NICKNAME)
      await expectRowName(page, groupId, NICKNAME)

      // Whitespace only is a CLEAR, not a rename to a blank label.
      await setName(page, groupId, '   ')
      await expectRowName(page, groupId, machineName)
      await shot(page, '4-cleared-fallback.png')
    } finally {
      await tearDown(paired)
    }
  })
})
