import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _electron,
  test as baseTest,
  type ElectronApplication,
  expect,
  type Page,
} from '@playwright/test'
import { createFixtureRepo } from './fixture-repo'

const MAIN_ENTRY = join(__dirname, '..', '..', 'out', 'main', 'index.js')

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

interface Options {
  /**
   * Seed the app config so it auto-opens the fixture repo (default true). Set to
   * false to land on the Welcome screen.
   */
  seedRepo: boolean
  /**
   * Seed the feature-artifact channel for the fixture repo (default null → none, so
   * the Feature tab shows no artifact opener). When set, the app finds an authored
   * artifact keyed by the fixture repo at launch, exactly as if the MCP server had
   * written one. `updatedAt` is filled in for you.
   */
  seedArtifact: { title: string; html: string } | null
  /**
   * Seed the loop-evidence channel for the fixture repo (default null → none). Same
   * shape as seedArtifact; opens as "Loop evidence" in the Feature tab.
   */
  seedEvidence: { title: string; html: string } | null
}

interface Fixtures {
  app: ElectronApplication
  page: Page
}

interface WorkerFixtures {
  repoDir: string
}

export const test = baseTest.extend<Options & Fixtures, WorkerFixtures>({
  seedRepo: [true, { option: true }],
  seedArtifact: [null, { option: true }],
  seedEvidence: [null, { option: true }],

  repoDir: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires the fixture's first arg to be a destructuring pattern.
    async ({}, use) => {
      await createFixtureRepo(REPO_DIR)
      await use(REPO_DIR)
      await rm(REPO_DIR, { recursive: true, force: true })
    },
    { scope: 'worker' },
  ],

  app: async ({ repoDir, seedRepo, seedArtifact, seedEvidence }, use) => {
    const udBase = await mkdtemp(join(tmpdir(), 'porcelain-e2e-ud-'))
    // main appends '-dev' to userData on the is.dev path (the built app launched
    // outside a package counts as dev), so the config it actually reads is there.
    const userData = `${udBase}-dev`
    await mkdir(userData, { recursive: true })
    await writeFile(
      join(userData, 'config.json'),
      JSON.stringify({ recentRepos: [seedRepo ? repoDir : ABSENT_REPO], repos: {} }),
    )
    // Isolate the agent channels (review sets, actions, board, layers, reviewed marks)
    // so the Feature/Terminal/Board tabs and the flow grouping are deterministic and we
    // never read or touch the user's real ~/.porcelain files.
    const reviewSets = join(udBase, 'review-sets.json')
    await writeFile(reviewSets, '{}')
    const actions = join(udBase, 'actions.json')
    await writeFile(actions, '{}')
    const board = join(udBase, 'board.json')
    await writeFile(board, '{}')
    const layers = join(udBase, 'layers.json')
    await writeFile(layers, '{}')
    const reviewed = join(udBase, 'reviewed.json')
    await writeFile(reviewed, '{}')
    // The feature-artifact channel (agent-authored HTML). Seeded keyed by the fixture
    // repo when the spec asks for one, so the artifact opener is present at launch.
    const artifacts = join(udBase, 'artifacts.json')
    await writeFile(
      artifacts,
      JSON.stringify(
        seedArtifact
          ? { [repoDir]: { ...seedArtifact, updatedAt: '2024-01-01T12:00:00.000Z' } }
          : {},
      ),
    )
    // Loop evidence (agent-authored validation proof). Same seed shape as artifacts.
    const evidence = join(udBase, 'evidence.json')
    await writeFile(
      evidence,
      JSON.stringify(
        seedEvidence
          ? { [repoDir]: { ...seedEvidence, updatedAt: '2024-01-01T12:00:00.000Z' } }
          : {},
      ),
    )
    // Agent threads persist to their own directory (the same PORCELAIN_AGENT_THREADS escape
    // hatch dev/tests use), so a thread never touches the user's real ~/.porcelain, and it
    // survives a window reload the way the daemon-owned thread does. Left uncreated — the
    // store treats an absent dir as "no threads yet".
    const agentThreads = join(udBase, 'agent-threads')

    const app = await _electron.launch({
      args: [MAIN_ENTRY, `--user-data-dir=${udBase}`],
      // PORCELAIN_E2E keeps the OS window hidden (Playwright drives the renderer
      // over CDP) so the app never pops onto the screen during a run.
      // PORCELAIN_SHELL pins a fast, config-free shell so the terminal test is
      // deterministic and doesn't source the runner's zsh profile.
      env: launchEnv({
        PORCELAIN_REVIEW_SETS: reviewSets,
        PORCELAIN_ACTIONS: actions,
        PORCELAIN_BOARD: board,
        PORCELAIN_LAYERS: layers,
        PORCELAIN_REVIEWED: reviewed,
        PORCELAIN_ARTIFACTS: artifacts,
        PORCELAIN_EVIDENCE: evidence,
        PORCELAIN_AGENT_THREADS: agentThreads,
        // Swap every agent provider slot for the scripted in-process fake driver so the
        // Agent tab has a deterministic turn to drive (no real CLI / auth / network).
        PORCELAIN_AGENT_FAKE: '1',
        PORCELAIN_SHELL: '/bin/bash',
        PORCELAIN_E2E: '1',
      }),
    })
    await use(app)
    await app.close()
    await rm(udBase, { recursive: true, force: true })
    await rm(userData, { recursive: true, force: true })
  },

  page: async ({ app }, use) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  },
})

export { expect } from '@playwright/test'

declare global {
  interface Window {
    /** Test-only terminal buffer reader installed by the registry under e2e. */
    __porcelainTerminalText?: (index: number) => string
  }
}

type TabName = 'Files' | 'Changes' | 'History' | 'Feature' | 'Board' | 'Terminal' | 'Agent'

/** Wait until the shell has finished restoring the seeded repo. */
export async function waitForShell(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).waitFor()
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
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog').waitFor()
}
