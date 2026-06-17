import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, REPO_DIR, selectTab, test, waitForShell } from './helpers/electron'
import { createFixtureRepo } from './helpers/fixture-repo'

// This spec mutates a tracked file in the shared worker-scoped fixture repo
// (simulating an external edit). Rebuild it pristine once we're done so the
// read-only smoke/visual specs that follow still see exactly 2 changes.
test.afterAll(async () => {
  await createFixtureRepo(REPO_DIR)
})

// The real bug: a file open in the viewer kept showing the old version after the
// coding agent rewrote it on disk in the embedded terminal. main now watches the
// open files' dirs and pushes a `working-tree` event; the renderer re-reads, and
// the editor adopts the new content when there's nothing unsaved to lose.
test('viewer live-refreshes when an open file is edited on disk', async ({ page, repoDir }) => {
  await waitForShell(page)
  await selectTab(page, 'Files')

  const treeRow = (name: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('button', { name, exact: true })

  // Drill into src/components/Button.tsx — a .tsx file opens in the editable view,
  // the harder path (it keeps a local copy of the content that must be synced).
  await treeRow('src').click()
  await treeRow('components').click()
  await treeRow('Button.tsx').click()

  const editor = page.locator('textarea[aria-label^="Edit "]')
  await expect(editor).toHaveValue(/props\.label/, { timeout: 15_000 })

  // The editor is mounted, so the renderer has pushed its open-file set; give the
  // main-process dir watcher a beat to register before we write (fs.watch only
  // catches changes that happen after it starts).
  await page.waitForTimeout(1_000)

  // External write — stands in for the agent editing the file in the terminal.
  await writeFile(
    join(repoDir, 'src/components/Button.tsx'),
    '// SENTINEL_REFRESHED_ON_DISK\nexport const Button = () => null\n',
  )

  await expect(editor).toHaveValue(/SENTINEL_REFRESHED_ON_DISK/, { timeout: 15_000 })
})
