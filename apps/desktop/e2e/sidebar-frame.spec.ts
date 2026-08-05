import { expect, test, waitForShell } from './helpers/app'

/**
 * The floating sidebar's outline is a `ring-1`, which Tailwind paints OUTSIDE the
 * box — not a border inside it. Its container is `overflow-hidden` (that clip is
 * what hides the panel when the rail collapses), so any side where the card sits
 * flush loses its ring to the clip. That is how the top edge went missing: `pt-0`
 * put the card at the container's exact top, and only the top ring was cut.
 *
 * Unmeasurable in jsdom — no layout, no clipping — so the guard lives here.
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

  // If either premise stops holding the assertion below is no longer the right
  // guard — fail loudly rather than passing vacuously.
  expect(frame.clips, 'container still clips its overflow').toBe(true)
  expect(frame.ringIsOutset, 'card outline is still an outset 1px ring').toBe(true)

  // The whole point: at least one pixel between the clip edge and the card, or
  // the ring has nowhere to paint.
  expect(frame.cardTop).toBeGreaterThan(frame.containerTop)

  await expect(inner).toBeVisible()
})
