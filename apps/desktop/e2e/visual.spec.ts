import type { Locator } from '@playwright/test'
import { expect, loc, openSettings, selectTab, test, waitForShell } from './helpers/app'

// Screenshot baselines = the regression net. DOM-only (no native window chrome /
// traffic lights — the UI is one opaque design, no vibrancy), per-platform.
// Deliberately NOT screenshotting the History list — its relative timestamps drift.
// Regenerate after intentional UI changes with `pnpm --dir apps/desktop test:e2e:update`.

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

// The surface launcher is exactly these six, in this order — the ⌘1,2,4–7 contract.
const RAIL_TABS = ['files', 'changes', 'history', 'search', 'tasks', 'canvas']

// Element-scoped baseline for the surface launcher. Framing just the launcher makes a tab
// restyle fail where full-page 2% tolerance would swallow it.
test('surface launcher', async ({ page }) => {
  await waitForShell(page)
  const rail = loc.rail(page)
  for (const tab of RAIL_TABS) {
    await expect(loc.railTab(page, tab)).toBeVisible()
  }
  await expect(loc.railTab(page, 'board')).toHaveCount(0)
  // Count too: a tab coming back would still pass the per-id loop above.
  await expect(loc.railTabs(page)).toHaveCount(RAIL_TABS.length)
  await expect(rail).toHaveScreenshot('surface-launcher.png')
})

// Element-scoped surface beside the Viewer.
test('surface sidebar — changes', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  const panel = page.locator(
    '[data-slot="sidebar-container"][data-side="right"] [data-slot="sidebar-inner"]',
  )
  await expect(loc.changesSummary(page)).toHaveAttribute('data-count', '2')
  await expect(panel).toHaveScreenshot('surface-changes.png')
})

test('header commands expose commit controls', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  await loc.commandsMenu(page).click()
  await expect(loc.commitButton(page)).toBeVisible()
})

test('header actions expose saved commands', async ({ page }) => {
  await waitForShell(page)
  await loc.actionsMenu(page).click()
  await expect(loc.actionsAdd(page)).toBeVisible()
})

/**
 * The floating sidebar's outline is a `ring-1`, which Tailwind paints OUTSIDE the
 * box — not a border inside it. Its container is `overflow-hidden`, so a card
 * flush with the edge loses its ring to the clip.
 */
test('the floating sidebar card keeps its top outline inside the clip', async ({ page }) => {
  await waitForShell(page)

  const container = page.locator('[data-slot="sidebar-container"]').first()
  const inner = page.locator('[data-slot="sidebar-inner"]').first()
  const frame = await container.evaluate((el) => {
    const card = el.querySelector('[data-slot="sidebar-inner"]')
    if (card === null) throw new Error('sidebar inner not found')
    const style = getComputedStyle(el)
    return {
      clips: style.overflow === 'hidden' || style.overflowY === 'hidden',
      containerTop: el.getBoundingClientRect().top,
      cardTop: card.getBoundingClientRect().top,
      ringIsOutset: getComputedStyle(card).boxShadow.includes('0px 0px 0px 1px'),
    }
  })

  expect(frame.clips, 'container still clips its overflow').toBe(true)
  expect(frame.ringIsOutset, 'card outline is still an outset 1px ring').toBe(true)
  expect(frame.cardTop).toBeGreaterThan(frame.containerTop)
  await expect(inner).toBeVisible()
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
  // Compare what the user SEES, not the border boxes. The two sidebar cards are
  // outlined by a `ring-1`, which paints one pixel OUTSIDE the box; the viewer is
  // outlined by a border, which paints inside it. Comparing boxes made this pass
  // while the left card's top ring was clipped away entirely and the right card's
  // sat a pixel above the viewer's — a shared box was never a shared frame.
  const paintedTop = async (card: Locator): Promise<number> =>
    card.evaluate((el) => {
      const top = el.getBoundingClientRect().top
      return getComputedStyle(el).boxShadow.includes('0px 0px 0px 1px') ? top - 1 : top
    })

  expect(await paintedTop(left)).toBe(await paintedTop(viewer))
  expect(await paintedTop(right)).toBe(await paintedTop(viewer))
  const paintedBottom = async (card: Locator): Promise<number> =>
    card.evaluate((el) => {
      const bottom = el.getBoundingClientRect().bottom
      return getComputedStyle(el).boxShadow.includes('0px 0px 0px 1px') ? bottom + 1 : bottom
    })

  expect(await paintedBottom(left)).toBe(await paintedBottom(viewer))
  expect(await paintedBottom(right)).toBe(await paintedBottom(viewer))
})

test('settings dialog', async ({ page }) => {
  await waitForShell(page)
  await openSettings(page)
  await expect(loc.settingsHeading(page)).toHaveText('General')
  await expect(loc.settingsDialog(page)).toHaveScreenshot('settings-general.png')
})

// Phone Settings: horizontal section chips + stacked preference rows. Boot at
// desktop so the shell is visible, then shrink — Settings lives in the mobile
// navigation sheet when closed.
test('settings dialog — phone', async ({ page, appMode }) => {
  await waitForShell(page)
  await page.setViewportSize({ width: 390, height: 844 })
  // The navigation sheet closes at the mobile breakpoint; open it for the gear.
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
  // Chips navigate: leave General and come back, so the screenshot is the
  // section the mobile nav landed on, not the one it opened with.
  await dialog.getByRole('button', { name: 'Remotes', exact: true }).click()
  await expect(loc.settingsHeading(page)).toHaveText('Remotes')
  await dialog.getByRole('button', { name: 'General' }).click()
  await expect(loc.settingsHeading(page)).toHaveText('General')
  await expect(dialog).toHaveScreenshot('settings-general-mobile.png')
})

test.describe('without a seeded repo', () => {
  test.use({ seedRepo: false })

  test('welcome screen', async ({ page }) => {
    await expect(loc.hubHome(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remote daemon settings' })).toHaveCount(0)
    await expect(page).toHaveScreenshot('welcome.png')
  })
})
