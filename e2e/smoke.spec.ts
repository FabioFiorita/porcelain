import { expect, openSettings, selectTab, test, waitForShell } from './helpers/app'

test('boots and restores the seeded repo into the shell', async ({ page }) => {
  await waitForShell(page)
  // Empty viewer = Glance (work in flight). Seeded fixture has 2 dirty files.
  await expect(page.getByText('2 changed files').first()).toBeVisible()
})

test('Changes tab lists the working-tree changes', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  // Scope to the Changes panel — Glance can also show "N changed files".
  const panel = page.locator('[data-slot="sidebar-inner"]').filter({ hasText: 'Changes' }).first()
  await expect(panel.getByText('2 changed files')).toBeVisible()
  await expect(page.getByText('Home.tsx')).toBeVisible()
  await expect(page.getByText('Card.tsx')).toBeVisible()
})

test('Board tab keeps the Quick Access toggle (notes/pins)', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  await expect(page.getByRole('button', { name: 'Toggle quick access sidebar' })).toBeVisible()
  // Board no longer suppresses the right rail (U18) — toggle stays.
  await selectTab(page, 'Board')
  await expect(page.getByRole('button', { name: 'Toggle quick access sidebar' })).toBeVisible()
})

test('Settings dialog opens to the General section', async ({ page }) => {
  await waitForShell(page)
  await openSettings(page)
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible()
})

test.describe('without a seeded repo', () => {
  test.use({ seedRepo: false })

  test('shows the Welcome screen', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Open repository' })).toBeVisible()
    await expect(page.getByText('Run agents. Review as a story.')).toBeVisible()
  })
})
