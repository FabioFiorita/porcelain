import { type ChildProcess, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect, type Page, test } from '@playwright/test'
import { expectTerminalText, selectTab, waitForShell } from './helpers/app'
import { createDemoRepo } from './helpers/demo-repo'
import { seedDemoChannels } from './helpers/demo-seed'

// The autonomous marketing-screenshot pipeline (pnpm shots): headless Chromium at
// Retina density (deviceScaleFactor 2) driving the daemon-served web client — the
// SAME renderer bundle the Mac app loads — against a seeded demo repo with a full
// agent hand-off (published Review, board, chat, comments, loop evidence). NOT a
// baseline test: it's excluded from the normal e2e run (playwright.shots.config.ts
// matches only this file) and writes PNGs to marketing/shots/ (gitignored).
//
// Determinism matters less than looks here — the goal is one repeatable command that
// produces publishable, non-empty product shots.

const DAEMON_ENTRY = join(__dirname, '..', 'out', 'main', 'daemon', 'server.js')
const SHOTS_DIR = join(__dirname, '..', 'marketing', 'shots')
const DAEMON_TOKEN = randomBytes(16).toString('hex')

// Retina-density full window; the Electron window's default size (src/main/window.ts)
// so the seeded layouts frame the same way the shipped app does.
const VIEWPORT = { width: 1440, height: 900 }

function launchEnv(extra: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  return { ...env, ...extra }
}

/** Spawn the headless daemon on an OS-assigned loopback port; resolve the port from its stdout line. */
async function spawnDaemon(
  env: Record<string, string>,
): Promise<{ child: ChildProcess; port: number }> {
  const child = spawn(process.execPath, [DAEMON_ENTRY], {
    env: launchEnv({ ...env, PORCELAIN_NO_STDIN_WATCHDOG: '1' }),
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const port = await new Promise<number>((resolve, reject) => {
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

/** Let Shiki tokenization + font loading settle before a code-heavy shot. */
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(700)
}

/** Capture the current viewport at device (Retina) density into marketing/shots/. */
async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(SHOTS_DIR, name), scale: 'device' })
}

test('marketing shots — the seeded demo repo across every surface', async () => {
  test.setTimeout(180_000)
  await mkdir(SHOTS_DIR, { recursive: true })

  // The demo repo + its isolated config/channel dirs. Canonicalize the repo path so
  // the channels (keyed by absolute path) match whatever Porcelain resolves it to.
  const repoRaw = await mkdtemp(join(tmpdir(), 'porcelain-shots-repo-'))
  await createDemoRepo(repoRaw)
  const repoDir = await realpath(repoRaw)

  const udBase = await mkdtemp(join(tmpdir(), 'porcelain-shots-ud-'))
  const userData = `${udBase}-dev`
  await mkdir(userData, { recursive: true })
  await writeFile(
    join(userData, 'config.json'),
    JSON.stringify({ recentRepos: [repoDir], repos: {} }),
  )
  const channelEnv = await seedDemoChannels(udBase, repoDir)

  const env: Record<string, string> = {
    ...channelEnv,
    PORCELAIN_USER_DATA: userData,
    PORCELAIN_DAEMON_TOKEN: DAEMON_TOKEN,
    PORCELAIN_AGENT_THREADS: join(udBase, 'agent-threads'),
    // Pin a fast, config-free shell so the terminal shot is deterministic.
    PORCELAIN_SHELL: '/bin/bash',
    // e2e mode installs the terminal-buffer read hook (so we can wait for output
    // before shooting) and swaps agent providers for the in-process fake driver.
    PORCELAIN_E2E: '1',
    PORCELAIN_AGENT_FAKE: '1',
  }

  const browser = await chromium.launch()
  const { child, port } = await spawnDaemon(env)
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      colorScheme: 'dark',
    })
    await context.addInitScript((token) => {
      localStorage.setItem('porcelain-daemon-token', token)
      localStorage.setItem('porcelain-e2e', '1')
    }, DAEMON_TOKEN)
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:${port}/`)
    await waitForShell(page)

    // review.png — the Feature tab with the Review document opened into the viewer
    // (thesis, walkthrough sections, flow diagram, anchored diff hunks). The outline
    // lives in the sidebar; clicking the review name opens the document at the top.
    await selectTab(page, 'Feature')
    await page.getByRole('button', { name: 'Filter orders by status' }).first().click()
    const review = page.getByRole('main')
    await expect(review.getByRole('heading', { name: 'Filter orders by status' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(review.getByText('Thread the filter from the screen')).toBeVisible()
    // Extra settle for the sandboxed SVG diagram iframe to paint.
    await settle(page)
    await settle(page)
    await shoot(page, 'review.png')

    // changes-flow.png — the Changes tab: the uncommitted diff grouped into flow layers.
    await selectTab(page, 'Changes')
    await expect(page.getByText(/changed files?/)).toBeVisible({ timeout: 15_000 })
    await settle(page)
    await shoot(page, 'changes-flow.png')

    // board.png — the wide kanban in the viewer.
    await selectTab(page, 'Board')
    await page.getByRole('button', { name: 'Open board' }).click()
    const board = page.getByRole('main')
    await expect(board.getByText('Filter orders by status')).toBeVisible({ timeout: 15_000 })
    await expect(board.getByText('Export the current view as CSV')).toBeVisible()
    await settle(page)
    await shoot(page, 'board.png')

    // viewer.png — a source file open with syntax highlighting.
    await selectTab(page, 'Files')
    await page.getByRole('button', { name: 'src', exact: true }).click()
    await page.getByRole('button', { name: 'pages', exact: true }).click()
    await page.getByRole('button', { name: 'OrdersPage.tsx', exact: true }).click()
    await expect(page.getByText('OrdersPage.tsx').first()).toBeVisible({ timeout: 15_000 })
    await settle(page)
    await shoot(page, 'viewer.png')

    // terminal.png — a real PTY round-trip showing the repo's git state + history.
    await selectTab(page, 'Terminal')
    await page.getByRole('button', { name: 'New terminal' }).click()
    const input = page.locator('.xterm-helper-textarea').first()
    await input.waitFor()
    await input.focus()
    await expectTerminalText(page, 0, '$')
    // TRAP: the xterm WebGL renderer paints to a canvas that headless Chromium leaves
    // BLANK in a screenshot for normal scrollback output — the buffer holds the text
    // (expectTerminalText still passes) but nothing is captured. A full-screen pager
    // (`less` on the alternate screen) DOES paint, so drive `git log -p` through it:
    // a colored commit + diff that fills the terminal, with the marker on screen one.
    await page.keyboard.type('git -c color.ui=always log -p')
    await page.keyboard.press('Enter')
    await expectTerminalText(page, 0, 'relabel the pagination')
    await settle(page)
    await shoot(page, 'terminal.png')

    await context.close()
  } finally {
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
    child.kill('SIGTERM')
    await exited
    await browser.close()
    await rm(repoRaw, { recursive: true, force: true })
    await rm(udBase, { recursive: true, force: true })
    await rm(userData, { recursive: true, force: true })
  }
})
