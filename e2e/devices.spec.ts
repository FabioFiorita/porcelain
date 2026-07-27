import { expect, loc, openSettings, test, waitForShell } from './helpers/app'

/**
 * Settings → Share end to end: pairing still hands out the SHARED token (one secret
 * for every client), the Access block shows a client count, and Revoke all rotates
 * the token so the old one stops authenticating.
 *
 * Pairing runs through `fetch` from inside the page rather than the UI, because the
 * UI's half of it lives on the OTHER device. Browser-only: pairing is an HTTP-origin
 * flow (POST to the daemon's own origin), which the Electron renderer does not have.
 */
test('pairs with the shared token and revokes everyone', async ({ page, appMode }) => {
  test.skip(appMode === 'electron', 'Pairing needs an HTTP origin; the renderer has none')
  await waitForShell(page)

  const tokens = await page.evaluate(async () => {
    const shared = localStorage.getItem('porcelain-daemon-token') ?? ''
    const base = window.location.origin
    const started = await (
      await fetch(`${base}/trpc/startPairing`, {
        method: 'POST',
        headers: { authorization: `Bearer ${shared}`, 'content-type': 'application/json' },
        body: '{}',
      })
    ).json()
    const paired = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: started.result.data.code, label: 'Safari on iPhone' }),
    })
    // One shared secret: pairing hands out the same token this client already holds.
    const minted = ((await paired.json()) as { token: string }).token
    return { shared, minted, same: minted === shared }
  })
  expect(tokens.same).toBe(true)

  await openSettings(page)
  await page.getByRole('button', { name: 'Share' }).click()
  await expect(loc.shareStatus(page)).toBeVisible()
  // At least this browser tab is a live session.
  await expect(loc.shareStatus(page)).toContainText(/client/)

  await loc.shareRevokeAll(page).click()
  await expect(page.getByText(/rotates the daemon token/i)).toBeVisible()
  await page.getByRole('button', { name: 'Revoke all', exact: true }).last().click()

  // After rotation the old token must 401; the page adopted the new one so Share still works.
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
  }, tokens.shared)
  expect(stillValid.denied).toBe(401)
  expect(stillValid.currentOk).toBe(200)
  expect(stillValid.rotated).toBe(true)
})
