import { expect, REPO_DIR, selectTab, test, waitForShell } from './helpers/electron'
import { createFixtureRepo } from './helpers/fixture-repo'

// The Files test mutates the shared worker-scoped fixture repo (creates/duplicates/
// trashes). Rebuild it pristine once these tests finish — by now every app instance has
// closed — so the read-only smoke/visual specs that follow still see exactly 2 changes.
test.afterAll(async () => {
  await createFixtureRepo(REPO_DIR)
})

// The daily keyboard shortcuts, exercised against the real app: each one runs the same
// store/IPC path a real keystroke would. Files ops hit the new main-process fs
// procedures (createFile/createFolder/duplicatePath + trash) against the throwaway
// fixture repo; the board op writes the PORCELAIN_BOARD-isolated file; the terminal ops
// drive the PTY + the xterm ⌘K interception. Meta = ⌘ on the darwin runner.

test('⌘T spawns a terminal from any tab', async ({ page }) => {
  await waitForShell(page)
  // No terminal tab selected — ⌘T is unconditional.
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
  const rows = page.locator('.xterm-rows').first()
  await expect(rows).toContainText('CLEAR_42', { timeout: 15_000 })

  // ⌘K is intercepted in the xterm registry (never forwarded to the PTY) and clears the
  // scrollback, so the marker disappears.
  await input.focus()
  await page.keyboard.press('Meta+k')
  await expect(rows).not.toContainText('CLEAR_42', { timeout: 15_000 })
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

  // exact:true so a tree row ("README.md") isn't confused with the open tab's close
  // button ("Close README.md").
  const treeRow = (name: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('button', { name, exact: true })

  // ⌘N → new file at the repo root (nothing active yet).
  await page.keyboard.press('Meta+n')
  await page.getByLabel('Name').fill('alpha.txt')
  await page.getByLabel('Name').press('Enter')
  await expect(treeRow('alpha.txt')).toBeVisible({ timeout: 15_000 })

  // ⌘⇧N → new folder at the repo root.
  await page.keyboard.press('Meta+Shift+n')
  await page.getByLabel('Name').fill('beta')
  await page.getByLabel('Name').press('Enter')
  await expect(treeRow('beta')).toBeVisible({ timeout: 15_000 })

  // ⌘D duplicates the active row (clicking sets it active; re-focus the row so the
  // keystroke isn't swallowed by the preview the click opened).
  await treeRow('README.md').click()
  await treeRow('README.md').focus()
  await page.keyboard.press('Meta+d')
  await expect(treeRow('README copy.md')).toBeVisible({ timeout: 15_000 })

  // ⌘⌫ trashes the active row — the file leaves the tree.
  await treeRow('alpha.txt').click()
  await treeRow('alpha.txt').focus()
  await page.keyboard.press('Meta+Backspace')
  await expect(treeRow('alpha.txt')).toHaveCount(0, { timeout: 15_000 })
})
