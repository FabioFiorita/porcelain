import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Locator } from '@playwright/test'
import { expect, loc, selectTab, test, waitForShell } from './helpers/app'

/**
 * Reading a diff must never need horizontal scrolling.
 *
 * This is the ONLY gate that can see the shipped path. The Viewer's diff renders
 * through `HunksView`'s `pane` layout → `VirtualRows fitWidth dynamicHeight`, and a
 * jsdom unit test can't reach it: the virtualizer measures a 0-tall scroll element
 * there and mounts no rows at all. Everything that makes wrapping work — `fitWidth`
 * pinning the row to the scroller, `dynamicHeight` letting the row be 2+ lines tall,
 * `wrap-anywhere` + `min-w-0` breaking a token that has no space to break at — is only
 * observable once a real engine lays it out.
 */

// One unbroken token, far wider than the Viewer at the diff's 12px monospace: it can
// only fit by breaking MID-token, which `whitespace-pre` (and `break-words`) never do.
const MARKER = 'LONGWRAPMARKER'
const LONG = `${MARKER}${'a'.repeat(400)}`

const HOME_WITH_LONG_LINE = `import { Button } from '../components/Button'

export function Home() {
  const href = '${LONG}'
  return <Button label="Hello" variant="ghost" href={href} />
}
`

/** The diff row holding the long line, plus the scroller it must not widen. */
async function measure(
  row: Locator,
): Promise<{ rowHeight: number; scrollWidth: number; clientWidth: number }> {
  return await row.evaluate((el: HTMLElement) => {
    const rowHeight = el.getBoundingClientRect().height
    // The VirtualRows scroll element is the first ancestor that scrolls at all
    // (`overflow-auto` sets both axes) — it owns the scrollWidth this test is about.
    let node = el.parentElement
    while (node !== null && getComputedStyle(node).overflowX !== 'auto') node = node.parentElement
    if (node === null) throw new Error('no scroll container above the diff row')
    return { rowHeight, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }
  })
}

test('a long diff line wraps instead of scrolling the diff sideways', async ({ page, repoDir }) => {
  // Written before the app is asked for any diff: the per-file diff is only queried
  // when the file is clicked, well after this.
  await writeFile(join(repoDir, 'src/pages/Home.tsx'), HOME_WITH_LONG_LINE)

  await waitForShell(page)
  await selectTab(page, 'Changes')
  await loc.changesFile(page, 'Home.tsx').click()

  const row = loc.viewerCard(page).locator('[data-line]').filter({ hasText: MARKER }).first()
  await expect(row).toBeVisible({ timeout: 15_000 })

  const unified = await measure(row)
  // Nothing extends past the viewport, so there is nothing to scroll sideways to.
  expect(unified.scrollWidth).toBe(unified.clientWidth)
  // ~400 monospace chars in a Viewer-width column: several line boxes, never one.
  // A fixed-height row (the pre-wrap behaviour) reports exactly one 20px line here.
  expect(unified.rowHeight).toBeGreaterThan(40)

  // Split mode is the other half: two cells share the width, so the long side wraps
  // harder — and its cell must neither clip it nor pin the row to the shorter side.
  await page.getByRole('button', { name: 'Split', exact: true }).click()
  const splitRow = loc.viewerCard(page).locator('[data-line]').filter({ hasText: MARKER }).first()
  await expect(splitRow).toBeVisible()
  const split = await measure(splitRow)
  expect(split.scrollWidth).toBe(split.clientWidth)
  expect(split.rowHeight).toBeGreaterThan(40)
})
