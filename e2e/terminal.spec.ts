import { expect, expectTerminalText, loc, selectTab, test, waitForShell } from './helpers/app'

// Real PTY round-trip: node-pty + bash (PORCELAIN_SHELL). Locators for chrome use
// data-testid; xterm still uses the buffer hook (WebGL has no scrapeable DOM).

test('opens a terminal and runs a typed command', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await loc.terminalNew(page).click()

  const input = page.locator('.xterm-helper-textarea').first()
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

test('splits two terminals side by side, both rendering', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')

  await loc.terminalNew(page).click()
  await page.locator('.xterm-helper-textarea').first().focus()
  await expectTerminalText(page, 0, '$')
  await page.keyboard.type('echo SPLIT_ONE')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 0, 'SPLIT_ONE')

  await loc.terminalNew(page).click()
  await expectTerminalText(page, 1, '$')
  await page.locator('.xterm-helper-textarea').first().focus()
  await page.keyboard.type('echo SPLIT_TWO')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 1, 'SPLIT_TWO')

  await loc.viewerTab(page, 'Terminal 2').click({ button: 'right' })
  await loc.viewerTabOpenToSide(page).click()

  await expect(page.locator('.xterm')).toHaveCount(2)
  await expectTerminalText(page, 0, 'SPLIT_ONE')
  await expectTerminalText(page, 1, 'SPLIT_TWO')
})

test('macOS line-editing chords reach the shell (⌘⌫ kill-line, ⌘← line-start)', async ({
  page,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await loc.terminalNew(page).click()
  const input = page.locator('.xterm-helper-textarea').first()
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

test('key bar drives the PTY: arrows recall history, sticky Ctrl and ^C interrupt', async ({
  page,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await loc.terminalNew(page).click()

  const input = page.locator('.xterm-helper-textarea').first()
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
