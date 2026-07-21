import { expect, expectTerminalText, selectTab, test, waitForShell } from './helpers/app'

// The daily keyboard shortcuts, exercised against the real app. Per-test fixture
// isolation means mutators (Files ops) never poison later specs.

test('⌘T spawns a terminal from any tab', async ({ page }) => {
  await waitForShell(page)
  await page.keyboard.press('Meta+t')
  await expect(page.locator('.xterm-helper-textarea').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('tab', { name: 'Terminal 1' })).toBeVisible()
})

test('⌘N spawns a terminal on the Terminal tab, ⌘K clears it', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Terminal')
  await page.keyboard.press('Meta+n')

  const input = page.locator('.xterm-helper-textarea').first()
  await input.waitFor()
  await input.focus()
  await page.keyboard.type('echo CLEAR_$((6*7))')
  await page.keyboard.press('Enter')
  await expectTerminalText(page, 0, 'CLEAR_42')

  await input.focus()
  await page.keyboard.press('Meta+k')
  await expect
    .poll(() => page.evaluate(() => window.__porcelainTerminalText?.(0) ?? ''), { timeout: 15_000 })
    .not.toContain('CLEAR_42')
})

test('⌘N opens the card composer and ⌘S saves the card', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Board')
  await page.keyboard.press('Meta+n')

  const title = page.getByLabel('Card title')
  await title.waitFor()
  await title.fill('Shortcut card')
  await title.press('Meta+s')

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Shortcut card')).toBeVisible()
})

test('Files: ⌘N new file, ⌘⇧N new folder, ⌘D duplicate, ⌘⌫ trash', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Files')

  const treeRow = (name: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('button', { name, exact: true })

  await page.keyboard.press('Meta+n')
  await page.getByLabel('Name').fill('alpha.txt')
  await page.getByLabel('Name').press('Enter')
  await expect(treeRow('alpha.txt')).toBeVisible({ timeout: 15_000 })

  await page.keyboard.press('Meta+Shift+n')
  await page.getByLabel('Name').fill('beta')
  await page.getByLabel('Name').press('Enter')
  await expect(treeRow('beta')).toBeVisible({ timeout: 15_000 })

  await treeRow('README.md').click()
  await treeRow('README.md').focus()
  await page.keyboard.press('Meta+d')
  await expect(treeRow('README copy.md')).toBeVisible({ timeout: 15_000 })

  await treeRow('alpha.txt').click()
  await treeRow('alpha.txt').focus()
  await page.keyboard.press('Meta+Backspace')
  await expect(treeRow('alpha.txt')).toHaveCount(0, { timeout: 15_000 })
})
