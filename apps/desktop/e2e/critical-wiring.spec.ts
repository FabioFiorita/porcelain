import { stat, writeFile } from 'node:fs/promises'
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

test('Files drags a file into a folder and back to root', async ({ page, repoDir }) => {
  await waitForShell(page)
  await selectTab(page, 'Files')
  await loc.treeEntry(page, 'README.md').dragTo(loc.treeEntry(page, 'src'))
  await expect
    .poll(async () => (await stat(join(repoDir, 'src/README.md')).catch(() => null))?.isFile())
    .toBe(true)
  await expect(loc.treeEntry(page, 'README.md')).toBeVisible()
  const source = await loc.treeEntry(page, 'README.md').boundingBox()
  if (!source) throw new Error('Source row is not visible')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + source.width / 2 - 15, source.y + source.height / 2, {
    steps: 4,
  })
  const root = page.getByTestId('files-drop-root')
  await expect(root).toBeVisible()
  const destination = await root.boundingBox()
  if (!destination) throw new Error('Root drop target is not visible')
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
    { steps: 5 },
  )
  await page.mouse.up()
  await expect
    .poll(async () => (await stat(join(repoDir, 'README.md')).catch(() => null))?.isFile())
    .toBe(true)
  await expect
    .poll(async () => (await stat(join(repoDir, 'src/README.md')).catch(() => null)) === null)
    .toBe(true)
  await expect(root).toBeHidden()
})

test('Files cuts and pastes a folder at root and keeps its open file', async ({
  page,
  repoDir,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Files')
  await loc.treeEntry(page, 'src').click()
  await loc.treeEntry(page, 'components').click()
  await loc.treeEntry(page, 'Button.tsx').click()
  await expect(loc.fileEditor(page)).toHaveValue(/props.label/)
  await loc.treeEntry(page, 'components').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Cut', exact: true }).click()
  await page.getByTestId('files-paste-root').click()
  await expect
    .poll(async () =>
      (await stat(join(repoDir, 'components/Button.tsx')).catch(() => null))?.isFile(),
    )
    .toBe(true)
  await expect
    .poll(async () => (await stat(join(repoDir, 'src/components')).catch(() => null)) === null)
    .toBe(true)
  await expect(loc.fileEditor(page)).toHaveValue(/props.label/)
  await expect(page.getByTestId('files-paste-root')).toBeHidden()
})

test('Files shortcuts can be recorded and do not run inside the name input', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Files')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click()
  await page.getByTestId('shortcut-files.create-file').click()
  await page.keyboard.press('Control+Shift+Y')
  await expect(page.getByTestId('shortcut-files.create-file')).toContainText('Y')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('shortcut-files.create-file')).toBeHidden()
  await loc.treeEntry(page, 'src').focus()
  await page.keyboard.press('Control+Shift+Y')
  const name = page.getByRole('textbox', { name: 'Name', exact: true })
  await expect(name).toBeVisible()
  await name.fill('keep-this-name.txt')
  await page.keyboard.press('Control+Shift+Y')
  await expect(name).toHaveValue('keep-this-name.txt')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
})

test('Files supports keyboard navigation, opening, and rename', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Files')
  const src = loc.treeEntry(page, 'src')
  await src.focus()
  await page.keyboard.press('ArrowRight')
  const components = loc.treeEntry(page, 'components')
  await expect(components).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(components).toBeFocused()
  await page.keyboard.press('ArrowRight')
  const file = loc.treeEntry(page, 'Button.tsx')
  await expect(file).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await expect(file).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(loc.fileEditor(page)).toBeVisible()
  await file.focus()
  await page.keyboard.press('F2')
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Button.tsx')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await file.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(components).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(file).toBeHidden()
  await page.keyboard.press('ArrowLeft')
  await expect(src).toBeFocused()
  await page.keyboard.press('End')
  await expect(loc.treeEntry(page, 'README.md')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(loc.treeEntry(page, '.git')).toBeFocused()
})

test('Files reveals the active file after collapsing its ancestors', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Files')
  const reveal = page.getByTestId('files-reveal-active')
  await expect(reveal).toBeDisabled()
  await loc.treeEntry(page, 'src').click()
  await loc.treeEntry(page, 'components').click()
  await loc.treeEntry(page, 'Button.tsx').click()
  await expect(loc.fileEditor(page)).toBeVisible()
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: 'Collapse all folders', exact: true }).click()
    await expect(loc.treeEntry(page, 'Button.tsx')).toBeHidden()
    await reveal.click()
    await expect(loc.treeEntry(page, 'Button.tsx')).toBeVisible()
    await expect(loc.treeEntry(page, 'Button.tsx')).toHaveAttribute('data-active')
  }
})

test('Files creates a file and folder at the root without selecting an entry', async ({
  page,
  repoDir,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Files')
  for (const [kind, name] of [
    ['file', 'root-created.txt'],
    ['folder', 'root-created-folder'],
  ] as const) {
    await page.getByTestId('files-create-menu').click()
    await page.getByTestId(`files-new-root-${kind}`).click()
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect
      .poll(async () => {
        const entry = await stat(join(repoDir, name)).catch(() => null)
        return kind === 'folder' ? entry?.isDirectory() : entry?.isFile()
      })
      .toBe(true)
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeHidden()
  }
})

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
    "node -e \"console.log('x'.repeat(70000)); console.log('SCROLLBACK_' + 'TAIL_64K')\"",
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
