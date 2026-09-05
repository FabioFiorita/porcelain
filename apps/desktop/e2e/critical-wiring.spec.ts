import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import {
  expect,
  expectTerminalText,
  loc,
  openTerminals,
  selectTab,
  test,
  waitForShell,
} from './helpers/app'

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
  await expect(loc.hubInventory(page)).toBeVisible()
  await expect(loc.hubProjects(page)).toHaveCount(1)
  await expect(loc.hubWorktrees(page)).not.toHaveCount(0)
  await expect(page.getByLabel(/delete worktree/i)).toHaveCount(0)
  await expect(loc.viewerEmpty(page)).toBeVisible()
  await selectTab(page, 'Changes')
  await expect(loc.changesSummary(page)).toHaveAttribute('data-count', '2')
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
  // The shell chrome is ready before the lazy Files root fetch. Wait for the fixture's root
  // entry before driving its descendants, so this test proves live refresh rather than a fetch race.
  await expect(loc.treeEntry(page, 'src')).toBeVisible()
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
  await openTerminals(page)
  await loc.terminalTabByName(page, 'Terminal 1').waitFor({ timeout: 15_000 })

  const input = page.locator('.porcelain-ghostty-input').first()
  await input.waitFor()
  await expect
    .poll(() => page.evaluate(() => window.__porcelainTerminalText?.(0)?.trim() ?? ''))
    .not.toBe('')
  await input.focus()
  await page.keyboard.insertText(
    "node -e \"console.log('x'.repeat(70000) + 'SCROLLBACK_' + 'TAIL_64K')\"",
  )
  await expectTerminalText(page, 0, 'TAIL_64K')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 0, 'SCROLLBACK_TAIL_64K')

  // Reload closes the browser session (daemon detach) while the daemon-owned PTY remains alive.
  // The fresh roster hydration then fills the panel with the existing row and attaches a new
  // Ghostty stream. The panel starts closed after a reload — it is presentation state, not a
  // persisted layout — so reopen it before looking for the tab.
  await page.reload()
  await waitForShell(page)
  await expect(page.locator('[data-testid^="hub-worktree-"][aria-current="page"]')).toHaveCount(1)
  await openTerminals(page)
  const existing = loc.terminalTabByName(page, 'Terminal 1')
  await existing.waitFor({ timeout: 15_000 })
  await existing.click()
  await expectTerminalText(page, 0, 'SCROLLBACK_TAIL_64K', 45_000)
})
