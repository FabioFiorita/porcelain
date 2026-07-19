import { expect, openSettings, test, waitForShell } from './helpers/app'

// The harness pins the OS color scheme to dark (emulateMedia / context
// colorScheme), so the default System preference must resolve dark, Light must
// override it, and returning to System must fall back to the (pinned) OS value.
test('Appearance preference switches the resolved theme', async ({ page }) => {
  await waitForShell(page)

  const rootIsDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'))
  const rootColorScheme = () => page.evaluate(() => document.documentElement.style.colorScheme)

  // System default under a dark OS: dark.
  expect(await rootIsDark()).toBe(true)

  await openSettings(page)
  const appearance = page.getByRole('dialog')

  await appearance.getByRole('button', { name: 'Light', exact: true }).click()
  await expect.poll(rootIsDark).toBe(false)
  expect(await rootColorScheme()).toBe('light')

  await appearance.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect.poll(rootIsDark).toBe(true)
  expect(await rootColorScheme()).toBe('dark')

  // Back to System — the pinned-dark OS wins again.
  await appearance.getByRole('button', { name: 'System', exact: true }).click()
  await expect.poll(rootIsDark).toBe(true)
})
