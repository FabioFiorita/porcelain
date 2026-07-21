import { expect, selectTab, test, waitForShell } from './helpers/app'

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

// Evidence renders as the Review's final chapter, so the Review itself has to exist:
// seed a review set (as `porcelain review set` would write it) alongside the evidence.
test.use({
  seedReviewSet: {
    name: 'Ghost variant review',
    files: [{ path: 'src/pages/Home.tsx' }],
    sections: [{ title: 'The variant hop', prose: 'Home passes the new ghost variant down.' }],
  },
  seedEvidence: { title: 'Test evidence', html: EVIDENCE_HTML },
})

test('evidence renders as the Review Evidence tab in a fully sandboxed iframe', async ({
  page,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Review')

  // Sidebar Evidence shortcut uses the evidence title when present.
  const outlineRow = page.getByRole('button', { name: /Test evidence|Evidence/ })
  await expect(outlineRow.first()).toBeVisible({ timeout: 15_000 })

  // Clicking opens the Review canvas on the Evidence tab.
  await outlineRow.first().click()
  await expect(page.getByRole('heading', { name: 'Test evidence' })).toBeVisible({
    timeout: 15_000,
  })

  // The chapter body lazily fetches the HTML and gives the iframe the evidence title.
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

  // Clear is the human's erase path for this ephemeral surface: the Evidence tab and
  // the outline shortcut both drop, while Intent/Execution stay.
  await page.getByRole('button', { name: 'Clear evidence' }).click()
  await expect(outlineRow.first()).not.toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('The variant hop').first()).toBeVisible()
})
