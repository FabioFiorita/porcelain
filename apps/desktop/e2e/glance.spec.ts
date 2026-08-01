import { expect, loc, test } from './helpers/app'

// The Glance — empty-viewer home. Browser project only (viewport resize, no
// Electron shell involved). Assertions use stable test ids, not copy.
test('phone viewport lands on the Glance', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  // waitForShell watches rail Settings; on phone the sidebar is a closed Sheet —
  // wait for the Glance itself. Long timeout covers a cold daemon boot.
  await expect(loc.glance(page)).toBeVisible({ timeout: 60_000 })
  await expect(loc.glanceChangedFiles(page)).toHaveAttribute('data-count', '2')
})
