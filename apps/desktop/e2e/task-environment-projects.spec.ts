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
 * The New Task composer's Project picker, scoped to the chosen Environment.
 *
 * The situation this pins is the one that produced the change: a Hub reaching TWO
 * Environments listed every Project from both in one flat picker, so nothing on screen said
 * which Project lived on which machine and a Task could be filed against a checkout that does
 * not exist on the daemon receiving it. Everything here is real — a second daemon with its own
 * home, its own Project, and a real pairing exchange.
 *
 * One scenario per test, each taking the screenshot that is its evidence. That split is not
 * style: a headless box drives this window with no attached display, so it produces frames
 * while the dialog animates and then goes idle — only the FIRST capture of an app launch
 * returns, and every test gets its own app.
 */

const REMOTE_REPO_DIR = join(tmpdir(), 'porcelain-e2e-taskenv-fixture')
/** The remote daemon's nickname — also the proof that the picker labels a machine by it. */
const NICKNAME = 'Beelink (work)'
const LOCAL_PROJECT = 'porcelain-e2e-fixture'
const REMOTE_PROJECT = 'porcelain-e2e-taskenv-fixture'
// Outside Playwright's outputDir, which is wiped per run — these are the evidence.
const SHOTS = join(tmpdir(), 'porcelain-task-environment-proof')

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
    body: JSON.stringify({ label: 'E2E task environment', baseUrl: origin }),
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

/** Type a nickname into one Settings → Remotes row and save it. */
async function setName(page: Page, rowId: string, name: string): Promise<void> {
  // Renaming is offered only once the status fan-out says that daemon answered — the row
  // renders its saved name before then, so waiting on the label is not enough.
  const open = page.getByTestId(TestIds.environmentRename(rowId))
  await expect(open).toBeEnabled({ timeout: 60_000 })
  // `force` skips only Playwright's actionability wait, which never settles while the
  // dialog's enter animation is reported as running.
  await open.click({ force: true })
  await page.getByTestId(TestIds.environmentNameInput(rowId)).fill(name)
  await page.getByTestId(TestIds.environmentNameSave(rowId)).click({ force: true })
  await expect
    .poll(async () => (await page.getByTestId(TestIds.environmentName(rowId)).innerText()).trim(), {
      timeout: 60_000,
    })
    .toBe(name)
}

async function shot(page: Page, name: string): Promise<void> {
  await mkdir(SHOTS, { recursive: true })
  await page.screenshot({ path: join(SHOTS, name), animations: 'disabled', timeout: 30_000 })
}

/**
 * Bring up a second daemon with its own home — and, unless `withProject` is false, its own
 * Project — then pair it as an Environment group and nickname it. Leaves the Tasks surface
 * open with the New Task dialog showing an Environment picker over two real daemons.
 */
async function pairSecondEnvironment(
  page: Page,
  paired: Paired,
  options: { withProject?: boolean } = {},
): Promise<void> {
  const withProject = options.withProject ?? true
  await createFixtureRepo(REMOTE_REPO_DIR)
  paired.seed = await seedIsolatedState(REMOTE_REPO_DIR, withProject)
  paired.remote = await spawnDaemon(paired.seed)
  // Nothing opens this checkout in a window, so register it with its own daemon the way a
  // client would — that is what puts the Project in that daemon's Hub inventory.
  if (withProject) await daemonCall(paired.remote.port, 'openRepoPath', REMOTE_REPO_DIR)

  await waitForShell(page)
  await registerOnWindowDaemon(page, REPO_DIR)
  await page.reload()
  await waitForShell(page)
  await expect(loc.hubInventory(page)).toBeVisible()

  await openSettings(page)
  await page.getByTestId(TestIds.settingsSection('remotes')).first().click()
  await page.getByRole('button', { name: 'Pair an environment group' }).click()
  await page.getByPlaceholder('Connection link').fill(await mintPairingLink(paired.remote.port))
  await page.getByRole('button', { name: 'Pair & use here' }).click()

  await waitForShell(page)
  await expect(loc.hubInventory(page)).toBeVisible()
  await openSettings(page)
  await page.getByTestId(TestIds.settingsSection('remotes')).first().click()
  const groupRow = page.locator('[data-testid^="environment-name-"]').nth(1)
  await expect(groupRow).toBeVisible()
  const groupId = ((await groupRow.getAttribute('data-testid')) ?? '').replace(
    'environment-name-',
    '',
  )
  if (groupId === '') throw new Error('no environment group row appeared')
  // Both daemons run on THIS machine and announce the same host, so the nickname is the only
  // label that tells the two Environment options apart in the composer.
  await setName(page, groupId, NICKNAME)
  await page.keyboard.press('Escape')
  await waitForShell(page)
}

/** Open Tasks → New Task and wait for the composer. */
async function openComposer(page: Page): Promise<void> {
  await loc.tasksOpen(page).click()
  await loc.tasksNew(page).click()
  await expect(loc.tasksDialog(page)).toBeVisible()
  await expect(loc.tasksComposer(page)).toBeVisible()
}

/** Pick one Environment in the composer's Environment picker. */
async function chooseEnvironment(page: Page, name: string): Promise<void> {
  await page.getByTestId(TestIds.tasksComposerEnvironment).click({ force: true })
  await page.getByRole('option', { name }).click({ force: true })
  // `toContainText`, not `toHaveText`: the trigger renders its chevron as a text glyph.
  await expect(page.getByTestId(TestIds.tasksComposerEnvironment)).toContainText(name)
  // Both pickers render their options into the same portal, so a still-open Environment
  // popup would answer a question meant for the Project one.
  await expect(page.getByRole('option')).toHaveCount(0)
}

/** Every Project label the composer's Project picker is offering right now. */
async function projectOptions(page: Page): Promise<string[]> {
  await page.getByTestId(TestIds.tasksComposerProject).click({ force: true })
  const options = page.getByRole('option')
  await expect(options.first()).toBeVisible()
  return (await options.allInnerTexts()).map((text) => text.trim())
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

test.describe('New Task: Projects follow the chosen Environment', () => {
  test.describe.configure({ timeout: 240_000 })

  test('This device offers only the Projects on this device', async ({ page, app }) => {
    test.skip(app === null, 'the shell owns Environment groups — this is the Electron lane')
    const paired: Paired = { remote: null, seed: null }
    try {
      await pairSecondEnvironment(page, paired)
      await openComposer(page)
      await chooseEnvironment(page, 'This device')

      const options = await projectOptions(page)
      await shot(page, '2-filtered-this-device.png')
      expect(options).toContain(LOCAL_PROJECT)
      expect(options).not.toContain(REMOTE_PROJECT)
    } finally {
      await tearDown(paired)
    }
  })

  test('the nicknamed Environment offers only its own Projects', async ({ page, app }) => {
    test.skip(app === null, 'the shell owns Environment groups — this is the Electron lane')
    const paired: Paired = { remote: null, seed: null }
    try {
      await pairSecondEnvironment(page, paired)
      await openComposer(page)
      await chooseEnvironment(page, NICKNAME)

      const options = await projectOptions(page)
      await shot(page, '3-filtered-nicknamed-environment.png')
      expect(options).toContain(REMOTE_PROJECT)
      expect(options).not.toContain(LOCAL_PROJECT)
    } finally {
      await tearDown(paired)
    }
  })

  /**
   * The failure the change exists to prevent: a Project chosen under one Environment must not
   * ride along into another, where its id names a checkout that daemon has never seen.
   */
  test('switching Environment drops the Project chosen under the old one', async ({
    page,
    app,
  }) => {
    test.skip(app === null, 'the shell owns Environment groups — this is the Electron lane')
    const paired: Paired = { remote: null, seed: null }
    try {
      await pairSecondEnvironment(page, paired)
      await openComposer(page)
      await chooseEnvironment(page, 'This device')

      await page.getByTestId(TestIds.tasksComposerProject).click({ force: true })
      await page.getByRole('option', { name: LOCAL_PROJECT }).click({ force: true })
      await expect(page.getByTestId(TestIds.tasksComposerProject)).toContainText(LOCAL_PROJECT)
      await expect(page.getByRole('option')).toHaveCount(0)

      await chooseEnvironment(page, NICKNAME)
      await expect(page.getByTestId(TestIds.tasksComposerProject)).toContainText('No project')
      await shot(page, '4-switch-clears-stale-project.png')
    } finally {
      await tearDown(paired)
    }
  })

  test('an Environment with no Projects says so instead of offering nothing', async ({
    page,
    app,
  }) => {
    test.skip(app === null, 'the shell owns Environment groups — this is the Electron lane')
    const paired: Paired = { remote: null, seed: null }
    try {
      await pairSecondEnvironment(page, paired, { withProject: false })
      await openComposer(page)
      // Before any Environment is named there is no Project list to show — the composer says
      // that rather than offering a list whose machine nobody has chosen yet.
      await expect(page.getByTestId(TestIds.tasksComposerProject)).toContainText(
        'Choose an Environment first',
      )

      await chooseEnvironment(page, NICKNAME)
      await expect(page.getByTestId(TestIds.tasksComposerProject)).toContainText(
        'No Projects on this Environment',
      )
      await shot(page, '5-environment-without-projects.png')
    } finally {
      await tearDown(paired)
    }
  })
})
