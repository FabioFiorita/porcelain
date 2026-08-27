import {
  expect,
  expectTerminalText,
  loc,
  openTerminals,
  spawnPanelTerminal,
  test,
  waitForShell,
} from './helpers/app'

test('packaged Electron opens a daemon-backed terminal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'electron', 'Electron-only session-origin proof')

  await waitForShell(page)
  await openTerminals(page)
  await expect(loc.terminalPanel(page)).toBeVisible()
  await expectTerminalText(page, 0, '$')
})

test('native clipboard, selection copy, and dropped files reach the daemon PTY', async ({
  app,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'electron', 'Electron-only native clipboard proof')
  if (app === null) throw new Error('Electron project launched without an Electron app')

  await waitForShell(page)
  await openTerminals(page)
  await spawnPanelTerminal(page)
  const input = page.locator('.porcelain-ghostty-input').first()
  await input.waitFor()
  await input.focus()
  await expectTerminalText(page, 0, '$')

  await app.evaluate(({ clipboard }) => {
    clipboard.writeText('echo NATIVE_CLIPBOARD_$((6*7))')
  })
  await page.keyboard.press('Meta+V')
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

  await page.getByRole('application', { name: 'Terminal' }).evaluate((target) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(['terminal attachment'], 'notes.txt', { type: 'text/plain' }))
    target.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }),
    )
  })
  await expectTerminalText(page, 0, 'notes.txt')

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
