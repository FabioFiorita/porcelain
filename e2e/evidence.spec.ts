import { expect, loc, selectTab, test, waitForShell } from './helpers/app'

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

// Evidence is a Review canvas tab — seed a review set alongside the evidence.
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

  await expect(loc.featureOpenReview(page)).toBeVisible({ timeout: 15_000 })
  await loc.featureOpenReview(page).click()
  await expect(loc.featureCanvas(page)).toBeVisible({ timeout: 15_000 })

  await loc.featureCanvasTab(page, 'evidence').click()
  await expect(loc.evidencePanel(page)).toBeVisible({ timeout: 15_000 })

  const iframeEl = loc.evidenceIframe(page)
  await expect(iframeEl).toBeVisible({ timeout: 15_000 })

  // Fully sandboxed: sandbox="" (no allow-scripts, no allow-same-origin).
  expect(await iframeEl.getAttribute('sandbox')).toBe('')

  const frame = page.frameLocator(`[data-testid="evidence-iframe"]`)
  await expect(frame.getByRole('heading', { name: H1_TEXT })).toBeVisible({ timeout: 15_000 })
  await expect(frame.locator('.pass')).toBeVisible()
  await expect(frame.locator('body')).not.toContainText('SCRIPT EXECUTED')

  await loc.evidenceClear(page).click()
  await expect(loc.evidencePanel(page)).not.toBeVisible({ timeout: 15_000 })
  // Intent canvas still has the review name / sections after clear of evidence only.
  await expect(loc.featureCanvas(page)).toBeVisible()
})
