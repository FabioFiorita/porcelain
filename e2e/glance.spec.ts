import { expect, test } from './helpers/app'

// The Glance — the phone-only home the empty viewer becomes below 768px. Browser
// project only (a viewport resize, no Electron shell involved). Role/text
// assertions, no visual baseline.
test('phone viewport lands on the Glance', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  // waitForShell watches the sidebar's Settings button, but on a phone the sidebar
  // is a closed Sheet — wait for the Glance itself instead. The long timeout covers
  // a cold daemon boot, same as waitForShell.
  await expect(page.getByRole('heading', { name: 'porcelain-e2e-fixture' })).toBeVisible({
    timeout: 60_000,
  })
  // The "this checkout" row: the fixture repo ships two working-tree changes.
  await expect(page.getByText('This checkout')).toBeVisible()
  await expect(page.getByText('2 changed files')).toBeVisible()
})
