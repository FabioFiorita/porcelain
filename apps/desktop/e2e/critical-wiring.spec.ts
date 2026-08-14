import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import { expect, expectTerminalText, loc, selectTab, test, waitForShell } from './helpers/app'

const CLI = join(__dirname, '..', 'out', 'main', 'cli', 'porcelain.js')

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

  await expect(loc.reviewOpen(page)).toBeVisible({ timeout: 15_000 })
  await loc.reviewOpen(page).click()
  await expect(loc.activeReview(page)).toContainText('CLI watcher unit', { timeout: 15_000 })
  await expect(loc.activeReview(page)).toContainText('Scope')
})

test('a PTY survives browser detach, reconnects, and replays its bounded tail', async ({
  page,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await loc.terminalNew(page).click()

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
  await selectTab(page, 'Terminal')
  const existing = page.getByRole('button', { name: 'Terminal 1', exact: true })
  await existing.waitFor({ timeout: 15_000 })
  await existing.click()
  await expectTerminalText(page, 0, 'SCROLLBACK_TAIL_64K', 45_000)
})
