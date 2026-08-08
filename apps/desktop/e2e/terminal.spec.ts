import { expect, expectTerminalText, loc, selectTab, test, waitForShell } from './helpers/app'

// Real PTY round-trip: node-pty + bash (PORCELAIN_SHELL). Locators for chrome use
// data-testid; the canvas terminal uses the buffer hook (no scrapeable DOM).

test('opens a terminal and runs a typed command', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await loc.terminalNew(page).click()

  const input = page.locator('.porcelain-ghostty-input').first()
  await input.waitFor()
  await input.focus()
  await expectTerminalText(page, 0, '$')
  await page.keyboard.type('echo READY_$((6*7))')
  await page.keyboard.press('Enter')

  await expectTerminalText(page, 0, 'READY_42')

  const nerdFontLoaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('12px "Symbols Nerd Font Mono"')
    return faces.length > 0
  })
  expect(nerdFontLoaded).toBe(true)
})

test('browser paste writes text through the terminal, not a remote Linux clipboard', async ({
  page,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await loc.terminalNew(page).click()

  const input = page.locator('.porcelain-ghostty-input').first()
  await input.waitFor()
  await input.focus()
  await expectTerminalText(page, 0, '$')

  // Browser paste events carry the actual clipboard payload even on an insecure remote
  // daemon origin. It must reach Ghostty's paste encoder and the PTY directly, never
  // fall through to a command that tries to query the daemon host's X11 clipboard.
  await input.evaluate((target) => {
    const clipboard = new DataTransfer()
    clipboard.setData('text/plain', 'echo PASTED_$((6*7))')
    target.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: clipboard }),
    )
  })
  await page.keyboard.press('Enter')

  await expectTerminalText(page, 0, 'PASTED_42')
})

test('context menu exposes terminal actions and clears only the local viewport', async ({
  page,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await loc.terminalNew(page).click()
  const input = page.locator('.porcelain-ghostty-input').first()
  await input.waitFor()
  await input.focus()
  await expectTerminalText(page, 0, '$')

  await page.keyboard.type('echo CONTEXT_$((6*7))')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 0, 'CONTEXT_42')
  await page.locator('.porcelain-ghostty-canvas').first().click({ button: 'right' })
  await expect(loc.terminalContextMenu(page)).toBeVisible()
  await expect(loc.terminalContextPaste(page)).toBeVisible()
  await loc.terminalContextClear(page).click()
  await expect.poll(() => page.evaluate(() => window.__porcelainTerminalText?.(0) ?? '')).toBe('')
})

test('browser image paste uploads an attachment and inserts the daemon path', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await loc.terminalNew(page).click()
  const input = page.locator('.porcelain-ghostty-input').first()
  await input.waitFor()
  await input.focus()
  await expectTerminalText(page, 0, '$')

  await input.evaluate((target) => {
    const clipboard = new DataTransfer()
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      ),
      (byte) => byte.charCodeAt(0),
    )
    clipboard.items.add(new File([png], 'screen.png', { type: 'image/png' }))
    target.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: clipboard }),
    )
  })

  await expectTerminalText(page, 0, 'Analyze this image:')
  await expectTerminalText(page, 0, 'image.png')
})

test('macOS native clipboard, selection copy, and dropped files reach the daemon PTY', async ({
  app,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'electron', 'Electron-only native clipboard proof')
  if (app === null) throw new Error('Electron project launched without an Electron app')

  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await loc.terminalNew(page).click()
  const input = page.locator('.porcelain-ghostty-input').first()
  await input.waitFor()
  await input.focus()
  await expectTerminalText(page, 0, '$')

  // Main-process pasteboard text must be written to the daemon-owned PTY, never delegated to
  // the remote shell's unavailable X11/Wayland clipboard.
  await app.evaluate(({ clipboard }) => {
    clipboard.writeText('echo NATIVE_CLIPBOARD_$((6*7))')
  })
  await page.keyboard.press('Meta+V')
  // Shell clipboard reads cross Electron IPC, so do not race Return against the asynchronous
  // paste completion. The visible echo is the same point at which a person can safely submit.
  await expectTerminalText(page, 0, 'echo NATIVE_CLIPBOARD_$((6*7))')
  await input.focus()
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 0, 'NATIVE_CLIPBOARD_42')

  await app.evaluate(({ clipboard, nativeImage }) => {
    clipboard.writeImage(
      nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      ),
    )
  })
  await page.keyboard.press('Meta+Shift+V')
  await expectTerminalText(page, 0, 'Analyze this image:')
  await expectTerminalText(page, 0, 'image.png')

  // Drop is the generic file path Playwright can automate without driving a macOS file panel.
  // The File contains only renderer bytes; the daemon mints its own private attachment path.
  await page.getByRole('application', { name: 'Terminal' }).evaluate((target) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(['terminal attachment'], 'notes.txt', { type: 'text/plain' }))
    target.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }),
    )
  })
  // The long daemon path can wrap inside Ghostty's fixed grid, so the stable transfer proof is
  // the sanitized filename rather than an unwrapped natural-language prefix.
  await expectTerminalText(page, 0, 'notes.txt')

  // Selection copy writes the native pasteboard through the shell router. Select All avoids
  // geometry-sensitive canvas dragging while still operating on Ghostty's real selection state.
  const canvas = page.locator('.porcelain-ghostty-canvas').first()
  await canvas.click({ button: 'right' })
  await loc.terminalContextSelectAll(page).click()
  await canvas.click({ button: 'right' })
  await expect(loc.terminalContextCopy(page)).toBeEnabled()
  await loc.terminalContextCopy(page).click()
  const copied = await app.evaluate(({ clipboard }) => clipboard.readText())
  expect(copied).toContain('NATIVE_CLIPBOARD_42')
  expect(copied).toContain('notes.txt')
  await page.screenshot({ path: testInfo.outputPath('native-terminal-clipboard.png') })
})

test('splits two terminals side by side, both rendering', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')

  await loc.terminalNew(page).click()
  await page.locator('.porcelain-ghostty-input').first().focus()
  await expectTerminalText(page, 0, '$')
  await page.keyboard.type('echo SPLIT_ONE')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 0, 'SPLIT_ONE')

  await loc.terminalNew(page).click()
  await expectTerminalText(page, 1, '$')
  await page.locator('.porcelain-ghostty-input').first().focus()
  await page.keyboard.type('echo SPLIT_TWO')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 1, 'SPLIT_TWO')

  await loc.viewerTab(page, 'Terminal 2').click({ button: 'right' })
  await loc.viewerTabOpenToSide(page).click()

  await expect(page.locator('.porcelain-ghostty-terminal')).toHaveCount(2)
  await expectTerminalText(page, 0, 'SPLIT_ONE')
  await expectTerminalText(page, 1, 'SPLIT_TWO')
})

test('macOS line-editing chords reach the shell (⌘⌫ kill-line, ⌘← line-start)', async ({
  page,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await loc.terminalNew(page).click()
  const input = page.locator('.porcelain-ghostty-input').first()
  await input.waitFor()
  await input.focus()
  await expectTerminalText(page, 0, '$')

  await page.keyboard.type('junk that must be discarded && ')
  await page.keyboard.press('Meta+Backspace')
  await page.keyboard.type('echo KILL_$((6*7))')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 0, 'KILL_42')

  await page.keyboard.type('world')
  await page.keyboard.press('Meta+ArrowLeft')
  await page.keyboard.type('echo START_$((6*7))_')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 0, 'START_42_world')
})

test('runs a saved action in a terminal', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')

  await loc.actionsAdd(page).click()
  await loc.actionTitleInput(page).fill('Compute')
  await loc.actionCommandInput(page).fill('echo ACTION_$((6*7))')
  await loc.actionSave(page).click()

  await loc.actionRun(page, 'Compute').click()
  await expectTerminalText(page, 0, 'ACTION_42')
})

// The key bar is touch-only and always on: it supplies the keys a SOFTWARE keyboard
// lacks, so on a desktop pointer (what both runtimes are by default) it's chrome that
// costs a terminal row. No Settings toggle — the gate is the device, not a preference.
test('no key bar on a desktop pointer — the row is touch-only', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await loc.terminalNew(page).click()

  await page.locator('.porcelain-ghostty-input').first().waitFor()
  await expectTerminalText(page, 0, '$')
  await expect(loc.terminalKeyBar(page)).toBeHidden()
})

test.describe('on a touch device', () => {
  test.use({ touchDevice: true })

  test('key bar drives the PTY: arrows recall history, sticky Ctrl and ^C interrupt', async ({
    page,
  }) => {
    await waitForShell(page)
    await selectTab(page, 'Terminal')
    await loc.terminalNew(page).click()

    const input = page.locator('.porcelain-ghostty-input').first()
    await input.waitFor()
    await input.focus()
    await expectTerminalText(page, 0, '$')
    await expect(loc.terminalKeyBar(page)).toBeVisible()

    // A command in history for the arrow keys to recall.
    await page.keyboard.type('echo BAR_$((6*7))')
    await page.keyboard.press('Enter')
    await expectTerminalText(page, 0, 'BAR_42')

    // Up arrow recalls the previous command; Enter re-runs it — proving the bar's arrows
    // reach readline, not the page.
    await loc.terminalKey(page, 'Up').click()
    await page.keyboard.press('Enter')
    await expectTerminalText(page, 0, 'BAR_42')

    // Sticky Ctrl + a typed letter = the control byte: ^C abandons a half-typed line, so
    // the following command runs on its own instead of being appended to the junk.
    await page.keyboard.type('junk that must never run')
    await loc.terminalKey(page, 'ctrl').click()
    await expect(loc.terminalKey(page, 'ctrl')).toHaveAttribute('aria-pressed', 'true')
    await input.focus()
    await page.keyboard.press('c')
    await expect(loc.terminalKey(page, 'ctrl')).toHaveAttribute('aria-pressed', 'false')
    await page.keyboard.type('echo CLEAN_$((6*7))')
    await page.keyboard.press('Enter')
    await expectTerminalText(page, 0, 'CLEAN_42')

    // The ^C shortcut key does the same in one tap.
    await page.keyboard.type('more junk')
    await loc.terminalKey(page, 'ctrl-c').click()
    await page.keyboard.type('echo ONETAP_$((6*7))')
    await page.keyboard.press('Enter')
    await expectTerminalText(page, 0, 'ONETAP_42')
  })
})
