import { expect, loc, openSettings, test, waitForShell } from './helpers/app'

/**
 * The device roster end to end (plans/environments-v2.md phase 4): pair a device against
 * the live daemon, see it appear with its self-chosen label, revoke it, watch it go.
 *
 * The pairing half runs through `fetch` from inside the page rather than the UI, because
 * the UI's half of it lives on the OTHER device — this client is the one being paired
 * from. What's under test here is the roster and revoke, which are this client's surface.
 */
test('pairs a device, shows it in the roster, and revokes it', async ({ page }) => {
  await waitForShell(page)

  const gotOwnCredential = await page.evaluate(async () => {
    const token = localStorage.getItem('porcelain-daemon-token') ?? ''
    const base = window.location.origin
    const started = await (
      await fetch(`${base}/trpc/startPairing`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: '{}',
      })
    ).json()
    const paired = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: started.result.data.code, label: 'Safari on iPhone' }),
    })
    // The whole point of phase 4: pairing mints a NEW credential, never the shared token.
    return (await paired.json()).token !== token
  })
  expect(gotOwnCredential).toBe(true)

  await openSettings(page)
  await page.getByRole('button', { name: 'Environments' }).click()
  await expect(loc.connectedDevices(page)).toBeVisible()

  const row = loc.connectedDeviceRows(page)
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Safari on iPhone')

  await row.getByRole('button', { name: 'Revoke' }).click()
  // Confirmed, not immediate — revoking is irreversible from this side.
  await expect(page.getByText(/pair it from scratch/)).toBeVisible()
  await page.getByRole('button', { name: 'Revoke', exact: true }).last().click()
  await expect(loc.connectedDeviceRows(page)).toHaveCount(0)
})
