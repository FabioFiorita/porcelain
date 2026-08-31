import type { ChildProcess } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import type { Page } from '@playwright/test'
import {
  E2E_ADMIN_TOKEN,
  expect,
  loc,
  openSettings,
  REPO_DIR,
  seedIsolatedState,
  spawnDaemon,
  test,
  TestIds,
  waitForShell,
} from './helpers/app'
import { createFixtureRepo } from './helpers/fixture-repo'

/**
 * Opening and restoring a Hub Worktree that lives on ANOTHER Environment, in Electron.
 *
 * The renderer holds one client session per Environment while the shell keeps its local child
 * as the primary connection. Everything here is real: two daemons with their own homes and
 * repositories, a real pairing exchange, and a reload that exercises persisted Hub selection.
 *
 * The regression it pins produced three toasts and no navigation at all — "The target
 * Environment is offline." for a row on another Environment (the renderer was handed a
 * SHELL environment-group id it cannot resolve) and "The Project path was not found." for
 * the local row while the window sat on a remote (that row's null means "the local daemon",
 * not "this window's client", so a local path was asked of the remote daemon).
 */

const REMOTE_REPO_DIR = join(tmpdir(), 'porcelain-e2e-remote-fixture')
const LOCAL_TITLE = `${basename(REPO_DIR)} — Porcelain`
const REMOTE_TITLE = `${basename(REMOTE_REPO_DIR)} — Porcelain`

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

/**
 * Register a repository with the daemon THIS window is bound to, through the preload's
 * daemon pair — the Electron lane boots with an empty Hub, and the "Add project" control
 * opens a native file dialog Playwright cannot drive.
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
      return response.ok ? null : `openRepoPath failed: ${response.status} ${await response.text()}`
    },
    [repoPath, PROTOCOL_VERSION_HEADER, String(PROTOCOL_VERSION)] as const,
  )
  if (failure !== null) throw new Error(failure)
}

/**
 * The daemon THIS window is bound to, straight from the preload pair the renderer uses.
 * Empty while the shell's rebind reload is in flight — that is a "not yet", so polls keep
 * going instead of failing on a destroyed execution context.
 */
async function boundDaemonUrl(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => window.porcelain?.daemon.url ?? '')
  } catch {
    return ''
  }
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
    body: JSON.stringify({ label: 'E2E second environment', baseUrl: origin }),
  })
  if (!response.ok) throw new Error(`issuePairingLink failed: ${response.status}`)
  const body = (await response.json()) as { result?: { data?: { url?: string } } }
  const url = body.result?.data?.url
  if (url === undefined) throw new Error('issuePairingLink returned no url')
  return url
}

test('a Hub Worktree on another Environment opens and survives a cold renderer restore', async ({
  page,
  app,
}) => {
  test.setTimeout(180_000)
  if (app === null) throw new Error('this spec is the Electron lane')

  // A SECOND daemon: its own home, its own access store, its own repository. Same machine,
  // which is the awkward case rather than an easy one — the paths of BOTH checkouts exist
  // here, so "did the click open the right repo" cannot tell the daemons apart. The bound
  // daemon url can, and that is what every assertion below turns on.
  await createFixtureRepo(REMOTE_REPO_DIR)
  const remoteSeed = await seedIsolatedState(REMOTE_REPO_DIR, true)
  let remote: { child: ChildProcess; port: number } | null = null
  try {
    remote = await spawnDaemon(remoteSeed)
    const remoteUrl = `http://127.0.0.1:${remote.port}`
    // Nothing opens this checkout in a window, so register it with its own daemon the way a
    // client would — that is what puts the Project in that daemon's Hub inventory.
    await daemonCall(remote.port, 'openRepoPath', REMOTE_REPO_DIR)

    await waitForShell(page)
    const localUrl = await boundDaemonUrl(page)
    expect(localUrl).not.toBe(remoteUrl)
    await registerOnWindowDaemon(page, REPO_DIR)
    await page.reload()
    await waitForShell(page)
    await expect(loc.hubInventory(page)).toBeVisible()
    await expect(page).toHaveTitle(LOCAL_TITLE)

    // Pair the second daemon. The window stays local-primary while its renderer gains an
    // explicit live session for the remote Environment.
    const link = await mintPairingLink(remote.port)
    await openSettings(page)
    await page.getByTestId(TestIds.settingsSection('remotes')).first().click()
    await page.getByRole('button', { name: 'Pair an environment group' }).click()
    await page.getByPlaceholder('Connection link').fill(link)
    await page.getByRole('button', { name: 'Pair environment' }).click()
    await loc.settingsDialog(page).getByRole('button', { name: 'Close' }).click()
    await page.reload()

    await waitForShell(page)
    await expect(loc.hubInventory(page)).toBeVisible()
    await expect(loc.hubProjects(page)).toHaveCount(2)
    expect(await boundDaemonUrl(page)).toBe(localUrl)

    // Rows name their Project, and neither fixture name contains the other.
    const localRow = loc.hubWorktrees(page).filter({ hasText: basename(REPO_DIR) })
    const remoteRow = loc.hubWorktrees(page).filter({ hasText: basename(REMOTE_REPO_DIR) })

    // 1. The local row stays on the primary daemon.
    await localRow.click()
    await expect(page).toHaveTitle(LOCAL_TITLE, { timeout: 60_000 })
    await expect.poll(async () => boundDaemonUrl(page), { timeout: 60_000 }).toBe(localUrl)
    await expect(page.getByText('The Project path was not found.')).toHaveCount(0)
    await expect(page.getByText('The target Environment is offline.')).toHaveCount(0)

    // 2. The remote row routes through its Environment session without rebinding the shell.
    await waitForShell(page)
    await expect(loc.hubProjects(page)).toHaveCount(2)
    await remoteRow.click()
    await expect(page).toHaveTitle(REMOTE_TITLE, { timeout: 60_000 })
    await expect.poll(async () => boundDaemonUrl(page), { timeout: 60_000 }).toBe(localUrl)
    await expect(page.getByText('The target Environment is offline.')).toHaveCount(0)
    await expect(page.getByText('The Project path was not found.')).toHaveCount(0)

    // A fresh renderer boots local-primary. The persisted Worktree must remain remote-owned:
    // asking the local daemon to open REMOTE_REPO_DIR would fall back to its local recent repo,
    // then send that local path through the remote Files owner and leave the tree on Loading….
    await page.reload()
    await waitForShell(page)
    await expect(page).toHaveTitle(REMOTE_TITLE, { timeout: 60_000 })
    await loc.railTab(page, 'files').click()
    await expect(loc.treeEntry(page, 'README.md')).toBeVisible({ timeout: 60_000 })
    expect(await boundDaemonUrl(page)).toBe(localUrl)
  } finally {
    if (remote !== null) {
      const exited = new Promise<void>((resolve) => remote?.child.once('exit', () => resolve()))
      remote.child.kill('SIGTERM')
      await exited
    }
    await rm(remoteSeed.udBase, { recursive: true, force: true })
    await rm(remoteSeed.userData, { recursive: true, force: true })
    await rm(REMOTE_REPO_DIR, { recursive: true, force: true })
    await rm(`${REMOTE_REPO_DIR}-worktrees`, { recursive: true, force: true })
  }
})
