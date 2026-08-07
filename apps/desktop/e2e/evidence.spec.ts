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

// 16×16 PNGs, base64 so the fixture stays a text file. Two of them, because the
// gallery's whole job is showing more than one capture at a time.
const GREEN_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGNQOhpHEmIY1TCqYfhqAACML0UQHuDXpwAAAABJRU5ErkJggg=='
const BLUE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGOwbvpGEmIY1TCqYfhqAACHB7MQtEO1oAAAAABJRU5ErkJggg=='

// Evidence is a Review canvas tab — seed a review set alongside the evidence.
// One pack with all three parts: checks, documents, and captures.
test.use({
  seedReviewSet: {
    name: 'Ghost variant review',
    files: [{ path: 'src/pages/Home.tsx' }],
    sections: [{ title: 'The variant hop', prose: 'Home passes the new ghost variant down.' }],
  },
  seedEvidence: {
    title: 'Test evidence',
    html: EVIDENCE_HTML,
    checks: [
      { label: 'pnpm test', status: 'pass', detail: '1804 passed' },
      { label: 'browser e2e', status: 'pass' },
    ],
    results: [{ file: 'notes.md', body: '# Run notes\n\nFiltered the list and re-read it.' }],
    assets: [
      { file: 'login.png', base64: GREEN_PNG },
      { file: 'board.png', base64: BLUE_PNG },
    ],
  },
})

test('evidence renders as one pack over three sub-tabs', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Review')

  await expect(loc.featureOpenReview(page)).toBeVisible({ timeout: 15_000 })
  await loc.featureOpenReview(page).click()
  await expect(loc.featureCanvas(page)).toBeVisible({ timeout: 15_000 })

  await loc.featureCanvasTab(page, 'evidence').click()
  await expect(loc.evidencePanel(page)).toBeVisible({ timeout: 15_000 })

  // Checks: the agent's structured claim, native DOM — no iframe in this pane.
  await expect(loc.evidenceChecksPane(page)).toBeVisible({ timeout: 15_000 })
  await expect(loc.evidenceChecksPane(page)).toContainText('pnpm test')
  await expect(loc.evidenceChecksPane(page)).toContainText('1804 passed')
  await expect(loc.evidenceChecksPane(page)).toContainText('browser e2e')
  await expect(loc.evidenceIframe(page)).toHaveCount(0)

  // Results: the default document is the HTML report, fully sandboxed.
  await loc.evidenceSubTab(page, 'results').click()
  await expect(loc.evidenceResultsPane(page)).toBeVisible({ timeout: 15_000 })
  const iframeEl = loc.evidenceIframe(page)
  await expect(iframeEl).toBeVisible({ timeout: 15_000 })

  // Fully sandboxed: sandbox="" (no allow-scripts, no allow-same-origin).
  expect(await iframeEl.getAttribute('sandbox')).toBe('')

  // Sandboxed evidence HTML is authored by the agent (or this canary) — assert
  // its body content, not app chrome roles. The iframe root is testid-keyed.
  const frame = iframeEl.contentFrame()
  await expect(frame.locator('h1')).toHaveText(H1_TEXT, { timeout: 15_000 })
  await expect(frame.locator('.pass')).toBeVisible()
  await expect(frame.locator('body')).not.toContainText('SCRIPT EXECUTED')

  // The second pill is the markdown document — escaped prose, no iframe.
  await loc.evidenceDocTab(page, 'Notes').click()
  await expect(loc.evidenceResultsPane(page)).toContainText('Run notes')
  await expect(loc.evidenceIframe(page)).toHaveCount(0)

  // Assets: a native gallery, one tile per image, zoomed in a dialog.
  await loc.evidenceSubTab(page, 'assets').click()
  await expect(loc.evidenceGallery(page)).toBeVisible({ timeout: 15_000 })
  await expect(loc.evidenceGalleryItem(page, 'login.png')).toBeVisible({ timeout: 15_000 })
  await expect(loc.evidenceGalleryItem(page, 'board.png')).toBeVisible()

  await loc.evidenceGalleryItem(page, 'login.png').click()
  const zoom = loc.evidenceGalleryZoom(page)
  await expect(zoom).toBeVisible({ timeout: 15_000 })
  // The bytes ride tRPC as a data URL — never a URL into the static server.
  const src = await zoom.locator('img').getAttribute('src')
  expect(src?.startsWith('data:image/png;base64,')).toBe(true)
  await page.keyboard.press('Escape')
  await expect(zoom).not.toBeVisible()

  // Clear takes the whole pack down, not just one sub-tab.
  await loc.evidenceClear(page).click()
  await expect(loc.evidencePanel(page)).not.toBeVisible({ timeout: 15_000 })
  // Intent canvas still has the review name / sections after clear of evidence only.
  await expect(loc.featureCanvas(page)).toBeVisible()
})
