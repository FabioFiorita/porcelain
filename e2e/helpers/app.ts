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

const MAIN_ENTRY = join(__dirname, '..', '..', 'out', 'main', 'index.js')
const DAEMON_ENTRY = join(__dirname, '..', '..', 'out', 'main', 'daemon', 'server.js')

// Browser-mode session token: the daemon takes it via env (PORCELAIN_DAEMON_TOKEN),
// the page presents it from localStorage — the same slot the TokenGate screen
// persists to — planted by addInitScript before any script runs, so no gate UI is
// involved and the client connects same-origin on first load. Minted per run, NOT
// a committed constant: the daemon is a real loopback listener during the test,
// and the audit invariant's whole point is that any webpage the user has open can
// reach 127.0.0.1 — a public token would make the gate decorative.
const BROWSER_TOKEN = randomBytes(16).toString('hex')

// A fixed basename so the project switcher shows a stable repo name in
// screenshots (mkdtemp's random suffix would change every run). workers=1 makes
// this single-owner safe. Exported so a spec that MUTATES the repo (file ops) can
// restore it to pristine afterward — it's shared worker-wide across spec files.
export const REPO_DIR = join(tmpdir(), 'porcelain-e2e-fixture')

// For the no-repo (Welcome) case: a path that never exists. A NON-EMPTY recents
// list stops the dev seed from auto-adding ~/Code/porcelain-playground, and the
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
   * Seed the review-set channel for the fixture repo (default null → the Review's
   * empty state). Written keyed by the fixture repo at launch, exactly as if the
   * porcelain CLI had pushed it, so the Feature outline + Review document render.
   */
  seedReviewSet: SeedReviewSet | null
  /**
   * Seed the loop-evidence channel for the fixture repo (default null → none).
   * Renders as the Review's final chapter (needs a `seedReviewSet` — without a
   * review set the Review shows only its empty state).
   */
  seedEvidence: { title: string; html: string } | null
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
  seeded: Seeded
  /** The Electron app under test — null in browser mode. */
  app: ElectronApplication | null
  page: Page
}

interface WorkerFixtures {
  repoDir: string
  /** Worker-shared headless Chromium — null in electron mode (never launched). */
  sharedBrowser: Browser | null
}

/**
 * Write the isolated userData + agent-channel files a run reads, identically for
 * both modes: the Electron shell resolves userData itself (appending '-dev' on the
 * is.dev path — the built app launched outside a package counts as dev), while the
 * browser-mode daemon is handed the same '-dev' dir via PORCELAIN_USER_DATA.
 * Isolation matters: the Feature/Terminal/Board tabs and the flow grouping stay
 * deterministic and we never read or touch the user's real ~/.porcelain files.
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
    JSON.stringify({ recentRepos: [seedRepo ? repoDir : ABSENT_REPO], repos: {} }),
  )
  const reviewSets = join(udBase, 'review-sets.json')
  await writeFile(reviewSets, JSON.stringify(seedReviewSet ? { [repoDir]: seedReviewSet } : {}))
  const actions = join(udBase, 'actions.json')
  await writeFile(actions, '{}')
  const board = join(udBase, 'board.json')
  await writeFile(board, '{}')
  const layers = join(udBase, 'layers.json')
  await writeFile(layers, '{}')
  const reviewed = join(udBase, 'reviewed.json')
  await writeFile(reviewed, '{}')
  const notes = join(udBase, 'notes.json')
  await writeFile(notes, '{}')
  const comments = join(udBase, 'comments.json')
  await writeFile(comments, '{}')
  const chat = join(udBase, 'chat.json')
  await writeFile(chat, '{}')
  const featureView = join(udBase, 'feature-view.json')
  await writeFile(featureView, '{}')
  // Loop evidence is a directory of files (index.html + optional assets), not JSON.
  // Seed the on-disk layout the app/CLI share (see evidence-paths.ts).
  const evidenceRoot = join(udBase, 'loop-evidence')
  await mkdir(evidenceRoot, { recursive: true })
  if (seedEvidence) {
    const key = createHash('sha256').update(repoDir).digest('hex').slice(0, 16)
    const evidenceDir = join(evidenceRoot, key)
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
  // Legacy empty json so env redirect still isolates any leftover json readers.
  const evidence = join(udBase, 'evidence.json')
  await writeFile(evidence, '{}')
  // Agent threads persist to their own directory (the same PORCELAIN_AGENT_THREADS escape
  // hatch dev/tests use), so a thread never touches the user's real ~/.porcelain, and it
  // survives a window reload the way the daemon-owned thread does. Left uncreated — the
  // store treats an absent dir as "no threads yet".
  const agentThreads = join(udBase, 'agent-threads')
  return {
    udBase,
    userData,
    env: {
      PORCELAIN_REVIEW_SETS: reviewSets,
      PORCELAIN_ACTIONS: actions,
      PORCELAIN_BOARD: board,
      PORCELAIN_LAYERS: layers,
      PORCELAIN_REVIEWED: reviewed,
      PORCELAIN_NOTES: notes,
      PORCELAIN_COMMENTS: comments,
      PORCELAIN_CHAT: chat,
      PORCELAIN_FEATURE_VIEW: featureView,
      PORCELAIN_EVIDENCE: evidence,
      PORCELAIN_LOOP_EVIDENCE_DIR: evidenceRoot,
      PORCELAIN_AGENT_THREADS: agentThreads,
      // Swap every agent provider slot for the scripted in-process fake driver so the
      // Agent tab has a deterministic turn to drive (no real CLI / auth / network).
      PORCELAIN_AGENT_FAKE: '1',
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
      PORCELAIN_DAEMON_TOKEN: BROWSER_TOKEN,
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
  // Worker-scoped so the shared Chromium can key off it; set per Playwright project.
  appMode: ['electron', { option: true, scope: 'worker' }],

  repoDir: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires the fixture's first arg to be a destructuring pattern.
    async ({}, use) => {
      // The worktree flow (Agent → "New thread in worktree…") creates sibling
      // `<repo>-worktrees/<branch>` dirs; clear them too so a prior run's leftovers
      // don't make `git worktree add` collide.
      await rm(`${REPO_DIR}-worktrees`, { recursive: true, force: true })
      await createFixtureRepo(REPO_DIR)
      await use(REPO_DIR)
      await rm(REPO_DIR, { recursive: true, force: true })
      await rm(`${REPO_DIR}-worktrees`, { recursive: true, force: true })
    },
    { scope: 'worker' },
  ],

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

  page: async ({ appMode, app, sharedBrowser, seeded }, use) => {
    if (appMode === 'electron') {
      if (app === null) throw new Error('electron mode without an app fixture')
      const page = await app.firstWindow()
      // Pin the OS color scheme so the theme preference's System default (the
      // seeded state) always resolves dark — CI runners and headless displays
      // otherwise report prefers-color-scheme: light and flip every baseline.
      await page.emulateMedia({ colorScheme: 'dark' })
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
        localStorage.setItem('porcelain-daemon-token', token)
        localStorage.setItem('porcelain-e2e', '1')
      }, BROWSER_TOKEN)
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
  }
}

type TabName =
  | 'Files'
  | 'Search'
  | 'Changes'
  | 'History'
  | 'Feature'
  | 'Board'
  | 'Chat'
  | 'Terminal'
  | 'Agent'

/** Wait until the shell has finished restoring the seeded repo. `exact` matters:
 *  getByRole matches substrings, so the skills-update toast's "Open settings" button
 *  collides with the rail's "Settings" whenever the toast is mounted — a timing
 *  flake. The long timeout covers a cold Electron + daemon boot under load. */
export async function waitForShell(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings', exact: true }).waitFor({ timeout: 60_000 })
}

/** Click a left-rail sidebar tab by its label. */
export async function selectTab(page: Page, tab: TabName): Promise<void> {
  await page.getByRole('button', { name: tab, exact: true }).click()
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
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('dialog').waitFor()
}
