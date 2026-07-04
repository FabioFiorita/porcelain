import { expect, selectTab, test, waitForShell } from './helpers/electron'

// A distinctive heading so an assertion inside the frame can't accidentally match the
// surrounding app chrome.
const H1_TEXT = 'Feature Artifact Canary'

// A small, self-contained dark-styled document: a heading, a table, an inline SVG, and
// a canary <script> that — IF it ran — would replace the whole body with the sentinel
// text. Under `sandbox=""` the script must never run, so the sentinel must never appear.
const ARTIFACT_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; padding: 24px; background: #0b0b0f; color: #e5e7eb;
           font-family: ui-sans-serif, system-ui, sans-serif; }
    h1 { font-size: 20px; margin: 0 0 16px; }
    table { border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #2a2a35; padding: 4px 10px; text-align: left; }
  </style>
</head>
<body>
  <h1>${H1_TEXT}</h1>
  <table>
    <thead><tr><th>Layer</th><th>File</th></tr></thead>
    <tbody>
      <tr><td>page</td><td>Home.tsx</td></tr>
      <tr><td>component</td><td>Button.tsx</td></tr>
    </tbody>
  </table>
  <svg width="48" height="48" viewBox="0 0 48 48" role="img" aria-label="diamond">
    <polygon points="24,3 45,24 24,45 3,24" fill="#7c9cff" />
  </svg>
  <script>document.body.innerHTML = 'SCRIPT EXECUTED'</script>
</body>
</html>
`

// Seed the feature-artifact channel for the fixture repo (see helpers/electron.ts).
// The app finds it at launch, keyed by the fixture repo, exactly as an MCP write would.
test.use({ seedArtifact: { title: 'Test artifact', html: ARTIFACT_HTML } })

test('feature artifact opens and renders inside a fully sandboxed iframe', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Feature')

  // The opener row appears in the Feature tab only when an artifact exists for the repo.
  const opener = page.getByRole('button', { name: 'Test artifact' })
  await expect(opener).toBeVisible({ timeout: 15_000 })
  await opener.click()

  // Clicking opens an `artifact` tab; artifact-view.tsx gives the iframe the artifact
  // title as its `title` attribute, so we can target it precisely.
  const iframeEl = page.locator('iframe[title="Test artifact"]')
  await expect(iframeEl).toBeVisible({ timeout: 15_000 })

  // The iframe is FULLY sandboxed: `sandbox=""` (no allow-scripts, no allow-same-origin).
  // An empty sandbox attribute reads back as the empty string.
  expect(await iframeEl.getAttribute('sandbox')).toBe('')

  // The srcdoc actually PAINTED under the app's strict CSP: the h1 is visible inside the
  // frame (a same-origin CSP miss would leave the frame blank).
  const frame = page.frameLocator('iframe[title="Test artifact"]')
  await expect(frame.getByRole('heading', { name: H1_TEXT })).toBeVisible({ timeout: 15_000 })
  // The table and inline SVG rendered too — proves the whole self-contained doc painted.
  await expect(frame.locator('table')).toBeVisible()
  await expect(frame.locator('svg')).toBeVisible()

  // sandbox="" blocks scripts: the canary never ran, so its sentinel is nowhere in the
  // frame and the original body content survived.
  await expect(frame.locator('body')).not.toContainText('SCRIPT EXECUTED')
})
