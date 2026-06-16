import { expect, selectTab, test, waitForShell } from './helpers/electron'

// These exercise the real PTY round-trip end to end: node-pty spawns a shell in the
// main process, bytes stream over the dedicated terminal bridge, and xterm.js renders
// them. The marker is computed by the shell (`$((6*7))` → 42), so it can only appear if
// the command actually EXECUTED — proving keyboard → bridge → PTY → data → xterm, not
// just local echo. PORCELAIN_SHELL pins /bin/bash for determinism (see the fixture).

test('opens a terminal and runs a typed command', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await page.getByRole('button', { name: 'New terminal' }).click()

  // The xterm instance mounts into the viewer; its hidden input takes keystrokes.
  const input = page.locator('.xterm-helper-textarea').first()
  await input.waitFor()
  await input.focus()
  await page.keyboard.type('echo READY_$((6*7))')
  await page.keyboard.press('Enter')

  await expect(page.locator('.xterm-rows').first()).toContainText('READY_42', { timeout: 15_000 })

  // The Nerd Font fallback must be registered AND its bundled file must actually load,
  // or prompt glyphs render as tofu. `fonts.load` fetches it and returns the matched
  // face only when both hold.
  const nerdFontLoaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('12px "Symbols Nerd Font Mono"')
    return faces.length > 0
  })
  expect(nerdFontLoaded).toBe(true)
})

test('splits two terminals side by side, both rendering', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')

  // First terminal: run a marker, then confirm it rendered while mounted.
  await page.getByRole('button', { name: 'New terminal' }).click()
  await page.locator('.xterm-helper-textarea').first().focus()
  await page.keyboard.type('echo SPLIT_ONE')
  await page.keyboard.press('Enter')
  await expect(page.locator('.xterm-rows').first()).toContainText('SPLIT_ONE', { timeout: 15_000 })

  // Second terminal (the first unmounts; its scrollback must survive in the registry).
  await page.getByRole('button', { name: 'New terminal' }).click()
  await page.locator('.xterm-helper-textarea').first().focus()
  await page.keyboard.type('echo SPLIT_TWO')
  await page.keyboard.press('Enter')
  await expect(page.locator('.xterm-rows').first()).toContainText('SPLIT_TWO', { timeout: 15_000 })

  // Open Terminal 2 to the side — it MOVES to the second pane; Terminal 1 reattaches in
  // the first. Both terminals must render at once (the bug: one pane blanked out).
  await page.getByRole('tab', { name: 'Terminal 2' }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Open to the Side' }).click()

  const screens = page.locator('.xterm-rows')
  await expect(screens).toHaveCount(2)
  await expect(screens.first()).toContainText('SPLIT_ONE', { timeout: 15_000 })
  await expect(screens.last()).toContainText('SPLIT_TWO', { timeout: 15_000 })
})

test('runs a saved action in a terminal', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')

  // Create an action through the composer (the Actions Quick Access section).
  await page.getByRole('button', { name: 'Add action' }).first().click()
  await page.getByLabel('Action title').fill('Compute')
  await page.getByLabel('Action command').fill('echo ACTION_$((6*7))')
  await page.getByRole('button', { name: 'Add action' }).click()

  // The saved action appears; running it opens a terminal that executes the command.
  await page.getByText('Compute', { exact: true }).click()
  await expect(page.locator('.xterm-rows').first()).toContainText('ACTION_42', { timeout: 15_000 })
})
