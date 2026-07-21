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
  await page.getByLabel('Action title').fill('Compute')
  await page.getByLabel('Action command').fill('echo ACTION_$((6*7))')
  await page.getByRole('button', { name: 'Add action' }).click()

  await loc.actionRun(page, 'Compute').click()
  await expectTerminalText(page, 0, 'ACTION_42')
})
