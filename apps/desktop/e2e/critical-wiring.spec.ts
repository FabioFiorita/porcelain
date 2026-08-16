import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import { expect, expectTerminalText, loc, selectTab, test, waitForShell } from './helpers/app'

interface SessionMismatch {
  t: 'session:mismatch'
  code: 'protocol.update-required'
  expected: number
  received: number | null
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
