import { expect, loc, openSettings, test, waitForShell } from './helpers/app'

/**
 * Settings → Share: client count + Revoke all rotates the shared token so the old
 * one stops authenticating. Browser-only for the rotate path (same client adopts
 * the new token into localStorage).
 */
test('revokes all by rotating the shared token', async ({ page, appMode }) => {
  test.skip(appMode === 'electron', 'Browser client adopts the rotated token in localStorage')
  await waitForShell(page)

  const shared = await page.evaluate(() => localStorage.getItem('porcelain-daemon-token') ?? '')
  expect(shared).not.toBe('')

  await openSettings(page)
  await page.getByRole('button', { name: 'Share' }).click()
  await expect(loc.shareStatus(page)).toBeVisible()
  await expect(loc.shareStatus(page)).toContainText(/client/)
  await expect(page.getByRole('button', { name: 'Copy token' })).toBeVisible()

  const rotated = page.waitForResponse(
    (res) => res.url().includes('rotateDaemonToken') && res.ok(),
    { timeout: 10_000 },
  )
  await loc.shareRevokeAll(page).click()
  await expect(page.getByText(/issues a new token/i)).toBeVisible()
  await page.getByRole('button', { name: 'Revoke all', exact: true }).last().click()
  await rotated

  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('porcelain-daemon-token') ?? ''))
    .not.toBe(shared)

  const stillValid = await page.evaluate(async (oldToken) => {
    const base = window.location.origin
    const denied = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${oldToken}` },
    })
    const current = localStorage.getItem('porcelain-daemon-token') ?? ''
    const ok = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${current}` },
    })
    return { denied: denied.status, currentOk: ok.status, rotated: current !== oldToken }
  }, shared)
  expect(stillValid.denied).toBe(401)
  expect(stillValid.currentOk).toBe(200)
  expect(stillValid.rotated).toBe(true)
})
