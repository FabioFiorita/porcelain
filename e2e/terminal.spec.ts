import { expect, expectTerminalText, selectTab, test, waitForShell } from './helpers/electron'

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
  // Type only after the prompt renders: readline's terminal prep flushes queued
  // typeahead, so keystrokes sent while bash is still printing its banner/profile
  // output are echoed but DISCARDED (the pinned /bin/bash prompt ends in "$").
  const input = page.locator('.xterm-helper-textarea').first()
  await input.waitFor()
  await input.focus()
  await expectTerminalText(page, 0, '$')
  await page.keyboard.type('echo READY_$((6*7))')
  await page.keyboard.press('Enter')

  await expectTerminalText(page, 0, 'READY_42')

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

  // First terminal: run a marker, then confirm it rendered while mounted. Wait for the
  // prompt before typing (readline discards pre-prompt typeahead — see the first spec).
  await page.getByRole('button', { name: 'New terminal' }).click()
  await page.locator('.xterm-helper-textarea').first().focus()
  await expectTerminalText(page, 0, '$')
  await page.keyboard.type('echo SPLIT_ONE')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 0, 'SPLIT_ONE')

  // Second terminal (the first unmounts; its scrollback must survive in the registry).
  // Its tab only opens once the daemon create round-trip resolves, so on a slow machine
  // the textarea in the DOM is still terminal 1's — typing immediately would start in
  // terminal 1 and get SPLIT when the new xterm mounts and steals focus (this failed the
  // v0.19.0 release gate: terminal 2 received only the tail, `bash: TWO: command not
  // found`). Waiting for terminal 2's prompt guarantees it is mounted, focused, and past
  // readline init before any keystroke.
  await page.getByRole('button', { name: 'New terminal' }).click()
  await expectTerminalText(page, 1, '$')
  await page.locator('.xterm-helper-textarea').first().focus()
  await page.keyboard.type('echo SPLIT_TWO')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 1, 'SPLIT_TWO')

  // Open Terminal 2 to the side — it MOVES to the second pane; Terminal 1 reattaches in
  // the first. Both terminals must mount at once (the bug: one pane blanked out) — two
  // xterm roots in the DOM — and each keeps its own scrollback.
  await page.getByRole('tab', { name: 'Terminal 2' }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Open to the Side' }).click()

  await expect(page.locator('.xterm')).toHaveCount(2)
  await expectTerminalText(page, 0, 'SPLIT_ONE')
  await expectTerminalText(page, 1, 'SPLIT_TWO')
})

test('macOS line-editing chords reach the shell (⌘⌫ kill-line, ⌘← line-start)', async ({
  page,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await page.getByRole('button', { name: 'New terminal' }).click()
  const input = page.locator('.xterm-helper-textarea').first()
  await input.waitFor()
  await input.focus()
  // Prompt first — pre-prompt keystrokes are flushed by readline init (see first spec).
  await expectTerminalText(page, 0, '$')

  // ⌘⌫ → Ctrl-U: the half-typed line is discarded, so only the real command runs. If it
  // weren't, the prefix would glue to it and bash would error instead of printing.
  await page.keyboard.type('junk that must be discarded && ')
  await page.keyboard.press('Meta+Backspace')
  await page.keyboard.type('echo KILL_$((6*7))')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 0, 'KILL_42')

  // ⌘← → Ctrl-A: cursor jumps to line start, so the prefix lands before "world".
  await page.keyboard.type('world')
  await page.keyboard.press('Meta+ArrowLeft')
  await page.keyboard.type('echo START_$((6*7))_')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 0, 'START_42_world')
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
  await expectTerminalText(page, 0, 'ACTION_42')
})
