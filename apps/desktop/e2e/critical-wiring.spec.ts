import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import { expect, expectTerminalText, loc, selectTab, test, waitForShell } from './helpers/app'

const CLI = join(__dirname, '..', 'out', 'main', 'cli', 'porcelain.js')

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
// Two black 16×16 H.264 frames in an MP4 container, generated once for the
// fixture so the browser has real media bytes rather than only a video-shaped
// data URL.
const VIDEO_BYTES = Buffer.from(
  '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',
  'base64',
)

async function seedFixtureEvidence(repoDir: string): Promise<void> {
  const evidence = join(repoDir, '.porcelain', 'active-review', 'evidence')
  await mkdir(join(evidence, 'assets'), { recursive: true })
  await writeFile(join(evidence, 'assets', 'shot.png'), PNG_1PX)
  await writeFile(join(evidence, 'assets', 'capture.mp4'), VIDEO_BYTES)
  await writeFile(join(evidence, 'assets', 'reference.url'), 'https://example.com/evidence\n')
  await writeFile(
    join(evidence, 'meta.json'),
    JSON.stringify({
      title: 'CLI watcher evidence',
      repoPath: repoDir,
      updatedAt: '2026-08-15T00:00:00.000Z',
      checks: [{ label: 'browser proof', status: 'pass' }],
    }),
  )
}

interface SessionMismatch {
  t: 'session:mismatch'
  code: 'protocol.update-required'
  expected: number
  received: number | null
}

/** Run the built CLI against the per-test fixture, never the developer's companion. */
async function runFixtureCli(
  args: string[],
  env: Record<string, string>,
  cwd: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    let error = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      error += chunk.toString()
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`porcelain ${args.join(' ')} failed (${code}): ${error || output}`))
    })
  })
}

async function readProtocolMismatch(
  page: Parameters<typeof waitForShell>[0],
): Promise<SessionMismatch> {
  return page.evaluate(
    ({ nextVersion }) =>
      new Promise<SessionMismatch>((resolve, reject) => {
        const token = localStorage.getItem('porcelain-client-token')
        if (token === null || token === '') {
          reject(new Error('browser client token was not seeded'))
          return
        }

        const socket = new WebSocket(
          `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/session`,
          `porcelain.${token}`,
        )
        let settled = false
        const timer = window.setTimeout(() => {
          if (settled) return
          settled = true
          socket.close()
          reject(new Error('protocol mismatch frame did not arrive'))
        }, 10_000)
        const finish = (result: SessionMismatch): void => {
          if (settled) return
          settled = true
          window.clearTimeout(timer)
          socket.close()
          resolve(result)
        }

        socket.onopen = (): void => {
          socket.send(JSON.stringify({ t: 'session:hello', protocolVersion: nextVersion }))
        }
        socket.onmessage = (event: MessageEvent): void => {
          if (typeof event.data !== 'string') return
          const frame = JSON.parse(event.data) as Partial<SessionMismatch>
          if (frame.t !== 'session:mismatch') return
          finish(frame as SessionMismatch)
        }
        socket.onerror = (): void => {
          if (settled) return
          settled = true
          window.clearTimeout(timer)
          reject(new Error('protocol mismatch socket failed'))
        }
      }),
    { nextVersion: PROTOCOL_VERSION + 1 },
  )
}

test('authenticated startup restores the seeded repo and dirty count', async ({ page }) => {
  await waitForShell(page)
  await expect(loc.glanceChangedFiles(page)).toHaveAttribute('data-count', '2')
  await expect(loc.hubInventory(page)).toBeVisible()
  await expect(loc.hubProjects(page)).toHaveCount(1)
  await expect(loc.hubWorktrees(page)).not.toHaveCount(0)
  await expect(page.getByLabel(/delete worktree/i)).toHaveCount(0)
  await expect(loc.hubWorktreeSummary(page)).toBeVisible()
})

test('a stale session protocol receives the exact update-required mismatch', async ({ page }) => {
  await waitForShell(page)
  const mismatch = await readProtocolMismatch(page)
  expect(mismatch).toEqual({
    t: 'session:mismatch',
    code: 'protocol.update-required',
    expected: PROTOCOL_VERSION,
    received: PROTOCOL_VERSION + 1,
  })
})

test('an external fixture edit refreshes the open file', async ({ page, repoDir }) => {
  await waitForShell(page)
  await selectTab(page, 'Files')
  await loc.treeEntry(page, 'src').click()
  await loc.treeEntry(page, 'components').click()
  await loc.treeEntry(page, 'Button.tsx').click()

  const editor = loc.fileEditor(page)
  await expect(editor).toHaveValue(/props\.label/, { timeout: 15_000 })
  await page.waitForTimeout(1_000)
  await writeFile(
    join(repoDir, 'src/components/Button.tsx'),
    '// SENTINEL_REFRESHED_ON_DISK\nexport const Button = () => null\n',
  )
  await expect(editor).toHaveValue(/SENTINEL_REFRESHED_ON_DISK/, { timeout: 15_000 })
})

test('a CLI review publish appears in the already-running Review canvas', async ({
  page,
  repoDir,
  seeded,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Review')
  await runFixtureCli(
    [
      'review',
      'set',
      '--repo',
      repoDir,
      '--name',
      'CLI watcher unit',
      '--thesis',
      'The browser observes a review written by the built CLI.',
      '--files',
      '[]',
      '--sections',
      JSON.stringify([
        {
          title: 'Scope',
          prose: 'The companion watcher delivered this publish to the live canvas.',
          anchors: [],
        },
      ]),
    ],
    seeded.env,
    repoDir,
  )

  await seedFixtureEvidence(repoDir)

  await expect(loc.reviewOpen(page)).toBeVisible({ timeout: 15_000 })
  await loc.reviewOpen(page).click()
  await expect(loc.activeReview(page)).toContainText('CLI watcher unit', { timeout: 15_000 })
  for (const tab of ['intent', 'process', 'execution', 'evidence'] as const) {
    await expect(loc.activeReviewTab(page, tab)).toBeVisible()
  }
  await expect(loc.activeReviewTab(page, 'evidence')).not.toHaveAttribute('aria-disabled', 'true')
  await loc.activeReviewTab(page, 'process').click()
  await expect(loc.activeReview(page)).toContainText('Scope')
  await loc.activeReviewTab(page, 'evidence').click()
  await expect(loc.evidencePanel(page)).toBeVisible()
  await loc.evidenceSubTab(page, 'assets').click()
  await expect(loc.evidenceGallery(page)).toBeVisible()
  await expect(loc.evidenceGalleryItem(page, 'shot.png')).toBeVisible()
  await expect(loc.evidenceGalleryItem(page, 'capture.mp4')).toBeVisible()
  await expect(loc.evidenceGalleryItem(page, 'reference.url')).toHaveAttribute(
    'href',
    'https://example.com/evidence',
  )
  await expect(page.locator('video')).toHaveAttribute('src', /^data:video\/mp4;base64,/)
})

test('a PTY survives browser detach, reconnects, and replays its bounded tail', async ({
  page,
}) => {
  await waitForShell(page)
  await loc.glanceJumpTerminal(page).click()
  await loc.terminalNew(page).waitFor()

  const input = page.locator('.porcelain-ghostty-input').first()
  await input.waitFor()
  await input.focus()
  await expectTerminalText(page, 0, '$')
  await page.keyboard.type("python3 -c \"print('x' * 70000 + 'SCROLLBACK_TAIL_64K')\"")
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 0, 'SCROLLBACK_TAIL_64K')

  // Reload closes the browser session (daemon detach) while the daemon-owned PTY remains alive.
  // The fresh roster hydration then opens the existing row and attaches a new Ghostty stream.
  await page.reload()
  await waitForShell(page)
  const existing = loc.terminalSession(page, 'Terminal 1')
  // The panel is persistent but hidden after reload; this structural locator can observe its
  // hydrated row without requiring the panel to be visible or triggering a new PTY.
  await existing.waitFor({ state: 'attached', timeout: 15_000 })
  await loc.glanceJumpTerminal(page).click()
  await existing.waitFor({ timeout: 15_000 })
  await existing.click()
  await expectTerminalText(page, 0, 'SCROLLBACK_TAIL_64K', 45_000)
})
