import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, loc, selectTab, test, waitForShell } from './helpers/app'

// Per-test fixture isolation recreates the repo for every test — no afterAll restore.

// The real bug: a file open in the viewer kept showing the old version after the
// coding agent rewrote it on disk. main watches open files' dirs and pushes a
// working-tree event; the renderer re-reads when clean.
test('viewer live-refreshes when an open file is edited on disk', async ({ page, repoDir }) => {
  await waitForShell(page)
  await selectTab(page, 'Files')

  await loc.treeEntry(page, 'src').click()
  await loc.treeEntry(page, 'components').click()
  await loc.treeEntry(page, 'Button.tsx').click()

  const editor = loc.fileEditor(page)
  await expect(editor).toHaveValue(/props\.label/, { timeout: 15_000 })

  // Give the main-process dir watcher a beat to register before we write.
  await page.waitForTimeout(1_000)

  await writeFile(
    join(repoDir, 'src/components/Button.tsx'),
    '// SENTINEL_REFRESHED_ON_DISK\nexport const Button = () => null\n',
  )

  await expect(editor).toHaveValue(/SENTINEL_REFRESHED_ON_DISK/, { timeout: 15_000 })
})
