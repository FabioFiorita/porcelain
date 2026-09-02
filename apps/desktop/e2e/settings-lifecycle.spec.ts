import { expect, loc, openSettings, test, waitForShell } from './helpers/app'

test('Electron Settings persists app preferences and reports shell capabilities honestly', async ({
  page,
  appMode,
}) => {
  test.skip(appMode !== 'electron', 'Electron owns updater and Companion capabilities')

  await waitForShell(page)
  await openSettings(page)
  await loc.appearance(page, 'dark').click()
  await expect(loc.appearance(page, 'dark')).toHaveAttribute('aria-pressed', 'true')

  await page.reload()
  await waitForShell(page)
  await openSettings(page)
  await expect(loc.appearance(page, 'dark')).toHaveAttribute('aria-pressed', 'true')

  const dialog = loc.settingsDialog(page)
  await dialog.getByRole('button', { name: 'Updates', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Check for updates' })).toBeDisabled()
  await expect(
    dialog.getByText('Automatic updates are available in the installed Porcelain app.'),
  ).toBeVisible()

  await dialog.getByRole('button', { name: 'Companion', exact: true }).click()
  await expect(dialog.getByText(/Bundled plugin: v/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Add to Codex|Reinstall/ })).toBeVisible()

  // The fixture's user-data directory is disposable, but restore the visible preference so
  // this test also proves the recovery path and leaves screenshots/debugging unsurprising.
  await dialog.getByRole('button', { name: 'General', exact: true }).click()
  await loc.appearance(page, 'system').click()
  await expect(loc.appearance(page, 'system')).toHaveAttribute('aria-pressed', 'true')
})
