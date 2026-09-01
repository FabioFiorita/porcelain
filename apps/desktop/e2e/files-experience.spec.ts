import { access, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, loc, selectTab, test, waitForShell } from './helpers/app'

async function chooseContextAction(
  page: Parameters<typeof waitForShell>[0],
  entryName: string,
  action: string,
): Promise<void> {
  await loc.treeEntry(page, entryName).last().click({ button: 'right' })
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}

test('Files keeps real filesystem operations, scope, search, and watchers coherent', async ({
  page,
  repoDir,
  seeded,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Files')
  await expect(loc.treeEntry(page, 'README.md')).toBeVisible()

  // The root watcher must surface changes made outside Porcelain.
  // The interest travels over the session socket after the initial tree query; let the
  // Electron child daemon acknowledge that subscription before changing the fixture.
  await page.waitForTimeout(1_000)
  await writeFile(join(repoDir, 'external-note.txt'), 'external watcher sentinel\n')
  await expect(loc.treeEntry(page, 'external-note.txt')).toBeVisible({ timeout: 15_000 })

  // Scope changes are project-relative on the wire, but remain absolute and stable in the UI.
  await chooseContextAction(page, 'external-note.txt', 'Pin')
  await expect
    .poll(async () => {
      const projectsDir = join(seeded.udBase, 'projects')
      const paths = await readdir(projectsDir, { recursive: true }).catch(() => [])
      const profile = paths.find((path) => path.endsWith('project.json'))
      return profile === undefined ? '' : readFile(join(projectsDir, profile), 'utf8')
    })
    .toContain('external-note.txt')
  await expect(loc.treeEntry(page, 'external-note.txt')).toHaveCount(2)
  await chooseContextAction(page, 'external-note.txt', 'Hide')
  await expect(loc.treeEntry(page, 'external-note.txt')).toHaveCount(1)
  await page.getByLabel('Show hidden entries').click()
  await expect(loc.treeEntry(page, 'external-note.txt')).toHaveCount(2)

  // Create a folder and file through the UI, then prove editor persistence and content search.
  await chooseContextAction(page, 'README.md', 'New Folder')
  await loc.filePromptName(page).fill('notes')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(loc.treeEntry(page, 'notes')).toBeVisible()
  await loc.treeEntry(page, 'notes').click()

  await chooseContextAction(page, 'notes', 'New File')
  await loc.filePromptName(page).fill('guide.md')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(loc.treeEntry(page, 'guide.md')).toBeVisible()
  await loc.treeEntry(page, 'guide.md').click()
  await page.getByRole('button', { name: 'Source', exact: true }).click()
  await loc.fileEditor(page).fill('# Guide\n\nPORCELAIN_FILES_SENTINEL\n')
  await expect
    .poll(() => readFile(join(repoDir, 'notes/guide.md'), 'utf8'))
    .toContain('PORCELAIN_FILES_SENTINEL')

  await page.keyboard.press('Meta+Shift+F')
  await page.getByPlaceholder('Search in files…').fill('PORCELAIN_FILES_SENTINEL')
  await expect(page.getByText('notes/guide.md:3')).toBeVisible()
  await page.keyboard.press('Escape')

  await chooseContextAction(page, 'guide.md', 'Rename')
  await loc.filePromptName(page).fill('manual.md')
  await page.getByRole('button', { name: 'Rename', exact: true }).click()
  await expect(loc.treeEntry(page, 'manual.md')).toBeVisible()
  await expect(loc.treeEntry(page, 'guide.md')).toHaveCount(0)

  await chooseContextAction(page, 'manual.md', 'Duplicate')
  await expect(loc.treeEntry(page, 'manual copy.md')).toBeVisible()
  await access(join(repoDir, 'notes/manual copy.md'))

  await chooseContextAction(page, 'manual copy.md', 'Delete')
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(loc.treeEntry(page, 'manual copy.md')).toHaveCount(0)
  await expect(access(join(repoDir, 'notes/manual copy.md'))).rejects.toThrow()
})
