import { type ChildProcess, spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type Browser,
  type BrowserContext,
  chromium,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'
import { expectTerminalText, selectTab, TestIds, waitForShell } from './helpers/app'
import { createDemoRepo } from './helpers/demo-repo'
import { seedDemoChannels } from './helpers/demo-seed'
import { byId } from './helpers/locators'

// The autonomous marketing-screenshot pipeline (pnpm shots): headless Chromium at
// Retina density (deviceScaleFactor 2) driving the daemon-served web client — the
// SAME renderer bundle the Mac app loads — against a seeded demo repo with a full
// agent hand-off (published Review, board, comments, loop evidence). NOT a baseline
// test: it's excluded from the normal e2e run (playwright.shots.config.ts matches
// only this file) and writes PNGs to marketing/shots/ (gitignored).
//
// Determinism matters less than looks here — the goal is one repeatable command that
// produces publishable, non-empty product shots.

const DAEMON_ENTRY = join(__dirname, '..', 'out', 'main', 'daemon', 'server.js')
const SHOTS_DIR = join(__dirname, '..', '..', '..', 'marketing', 'shots')
const DAEMON_SECRET = randomBytes(32).toString('hex')
const DAEMON_TOKEN = `pc_client_marketing_${DAEMON_SECRET}`
const ADMIN_TOKEN = randomBytes(32).toString('hex')

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

/**
 * Modal crops: element screenshots are rectangles, so rounded corners would show
 * app chrome (selection teal, etc.) through transparent corners. Solidify the
 * dialog overlay to product dark, drop the soft shadow, then clip a 1px inset.
 */
async function shootModal(page: Page, locator: Locator, name: string): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('porcelain-shot-modal-mask')?.remove()
    const mask = document.createElement('div')
    mask.id = 'porcelain-shot-modal-mask'
    mask.style.cssText = 'position:fixed;inset:0;z-index:49;background:#090b0c;pointer-events:none'
    document.body.appendChild(mask)
    for (const el of document.querySelectorAll<HTMLElement>(
      '[data-slot="dialog-overlay"], [data-slot="dialog-content"]',
    )) {
      el.dataset.porcelainShotOverlay = '1'
      if (el.getAttribute('data-slot') === 'dialog-overlay') {
        el.style.setProperty('background', '#090b0c', 'important')
        el.style.setProperty('backdrop-filter', 'none', 'important')
        el.style.setProperty('-webkit-backdrop-filter', 'none', 'important')
      } else {
        el.style.setProperty('box-shadow', 'none', 'important')
      }
    }
  })
  try {
    const box = await locator.boundingBox()
    if (!box) throw new Error('modal has no bounding box')
    const pad = 1
    await page.screenshot({
      path: join(SHOTS_DIR, name),
      clip: {
        x: box.x + pad,
        y: box.y + pad,
        width: Math.max(1, box.width - pad * 2),
        height: Math.max(1, box.height - pad * 2),
      },
      scale: 'device',
    })
  } finally {
    await page.evaluate(() => {
      document.getElementById('porcelain-shot-modal-mask')?.remove()
      for (const el of document.querySelectorAll<HTMLElement>(
        '[data-slot="dialog-overlay"], [data-slot="dialog-content"]',
      )) {
        if (el.dataset.porcelainShotOverlay !== '1') continue
        delete el.dataset.porcelainShotOverlay
        el.style.removeProperty('background')
        el.style.removeProperty('backdrop-filter')
        el.style.removeProperty('-webkit-backdrop-filter')
        el.style.removeProperty('box-shadow')
      }
    })
  }
}

type Rect = { x: number; y: number; width: number; height: number }

/** Retina screenshot of a CSS-px rectangle — for crops that must span more than one element. */
async function shootClip(page: Page, name: string, clip: Rect): Promise<void> {
  await page.screenshot({ path: join(SHOTS_DIR, name), clip, scale: 'device' })
}

async function boxOf(locator: Locator): Promise<Rect> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return box
}

/** The floating sidebar card (rail + panel for the left; the companion for the right). */
function sidebarCard(page: Page, side: 'left' | 'right'): Locator {
  return page.locator(
    `[data-slot="sidebar-container"][data-side="${side}"] [data-slot="sidebar-inner"]`,
  )
}

/**
 * A clip covering a sidebar card from its top down to the bottom of its content (the
 * grouped list / companion sections), so a portrait panel crop never trails off into
 * the empty space above the branch/worktree footer. `contentSelector` picks the element
 * whose bottom is the crop's floor (defaults to the panel's group content).
 */
async function panelClip(
  page: Page,
  side: 'left' | 'right',
  contentSelector = '[data-slot="sidebar-group-content"]',
  pad = 12,
): Promise<Rect> {
  const card = await boxOf(sidebarCard(page, side))
  const content = await boxOf(
    page
      .locator(`[data-slot="sidebar-container"][data-side="${side}"]`)
      .locator(contentSelector)
      .last(),
  )
  const height = Math.min(card.height, content.y + content.height - card.y + pad)
  return { x: card.x, y: card.y, width: card.width, height }
}

/**
 * A fresh Retina context on the seeded daemon: token + e2e flag planted before first
 * paint, optional persisted `preferences` (e.g. wider sidebars for the panel crops).
 * Returns the context (to close) and a ready page (shell restored).
 */
async function openShotPage(
  browser: Browser,
  port: number,
  prefs?: Record<string, unknown>,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  })
  await context.addInitScript((token) => {
    localStorage.setItem('porcelain-client-token', token)
    localStorage.setItem('porcelain-e2e', '1')
  }, DAEMON_TOKEN)
  if (prefs) {
    await context.addInitScript((p) => {
      localStorage.setItem('porcelain-preferences', JSON.stringify({ state: p, version: 0 }))
    }, prefs)
  }
  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:${port}/`)
  await waitForShell(page)
  return { context, page }
}

test('marketing shots — the seeded demo repo across every surface', async () => {
  test.setTimeout(180_000)
  await mkdir(SHOTS_DIR, { recursive: true })

  // The demo repo + its isolated config/channel dirs. Canonicalize the repo path so
  // the channels (keyed by absolute path) match whatever Porcelain resolves it to.
  // Fixed basename "northwind-orders" (not a mkdtemp prefix): the project switcher
  // and Glance show path.basename — never ship "porcelain-shots-repo-XXXX" in PNGs.
  const shotsRoot = await mkdtemp(join(tmpdir(), 'porcelain-shots-'))
  const repoRaw = join(shotsRoot, 'northwind-orders')
  await mkdir(repoRaw, { recursive: true })
  await createDemoRepo(repoRaw)
  const repoDir = await realpath(repoRaw)

  const udBase = await mkdtemp(join(tmpdir(), 'porcelain-shots-ud-'))
  const userData = `${udBase}-dev`
  await mkdir(userData, { recursive: true })
  // Seed a pinned folder + file (absolute, under the repo) so the Workspace panel has
  // real pinned content for pin-compact.png instead of its empty state.
  await writeFile(
    join(userData, 'config.json'),
    JSON.stringify({
      recentRepos: [repoDir],
      repos: {
        [repoDir]: {
          hiddenPaths: [],
          pinnedPaths: [
            `${repoDir}/src/hooks`,
            `${repoDir}/README.md`,
            `${repoDir}/src/pages/OrdersPage.tsx`,
            `${repoDir}/src/services/orders.service.ts`,
          ],
        },
      },
    }),
  )
  const channelEnv = await seedDemoChannels(udBase, repoDir)
  const accessFile = join(udBase, 'access.json')
  await writeFile(
    accessFile,
    JSON.stringify({
      version: 1,
      pairings: [],
      clients: [
        {
          id: 'marketing',
          label: 'Marketing browser',
          secretHash: createHash('sha256').update(DAEMON_SECRET).digest('hex'),
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    }),
    { mode: 0o600 },
  )

  const env: Record<string, string> = {
    ...channelEnv,
    PORCELAIN_USER_DATA: userData,
    PORCELAIN_ADMIN_TOKEN: ADMIN_TOKEN,
    PORCELAIN_ACCESS_FILE: accessFile,
    // Pin a fast, config-free shell so the terminal shot is deterministic.
    PORCELAIN_SHELL: '/bin/bash',
    // e2e mode installs the terminal-buffer read hook, so we can wait for output
    // before shooting.
    PORCELAIN_E2E: '1',
    // Generic host for the env chip — never ship a personal hostname in marketing.
    PORCELAIN_DAEMON_HOST: 'dev-box',
  }

  const browser = await chromium.launch()
  const { child, port } = await spawnDaemon(env)
  try {
    // ── Phase 1 — the default layout: full-window surfaces + centered overlays. ──
    const { context, page } = await openShotPage(browser, port)

    // glance.png — empty viewer = the Glance (work in flight + jump rows). Landing
    // home for a repo with no tab open; the marketing hero app shot.
    await expect(byId(page, TestIds.glance)).toBeVisible({ timeout: 20_000 })
    await settle(page)
    await shoot(page, 'glance.png')

    // review.png — the Review tab with the Review document opened into the viewer
    // (thesis, walkthrough sections, flow diagram, anchored diff hunks). The outline
    // lives in the sidebar; clicking the review name opens the document at the top.
    await selectTab(page, 'Review')
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
    await expect(page.getByTestId('changes-summary')).toBeVisible({ timeout: 15_000 })
    await settle(page)
    await shoot(page, 'changes-flow.png')

    // board.png — the wide kanban in the viewer.
    await selectTab(page, 'Board')
    await page.getByRole('button', { name: 'Open board' }).click()
    // Test ids scoped to the viewer, not getByText on <main>: the Focus companion
    // repeats the selected card's title, and the Board panel repeats every card.
    const board = page.getByRole('main')
    await expect(byId(board, TestIds.boardCard('Filter orders by status'))).toBeVisible({
      timeout: 15_000,
    })
    await expect(byId(board, TestIds.boardCard('Export the current view as CSV'))).toBeVisible()
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
    const input = page.locator('.porcelain-ghostty-input').first()
    await input.waitFor()
    await input.focus()
    await expectTerminalText(page, 0, '$')
    // Generic prompt: bash's default is user@hostname:cwd$, which would leak the
    // maintainer's account and host (and a /tmp shots path) into the published PNG.
    await page.keyboard.type("export PS1='$ '")
    await page.keyboard.press('Enter')
    await expectTerminalText(page, 0, '$')
    await page.keyboard.type('clear')
    await page.keyboard.press('Enter')
    // TRAP: a canvas renderer can paint blank in a headless screenshot for normal
    // scrollback output — the Ghostty buffer still holds the text
    // (expectTerminalText still passes) but nothing is captured. A full-screen pager
    // (`less` on the alternate screen) DOES paint, so drive `git log -p` through it:
    // a colored commit + diff that fills the terminal, with the marker on screen one.
    await page.keyboard.type('git -c color.ui=always log -p')
    await page.keyboard.press('Enter')
    await expectTerminalText(page, 0, 'relabel the pagination')
    // App default is 12px; at Retina full-window publish that reads as huge. Shrink
    // after the pager is up so less reflows denser (e2e-only; not product default).
    const fontApplied = await page.evaluate(() => {
      const fn = window.__porcelainSetTerminalFontSize
      if (typeof fn !== 'function') return false
      fn(8)
      return true
    })
    expect(fontApplied).toBe(true)
    await settle(page)
    await settle(page)
    await shoot(page, 'terminal.png')

    // feat-search.png — the finder overlay with a query showing mixed results
    // (files + a saved command). Raise it from the navigation search (not ⌘K over the
    // terminal, where it's clear-screen), type a query, shoot just the dialog.
    await selectTab(page, 'Files')
    await page
      .getByRole('button', { name: 'Search commands, projects, files, and commits' })
      .first()
      .click()
    const finder = page.getByRole('dialog')
    await finder.getByPlaceholder('Search commands, projects, files, and commits…').fill('orders')
    await expect(finder.getByText('OrdersPage.tsx').first()).toBeVisible({ timeout: 10_000 })
    await expect(finder.getByText('Run orders tests')).toBeVisible()
    await settle(page)
    await shootModal(page, finder, 'feat-search.png')
    await page.keyboard.press('Escape')

    // feat-comment.png — the Add comment dialog over a diff, anchored to a line range.
    // Open a changed file's diff, select a few lines, right-click → Add comment.
    await selectTab(page, 'Changes')
    await expect(page.getByTestId('changes-summary')).toBeVisible({ timeout: 15_000 })
    await sidebarCard(page, 'left').getByText('orders.service.ts', { exact: true }).click()
    const lines = page.locator('[data-line]')
    await expect(lines.nth(8)).toBeVisible({ timeout: 15_000 })
    // Programmatic multi-line selection over the diff rows (robust vs. a pixel drag),
    // then a real right-click INSIDE it so the context menu reads the line range.
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-line]'))
      const a = rows[4]
      const b = rows[8]
      if (!a || !b) return
      const range = document.createRange()
      range.setStart(a, 0)
      range.setEnd(b, b.childNodes.length)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
    const anchorRow = await boxOf(lines.nth(6))
    await page.mouse.click(anchorRow.x + 60, anchorRow.y + anchorRow.height / 2, {
      button: 'right',
    })
    await page.getByRole('menuitem', { name: 'Add comment' }).click()
    const commentDialog = page.getByRole('dialog')
    await expect(commentDialog.getByText('Add comment')).toBeVisible({ timeout: 10_000 })
    await settle(page)
    await shootModal(page, commentDialog, 'feat-comment.png')
    await page.keyboard.press('Escape')

    await context.close()

    // ── Phase 2 — widened sidebars: the panel / companion close-up crops. ──
    const { context: wideContext, page: wide } = await openShotPage(browser, port, {
      sidebarWidth: 470,
      rightSidebarWidth: 390,
    })

    // grouped-panel.png — the Source-control sidebar: the flow-layer-grouped file list.
    await selectTab(wide, 'Changes')
    await expect(wide.getByTestId('changes-summary')).toBeVisible({ timeout: 15_000 })
    await settle(wide)
    await shootClip(wide, 'grouped-panel.png', await panelClip(wide, 'left'))

    // feat-commit.png — the right Commit companion: Suggested + Commands + composer + Comments.
    await expect(wide.getByText('Commit', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    await settle(wide)
    // Floor the crop at the Comments group (the last section) so it doesn't trail off
    // into empty space below.
    await shootClip(wide, 'feat-commit.png', await panelClip(wide, 'right'))

    // feat-history.png — the History sidebar list with the demo repo's commits.
    await selectTab(wide, 'History')
    await expect(wide.getByText('relabel the pagination control')).toBeVisible({ timeout: 15_000 })
    await settle(wide)
    await shootClip(wide, 'feat-history.png', await panelClip(wide, 'left'))

    // pin-compact.png — the Workspace companion with pinned content (a folder + a file).
    await selectTab(wide, 'Files')
    await expect(wide.getByText('Pinned', { exact: true })).toBeVisible({ timeout: 15_000 })
    // Expand the pinned folder so the crop shows a nested tree (taller, more portrait).
    await sidebarCard(wide, 'right').getByText('hooks').click()
    await expect(sidebarCard(wide, 'right').getByText('useOrders.ts')).toBeVisible({
      timeout: 10_000,
    })
    await settle(wide)
    await shootClip(
      wide,
      'pin-compact.png',
      await panelClip(wide, 'right', '[data-slot="sidebar-group"]'),
    )

    // hide-panel.png — the Explorer folder context menu (Pin / Hide, DOM menu, not native).
    const folder = wide.getByRole('button', { name: 'src', exact: true })
    await folder.click({ button: 'right' })
    const menu = wide.getByRole('menu')
    await expect(menu.getByText('Hide', { exact: true })).toBeVisible({ timeout: 10_000 })
    const leftCard = await boxOf(sidebarCard(wide, 'left'))
    const menuBox = await boxOf(menu)
    await shootClip(wide, 'hide-panel.png', {
      x: leftCard.x,
      y: leftCard.y,
      width: menuBox.x + menuBox.width - leftCard.x + 12,
      height: Math.min(leftCard.height, menuBox.y + menuBox.height - leftCard.y + 16),
    })

    await wideContext.close()
  } finally {
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
    child.kill('SIGTERM')
    await exited
    await browser.close()
    await rm(shotsRoot, { recursive: true, force: true })
    await rm(udBase, { recursive: true, force: true })
    await rm(userData, { recursive: true, force: true })
  }
})
