import { expect, selectTab, test, waitForShell } from './helpers/electron'

// A distinctive heading so an assertion inside the frame can't accidentally match the
// surrounding app chrome.
const H1_TEXT = 'Loop Evidence Canary'

// A small, self-contained dark-styled document: a pass summary + a canary <script>
// that — IF it ran — would replace the whole body with the sentinel text. Under
// `sandbox=""` the script must never run, so the sentinel must never appear.
const EVIDENCE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; padding: 24px; background: #0b0b0f; color: #e5e7eb;
           font-family: ui-sans-serif, system-ui, sans-serif; }
    h1 { font-size: 20px; margin: 0 0 16px; }
    .pass { color: #86efac; }
  </style>
</head>
<body>
  <h1>${H1_TEXT}</h1>
  <p class="pass">Status: PASS — browser smoke</p>
  <ol>
    <li>pnpm dev</li>
    <li>opened /login</li>
    <li>form submitted</li>
  </ol>
  <script>document.body.innerHTML = 'SCRIPT EXECUTED'</script>
</body>
</html>
`

// Seed the loop-evidence channel for the fixture repo (see helpers/electron.ts).
// The app finds it at launch, keyed by the fixture repo, exactly as an MCP write would.
test.use({ seedEvidence: { title: 'Test evidence', html: EVIDENCE_HTML } })

test('loop evidence opens and renders inside a fully sandboxed iframe', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Feature')

  // The opener row appears in the Feature tab only when evidence exists for the repo.
  // The row carries a static label ("Loop evidence"), not the evidence's own title.
  const opener = page.getByRole('button', { name: 'Loop evidence' })
  await expect(opener).toBeVisible({ timeout: 15_000 })
  await opener.click()

  // Clicking opens an `evidence` tab; evidence-view.tsx gives the iframe the evidence
  // title as its `title` attribute, so we can target it precisely.
  const iframeEl = page.locator('iframe[title="Test evidence"]')
  await expect(iframeEl).toBeVisible({ timeout: 15_000 })

  // The iframe is FULLY sandboxed: `sandbox=""` (no allow-scripts, no allow-same-origin).
  expect(await iframeEl.getAttribute('sandbox')).toBe('')

  // The srcdoc actually PAINTED under the app's strict CSP.
  const frame = page.frameLocator('iframe[title="Test evidence"]')
  await expect(frame.getByRole('heading', { name: H1_TEXT })).toBeVisible({ timeout: 15_000 })
  await expect(frame.locator('.pass')).toBeVisible()

  // sandbox="" blocks scripts: the canary never ran.
  await expect(frame.locator('body')).not.toContainText('SCRIPT EXECUTED')

  // Clear is the human's erase path for this ephemeral surface.
  await page.getByRole('button', { name: 'Clear loop evidence' }).click()
  await expect(page.getByText(/No loop evidence/i)).toBeVisible({ timeout: 15_000 })
})
