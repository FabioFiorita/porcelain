import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { E2E_ADMIN_TOKEN, expect, test, waitForShell } from './helpers/app'

/**
 * The pairing exchange, end to end, against a real daemon.
 *
 * Every other browser spec plants a client credential before the first page script, and a
 * development daemon now hands one out from `/dev-auth` — so nothing else in the repo ever
 * walks the flow a real device walks. That is precisely why this file exists: the
 * convenience is only safe while the thing it skips is proven somewhere.
 *
 * These specs face the gate (`plantToken: false`). The e2e daemon sets PORCELAIN_E2E and
 * NOT PORCELAIN_DEV, so `/dev-auth` is not mounted here and the gate is the real one.
 */
test.use({ plantToken: false })

const daemonOrigin = (url: string): string => new URL(url).origin

async function mintPairingLink(origin: string, label: string): Promise<string> {
  const response = await fetch(`${origin}/trpc/issuePairingLink`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${E2E_ADMIN_TOKEN}`,
      'content-type': 'application/json',
      [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
    },
    body: JSON.stringify({ label, baseUrl: origin }),
  })
  if (!response.ok) throw new Error(`issuePairingLink failed: ${response.status}`)
  const body = (await response.json()) as { result?: { data?: { url?: string } } }
  const url = body.result?.data?.url
  if (url === undefined)
    throw new Error(`issuePairingLink returned no url: ${JSON.stringify(body)}`)
  return url
}

test('an unpaired browser is held at the gate', async ({ page }) => {
  await expect(page.getByLabel('Connection link')).toBeVisible()
  // The gate renders BEFORE the app, so no daemon query escapes un-gated.
  await expect(page.getByRole('button', { name: 'Connect' })).toBeDisabled()
})

test('a pairing link exchanges for a client credential and opens the app', async ({ page }) => {
  const link = await mintPairingLink(daemonOrigin(page.url()), 'E2E pairing device')

  await page.goto(link)

  await waitForShell(page)
  // The one-time fragment must not survive in history for a later navigation to replay.
  expect(new URL(page.url()).pathname).toBe('/')
  expect(new URL(page.url()).hash).toBe('')
  const stored = await page.evaluate(() => localStorage.getItem('porcelain-client-token'))
  expect(stored).toMatch(/^pc_client_/)
})

test('a pairing link is refused the second time it is used', async ({ page }) => {
  const origin = daemonOrigin(page.url())
  const link = await mintPairingLink(origin, 'E2E replay device')

  await page.goto(link)
  await waitForShell(page)

  // A one-time credential replayed from a second browser must fail closed, or a leaked
  // link in a log or screenshot would keep working.
  await page.evaluate(() => localStorage.removeItem('porcelain-client-token'))
  await page.goto(link)

  await expect(page.getByLabel('Connection link')).toBeVisible()
  await expect(page.getByText(/invalid, expired, already used/)).toBeVisible()
})

test('the gate refuses a link that is not a pairing URL', async ({ page }) => {
  await page.getByLabel('Connection link').fill('https://example.com/not-pairing')
  await page.getByRole('button', { name: 'Connect' }).click()

  await expect(page.getByText(/invalid, expired, already used/)).toBeVisible()
  await expect(page.getByLabel('Connection link')).toBeVisible()
})
