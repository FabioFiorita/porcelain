import { expect, loc, openSettings, selectTab, test, waitForShell } from './helpers/app'

// Screenshot baselines = the regression net. DOM-only (no native window chrome /
// traffic lights — the UI is one opaque design, no vibrancy), per-platform.
// Deliberately NOT screenshotting the History list — its relative timestamps drift.
// Regenerate after intentional UI changes with `pnpm test:e2e:update`.

test('empty viewer', async ({ page }) => {
  await waitForShell(page)
  await expect(loc.glanceChangedFiles(page)).toHaveAttribute('data-count', '2')
  await expect(page).toHaveScreenshot('empty-viewer.png')
})

test('changes tab', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  await expect(loc.changesSummary(page)).toHaveAttribute('data-count', '2')
  await expect(page).toHaveScreenshot('changes-tab.png')
})

// The rail is exactly these seven, in this order — the ⌘1–7 contract.
const RAIL_TABS = ['files', 'changes', 'feature', 'history', 'search', 'board', 'terminal']

// Element-scoped baseline for the icon rail. Framing just the rail makes a tab
// restyle fail where full-page 2% tolerance would swallow it.
test('sidebar icon rail', async ({ page }) => {
  await waitForShell(page)
  const rail = loc.rail(page)
  for (const tab of RAIL_TABS) {
    await expect(loc.railTab(page, tab)).toBeVisible()
  }
  // Count too: a tab coming back would still pass the per-id loop above.
  await expect(loc.railTabs(page)).toHaveCount(RAIL_TABS.length)
  await expect(rail).toHaveScreenshot('sidebar-rail.png')
})

// Element-scoped companion to the full-page `changes tab` shot.
test('quick access — changes', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  const panel = page.locator(
    '[data-slot="sidebar-container"][data-side="right"] [data-slot="sidebar-inner"]',
  )
  await expect(loc.commitButton(page)).toBeVisible()
  await expect(panel).toHaveScreenshot('quick-access-changes.png')
})

test('shell cards share one vertical frame', async ({ page }) => {
  await waitForShell(page)
  const left = page.locator(
    '[data-slot="sidebar-container"][data-side="left"] [data-slot="sidebar-inner"]',
  )
  const right = page.locator(
    '[data-slot="sidebar-container"][data-side="right"] [data-slot="sidebar-inner"]',
  )
  const viewer = loc.viewerCard(page)
  const [leftBox, viewerBox, rightBox] = await Promise.all([
    left.boundingBox(),
    viewer.boundingBox(),
    right.boundingBox(),
  ])
  if (leftBox === null || viewerBox === null || rightBox === null) {
    throw new Error('expected all three shell cards')
  }
  expect(leftBox.y).toBe(viewerBox.y)
  expect(rightBox.y).toBe(viewerBox.y)
  expect(leftBox.y + leftBox.height).toBe(viewerBox.y + viewerBox.height)
  expect(rightBox.y + rightBox.height).toBe(viewerBox.y + viewerBox.height)
})

test('settings dialog', async ({ page }) => {
  await waitForShell(page)
  await openSettings(page)
  await expect(loc.settingsHeading(page)).toHaveText('General')
  await expect(loc.settingsDialog(page)).toHaveScreenshot('settings-general.png')
})

// Phone Settings: horizontal section chips + stacked preference rows (not the
// dual-pane rail that left ~200px for toggles). Boot at desktop so the shell is
// visible, then shrink — rail Settings lives in the mobile sheet when closed.
test('settings dialog — phone', async ({ page, appMode }) => {
  await waitForShell(page)
  await page.setViewportSize({ width: 390, height: 844 })
  // Dual-rail sheet closes at the mobile breakpoint; open it for the gear.
  if (!(await loc.railSettings(page).isVisible())) {
    await loc.toggleLeftSidebar(page).click()
    await expect(loc.railSettings(page)).toBeVisible({ timeout: 10_000 })
  }
  const mobileSidebar = page.locator('[data-slot="sidebar"][data-mobile="true"]')
  const mobileSidebarBox = await mobileSidebar.boundingBox()
  if (mobileSidebarBox === null) throw new Error('expected the mobile sidebar')
  expect(mobileSidebarBox.y).toBe(0)
  expect(mobileSidebarBox.height).toBe(844)
  await openSettings(page)
  const dialog = loc.settingsDialog(page)
  await expect(loc.settingsHeading(page)).toHaveText('General')
  // Mobile nav is chips, not the desktop sidebar list.
  await expect(dialog.getByRole('navigation', { name: 'Settings sections' })).toBeVisible()
  if (appMode === 'browser') {
    await expect(dialog.getByRole('button', { name: 'Share' })).toHaveCount(0)
  } else {
    await expect(dialog.getByRole('button', { name: 'Share' })).toBeVisible()
  }
  // Preference rows stack: Appearance label above the System segment.
  const appearance = dialog.getByText('Appearance', { exact: true })
  const system = loc.appearance(page, 'system')
  await expect(appearance).toBeVisible()
  await expect(system).toBeVisible()
  const aBox = await appearance.boundingBox()
  const sBox = await system.boundingBox()
  if (aBox === null || sBox === null) throw new Error('expected Appearance and System boxes')
  expect(sBox.y).toBeGreaterThan(aBox.y + aBox.height - 4)
  await dialog.getByRole('button', { name: 'Review', exact: true }).click()
  await expect(loc.settingsHeading(page)).toHaveText('Review layers')
  // Force the same constrained-height case as a long user-defined layer list.
  await page.setViewportSize({ width: 390, height: 600 })
  const body = dialog.locator('main')
  await expect
    .poll(() => body.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(dialog.getByRole('button', { name: 'Save' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await dialog.getByRole('button', { name: 'General' }).click()
  await expect(loc.settingsHeading(page)).toHaveText('General')
  await body.evaluate((element) => {
    element.scrollTop = 0
  })
  await expect(dialog).toHaveScreenshot('settings-general-mobile.png')
})

test.describe('without a seeded repo', () => {
  test.use({ seedRepo: false })

  test('welcome screen', async ({ page }) => {
    await expect(loc.welcomeOpenRepo(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remote daemon settings' })).toHaveCount(0)
    await expect(page).toHaveScreenshot('welcome.png')
  })
})
