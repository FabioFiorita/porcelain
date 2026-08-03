import { type ChildProcess, spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _electron,
  type Browser,
  test as baseTest,
  chromium,
  type ElectronApplication,
  expect,
  type Page,
} from '@playwright/test'
import { createFixtureRepo } from './fixture-repo'
import { loc } from './locators'
import { TestIds } from './test-ids'

const MAIN_ENTRY = join(__dirname, '..', '..', 'out', 'main', 'index.js')
const DAEMON_ENTRY = join(__dirname, '..', '..', 'out', 'main', 'daemon', 'server.js')

// Seed one browser client identity directly in the isolated access store, then
// plant its plaintext token in the same localStorage slot TokenGate uses. Minted
// per run because the fixture exposes a real loopback listener.
const BROWSER_SECRET = randomBytes(32).toString('hex')
const BROWSER_TOKEN = `pc_client_e2e-client_${BROWSER_SECRET}`
const ADMIN_TOKEN = randomBytes(32).toString('hex')

// A fixed basename so the project switcher shows a stable repo name in
// screenshots (mkdtemp's random suffix would change every run). workers=1 makes
// this single-owner safe. Exported so a spec that MUTATES the repo (file ops) can
// restore it to pristine afterward — it's shared worker-wide across spec files.
export const REPO_DIR = join(tmpdir(), 'porcelain-e2e-fixture')

// For the no-repo (Welcome) case: a path that never exists. A NON-EMPTY recents
// list stops the dev seed from auto-adding ~/code/porcelain-playground, and the
// `recentRepos` query then prunes this dead path away → genuinely empty → the
// app lands on Welcome regardless of what's on the host machine.
const ABSENT_REPO = join(tmpdir(), 'porcelain-e2e-no-such-repo')

// Playwright's launch `env` is Record<string, string>; process.env carries
// `string | undefined`. Drop the undefined entries so git (which needs PATH) and
// our overrides both make it through without a cast.
function launchEnv(extra: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  return { ...env, ...extra }
}

/** The on-disk review-set shape `porcelain review set` writes (see src/cli/review-file.ts). */
interface SeedReviewSet {
  name: string
  files: { path: string; source?: string; note?: string; layer?: string }[]
  sections?: {
    title: string
    prose: string
    diagram?: string
    anchors?: { path: string; startLine?: number; endLine?: number }[]
  }[]
}

/** Which runtime hosts the suite: the built Electron app, or headless Chromium on the daemon-served browser client. Picked per Playwright project. */
export type AppMode = 'electron' | 'browser'

interface Options {
  /**
   * Seed the app config so it auto-opens the fixture repo (default true). Set to
   * false to land on the Welcome screen.
   */
  seedRepo: boolean
  /**
   * Seed the active review under `<repo>/.porcelain/review.json` (default null →
   * the Review's empty state). Written as if the porcelain CLI had pushed it.
   */
  seedReviewSet: SeedReviewSet | null
  /**
   * Seed evidence under `<repo>/.porcelain/evidence/` (default null → none).
   * Renders as the Review's final chapter (needs a `seedReviewSet`).
   */
  seedEvidence: { title: string; html: string } | null
  /**
   * Present the renderer with a multi-touch screen (default false → a desktop
   * pointer, which is what both runtimes really are). Set it for the surfaces
   * that only exist on a tablet/phone — the terminal key bar.
   */
  touchDevice: boolean
}

/**
 * The touch seam as `isCoarseTouch()` reads it: `navigator.maxTouchPoints > 1`.
 * Overriding the property beats Playwright's `hasTouch`, which reports a SINGLE
 * point — deliberately "a pen, not a multi-touch screen" on our side of the check.
 * Runs as an init script so it lands before any renderer module evaluates.
 */
function installTouch(): void {
  Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 })
}

interface WorkerOptions {
  appMode: AppMode
}

interface Seeded {
  udBase: string
  /** The config dir (udBase + '-dev', matching the shell's is.dev suffix). */
  userData: string
  /** The PORCELAIN_* channel-isolation env both runtimes share. */
  env: Record<string, string>
}

interface Fixtures {
  /** Fresh fixture git repo for this test only (same fixed path, recreated each run). */
  repoDir: string
  seeded: Seeded
  /** The Electron app under test — null in browser mode. */
  app: ElectronApplication | null
  page: Page
}

interface WorkerFixtures {
  /** Worker-shared headless Chromium — null in electron mode (never launched). */
  sharedBrowser: Browser | null
}

/**
 * Write isolated userData (daemon token/access) + project companion files under
 * the fixture repo's `.porcelain/`. Machine home stays empty of companion channels.
 */
async function seedState(
  repoDir: string,
  seedRepo: boolean,
  seedReviewSet: SeedReviewSet | null,
  seedEvidence: { title: string; html: string } | null,
): Promise<Seeded> {
  const udBase = await mkdtemp(join(tmpdir(), 'porcelain-e2e-ud-'))
  const userData = `${udBase}-dev`
  await mkdir(userData, { recursive: true })
  await writeFile(
    join(userData, 'config.json'),
    JSON.stringify({ recentRepos: [seedRepo ? repoDir : ABSENT_REPO] }),
  )
  // Project companion lives in the fixture repo (same layout as production).
  if (seedRepo) {
    const project = join(repoDir, '.porcelain')
    await mkdir(project, { recursive: true })
    if (seedReviewSet) {
      await writeFile(join(project, 'review.json'), JSON.stringify(seedReviewSet, null, 2))
    }
    if (seedEvidence) {
      const evidenceDir = join(project, 'evidence')
      await mkdir(evidenceDir, { recursive: true })
      await writeFile(join(evidenceDir, 'index.html'), seedEvidence.html)
      await writeFile(
        join(evidenceDir, 'meta.json'),
        JSON.stringify({
          title: seedEvidence.title,
          repoPath: repoDir,
          updatedAt: '2024-01-01T12:00:00.000Z',
        }),
      )
    }
  }
  const adminTokenFile = join(udBase, 'admin-token')
  await writeFile(adminTokenFile, ADMIN_TOKEN, { mode: 0o600 })
  const accessFile = join(udBase, 'access.json')
  await writeFile(
    accessFile,
    JSON.stringify({
      version: 1,
      pairings: [],
      clients: [
        {
          id: 'e2e-client',
          label: 'E2E browser',
          secretHash: createHash('sha256').update(BROWSER_SECRET).digest('hex'),
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    }),
    { mode: 0o600 },
  )
  return {
    udBase,
    userData,
    env: {
      PORCELAIN_HOME: udBase,
      PORCELAIN_ADMIN_TOKEN_FILE: adminTokenFile,
      PORCELAIN_ACCESS_FILE: accessFile,
      // Pins a fast, config-free shell so the terminal tests are deterministic and
      // don't source the runner's zsh profile.
      PORCELAIN_SHELL: '/bin/bash',
      PORCELAIN_E2E: '1',
    },
  }
}

/** Spawn the headless daemon on an OS-assigned loopback port and resolve the port from its one stdout line. */
async function spawnDaemon(seeded: Seeded): Promise<{ child: ChildProcess; port: number }> {
  const child = spawn(process.execPath, [DAEMON_ENTRY], {
    env: launchEnv({
      ...seeded.env,
      PORCELAIN_USER_DATA: seeded.userData,
      PORCELAIN_ADMIN_TOKEN: ADMIN_TOKEN,
      // Playwright hands the child /dev/null stdin (EOF at once) — without the
      // opt-out the parent-death watchdog would kill the daemon on boot.
      PORCELAIN_NO_STDIN_WATCHDOG: '1',
    }),
    // stderr inherits so it can never back up the pipe buffer and stall the
    // daemon mid-test — and a failing run's daemon logs land in the CI output.
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const port = await new Promise<number>((resolve, reject) => {
    // The watchdog is off (see above), so a spawn that never reports a port must
    // not leave an orphan loopback listener behind — kill before rejecting.
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('daemon did not report a port in 15s'))
    }, 15_000)
    let out = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      out += chunk.toString()
      const line = out.split('\n').find((l) => l.includes('"port"'))
      if (line !== undefined) {
        clearTimeout(timer)
        resolve((JSON.parse(line) as { port: number }).port)
      }
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`daemon exited before reporting a port (code ${code})`))
    })
  })
  return { child, port }
}

export const test = baseTest.extend<Options & Fixtures, WorkerOptions & WorkerFixtures>({
  seedRepo: [true, { option: true }],
  seedReviewSet: [null, { option: true }],
  seedEvidence: [null, { option: true }],
  touchDevice: [false, { option: true }],
  // Worker-scoped so the shared Chromium can key off it; set per Playwright project.
  appMode: ['electron', { option: true, scope: 'worker' }],

  // Per-test isolation: every test starts from a pristine fixture repo at the
  // same fixed path (stable name for screenshots). No shared mutation across
  // tests — each run recreates the tree and tears worktrees down after.
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires the fixture's first arg to be a destructuring pattern.
  repoDir: async ({}, use) => {
    await rm(`${REPO_DIR}-worktrees`, { recursive: true, force: true })
    await createFixtureRepo(REPO_DIR)
    await use(REPO_DIR)
    await rm(REPO_DIR, { recursive: true, force: true })
    await rm(`${REPO_DIR}-worktrees`, { recursive: true, force: true })
  },

  sharedBrowser: [
    async ({ appMode }, use) => {
      // Launched lazily and ONLY in browser mode — the electron project must never
      // require a Chromium download (the mac release runner doesn't install one).
      if (appMode !== 'browser') {
        await use(null)
        return
      }
      const browser = await chromium.launch()
      await use(browser)
      await browser.close()
    },
    { scope: 'worker' },
  ],

  seeded: async ({ repoDir, seedRepo, seedReviewSet, seedEvidence }, use) => {
    const seeded = await seedState(repoDir, seedRepo, seedReviewSet, seedEvidence)
    await use(seeded)
    await rm(seeded.udBase, { recursive: true, force: true })
    await rm(seeded.userData, { recursive: true, force: true })
  },

  app: async ({ seeded, appMode }, use) => {
    if (appMode !== 'electron') {
      await use(null)
      return
    }
    const app = await _electron.launch({
      args: [MAIN_ENTRY, `--user-data-dir=${seeded.udBase}`],
      // PORCELAIN_E2E keeps the OS window hidden (Playwright drives the renderer
      // over CDP) so the app never pops onto the screen during a run.
      env: launchEnv(seeded.env),
    })
    await use(app)
    await app.close()
  },

  page: async ({ appMode, app, sharedBrowser, seeded, touchDevice }, use) => {
    if (appMode === 'electron') {
      if (app === null) throw new Error('electron mode without an app fixture')
      const page = await app.firstWindow()
      // Pin the OS color scheme so the theme preference's System default (the
      // seeded state) always resolves dark — CI runners and headless displays
      // otherwise report prefers-color-scheme: light and flip every baseline.
      await page.emulateMedia({ colorScheme: 'dark' })
      // The window is already open here (no context to pre-seed, unlike browser
      // mode), so the init script only takes effect on the reload that follows.
      if (touchDevice) {
        await page.addInitScript(installTouch)
        await page.reload()
      }
      await page.waitForLoadState('domcontentloaded')
      await use(page)
      return
    }
    if (sharedBrowser === null) throw new Error('browser mode without a shared browser')
    // One daemon per test (like one Electron app per test): OS-assigned port,
    // token via env, then a fresh context whose init script plants the token —
    // and the e2e flag the bridge would otherwise carry — before any page script.
    // try/finally: a setup failure after the spawn (context/goto throwing) must
    // still kill the child — the stdin watchdog is off, so nothing else would.
    const { child, port } = await spawnDaemon(seeded)
    try {
      const context = await sharedBrowser.newContext({
        // The Electron window's default size (src/main/window.ts) so layouts and
        // visual baselines frame the same way.
        viewport: { width: 1400, height: 900 },
        // Same reason as the electron fixture's emulateMedia: the theme
        // preference defaults to System, and headless Chromium reports light.
        colorScheme: 'dark',
        // TRAP (headless Chromium): the `.app-drag` titlebar row rasterizes once
        // and never repaints in screenshots — after a live light/dark flip it
        // stays the boot color in captures while the DOM (and headed Chromium,
        // and real clients) are correct. Don't chase it as an app bug.
      })
      await context.addInitScript((token) => {
        localStorage.setItem('porcelain-client-token', token)
        localStorage.setItem('porcelain-e2e', '1')
      }, BROWSER_TOKEN)
      if (touchDevice) await context.addInitScript(installTouch)
      const page = await context.newPage()
      await page.goto(`http://127.0.0.1:${port}/`)
      await use(page)
      await context.close()
    } finally {
      // SIGTERM runs the daemon's shutdown path (thread flush + child reap).
      const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
      child.kill('SIGTERM')
      await exited
    }
  },
})

export { expect } from '@playwright/test'

declare global {
  interface Window {
    /** Test-only terminal buffer reader installed by the registry under e2e. */
    __porcelainTerminalText?: (index: number) => string
    /** Marketing shots only: shrink xterm font for Retina full-window captures. */
    __porcelainSetTerminalFontSize?: (size: number) => void
  }
}

type TabName =
  | 'Files'
  | 'Search'
  | 'Changes'
  | 'History'
  | 'Review'
  | 'Feature' // alias — rail id is `feature`, label is Review
  | 'Board'
  | 'Terminal'

/** Map human/product tab names to the sidebar store id used in `data-testid`. */
function railTabId(tab: TabName): string {
  switch (tab) {
    case 'Files':
      return 'files'
    case 'Changes':
      return 'changes'
    case 'Review':
    case 'Feature':
      return 'feature'
    case 'History':
      return 'history'
    case 'Search':
      return 'search'
    case 'Board':
      return 'board'
    case 'Terminal':
      return 'terminal'
  }
}

/** Wait until the shell has finished restoring the seeded repo.
 *  Uses the rail Settings test id (not the toast's "Open settings" label).
 *  The long timeout covers a cold Electron + daemon boot under load. */
export async function waitForShell(page: Page): Promise<void> {
  await loc.railSettings(page).waitFor({ timeout: 60_000 })
}

/** Click a left-rail sidebar tab by its stable test id. */
export async function selectTab(page: Page, tab: TabName): Promise<void> {
  await loc.railTab(page, railTabId(tab)).click()
}

/**
 * Assert a terminal's on-screen text contains `text`. The WebGL renderer paints to a
 * canvas and never fills `.xterm-rows`, so we poll xterm's buffer model through the
 * `__porcelainTerminalText` test hook (installed by the registry under e2e). `index` is
 * terminal creation order (0 = first, matching the old `.xterm-rows.first()`).
 */
export async function expectTerminalText(
  page: Page,
  index: number,
  text: string,
  // 30s, not Playwright's usual 15: shell startup + arithmetic evaluation on the
  // macos-14 CI runner has gated a release once at 15s (flake, not regression) —
  // e2e is a release gate, so slower-but-stable wins here.
  timeout = 30_000,
): Promise<void> {
  await expect
    .poll(() => page.evaluate((i) => window.__porcelainTerminalText?.(i) ?? '', index), { timeout })
    .toContain(text)
}

/** Open the Settings dialog and wait for it to appear. */
export async function openSettings(page: Page): Promise<void> {
  await loc.railSettings(page).click()
  await loc.settingsDialog(page).waitFor()
}

export { loc, TestIds }
