import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { expect, loc, openSurface, TestIds, test, waitForShell } from './helpers/app'

/**
 * Git promotion (#26) proved against the daemon-served client, on a real
 * fixture checkout, through the surfaces a human actually touches.
 *
 * The four things worth proving here and nowhere else, because only an
 * assembled app can show them: that merely OPENING a repository leaves
 * `git status` untouched; that promoting from the sidebar puts exactly the
 * promoted bytes into the working tree and nothing else; that the promoted
 * Canvas then re-opens FROM the tracked source; and that when a private and a
 * tracked Canvas share an id, the tracked one is what the Viewer shows.
 */

interface StoredCanvas {
  id: string
  worktreeId: string | null
  title: string
  kind: 'html' | 'markdown'
  entryFile: string
  createdAt: string
  updatedAt: string
}

const NOW = '2026-08-15T00:00:00.000Z'

/** `git status --porcelain` lines, sorted — the fixture repo starts deliberately dirty. */
function gitStatus(repoDir: string): string[] {
  const raw = execFileSync('git', ['status', '--porcelain=v1', '-uall'], {
    cwd: repoDir,
    encoding: 'utf8',
  }).trim()
  return raw === '' ? [] : raw.split('\n').sort()
}

/** What promotion added to the working tree, and nothing the fixture already had. */
function statusDelta(before: readonly string[], after: readonly string[]): string[] {
  return after.filter((line) => !before.includes(line)).sort()
}

/** Poll the same hub-inventory.json the daemon writes; the Project id is minted at open. */
async function waitForProjectAndWorktree(
  homeDir: string,
): Promise<{ projectId: string; worktreeId: string }> {
  const inventoryPath = join(homeDir, 'hub-inventory.json')
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const parsed = JSON.parse(await readFile(inventoryPath, 'utf8')) as {
        value: { projects: { id: string; worktrees: { id: string }[] }[] }
      }
      const project = parsed.value.projects[0]
      const worktree = project?.worktrees[0]
      if (project !== undefined && worktree !== undefined) {
        return { projectId: project.id, worktreeId: worktree.id }
      }
    } catch {
      // hub-inventory.json not written yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('hub-inventory.json never gained a Project + Worktree')
}

/** Seed a private daemon-root Canvas — the same on-disk shape `porcelain canvas set` writes. */
async function seedPrivateCanvas(
  homeDir: string,
  projectId: string,
  record: StoredCanvas,
  files: Record<string, string>,
): Promise<void> {
  const indexPath = canvasIndexPath(homeDir, projectId)
  await mkdir(join(indexPath, '..'), { recursive: true })
  await writeFile(indexPath, JSON.stringify({ version: 1, value: { canvases: [record] } }))
  const dir = canvasBundleDir(homeDir, projectId, record.id)
  await mkdir(dir, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content)
  }
}

/** Seed a TRACKED Canvas straight into the checkout, as a `git pull` would deliver it. */
async function seedTrackedCanvas(
  repoDir: string,
  record: StoredCanvas,
  files: Record<string, string>,
): Promise<void> {
  const dir = join(repoDir, '.porcelain', 'canvases', record.id)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'canvas.json'), JSON.stringify(record, null, 2))
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content)
  }
}

test('promoting a Canvas writes only the promoted bytes and re-opens from the tracked source', async ({
  page,
  repoDir,
  seeded,
}) => {
  await waitForShell(page)
  const { projectId, worktreeId } = await waitForProjectAndWorktree(seeded.udBase)

  // Opening a repository is not a write. The fixture checkout is deliberately
  // dirty, so the claim is precise: nothing under `.porcelain/` exists yet.
  const beforePromotion = gitStatus(repoDir)
  expect(beforePromotion.filter((line) => line.includes('.porcelain'))).toEqual([])

  await seedPrivateCanvas(
    seeded.udBase,
    projectId,
    {
      id: 'canvas-architecture',
      worktreeId,
      title: 'Architecture',
      kind: 'html',
      entryFile: 'index.html',
      createdAt: NOW,
      updatedAt: NOW,
    },
    { 'index.html': '<!doctype html><html><body><p id="proof">private bytes</p></body></html>' },
  )

  await loc.hubWorktree(page, worktreeId).click()
  await openSurface(page, 'Canvas')

  // A private Canvas carries no tracked badge and does offer promotion.
  await expect(loc.canvasListItem(page, 'canvas-architecture')).toBeVisible()
  await expect(loc.canvasListTracked(page, 'canvas-architecture')).toHaveCount(0)

  await loc.canvasListMenu(page, 'canvas-architecture').click()
  await loc.canvasListPromote(page, 'canvas-architecture').click()
  await loc.canvasPromoteConfirm(page).click()

  // The badge is the user-visible fact that this Canvas now travels with a clone.
  await expect(loc.canvasListTracked(page, 'canvas-architecture')).toBeVisible({ timeout: 15_000 })

  // Git sees the promoted bundle — and ONLY the promoted bundle. No board, no
  // notes, no `.gitignore`, no staged change: promotion writes plain files.
  const added = statusDelta(beforePromotion, gitStatus(repoDir))
  expect(added).toEqual([
    '?? .porcelain/canvases/canvas-architecture/canvas.json',
    '?? .porcelain/canvases/canvas-architecture/index.html',
  ])

  // The tracked manifest is the canonical record, and the private bundle is gone
  // — one copy, not two that can drift apart.
  const manifest = JSON.parse(
    await readFile(
      join(repoDir, '.porcelain', 'canvases', 'canvas-architecture', 'canvas.json'),
      'utf8',
    ),
  ) as StoredCanvas
  expect(manifest.id).toBe('canvas-architecture')
  expect(manifest.worktreeId).toBeNull()
  const privateIndex = JSON.parse(
    await readFile(canvasIndexPath(seeded.udBase, projectId), 'utf8'),
  ) as { value: { canvases: StoredCanvas[] } }
  expect(privateIndex.value.canvases).toEqual([])

  // And it re-opens from the tracked bytes, served in place out of the checkout.
  // Editing the promoted file the way a `git pull` would is what makes this
  // unambiguous: a Viewer reading anything but the checkout shows the old text.
  await writeFile(
    join(repoDir, '.porcelain', 'canvases', 'canvas-architecture', 'index.html'),
    '<!doctype html><html><body><p id="proof">tracked bytes</p></body></html>',
  )
  await loc.canvasListItem(page, 'canvas-architecture').click()
  const frame = page.frameLocator(`[data-testid="${TestIds.canvasIframe}"]`)
  await expect(frame.locator('#proof')).toHaveText('tracked bytes')
})

test('a tracked Canvas wins over a private one with the same id', async ({
  page,
  repoDir,
  seeded,
}) => {
  await waitForShell(page)
  const { projectId, worktreeId } = await waitForProjectAndWorktree(seeded.udBase)

  const shared = {
    id: 'canvas-runbook',
    title: 'Runbook',
    kind: 'html' as const,
    entryFile: 'index.html',
    createdAt: NOW,
    updatedAt: NOW,
  }
  await seedPrivateCanvas(
    seeded.udBase,
    projectId,
    { ...shared, worktreeId, title: 'Runbook (private)' },
    { 'index.html': '<!doctype html><html><body><p id="proof">private bytes</p></body></html>' },
  )
  // The same id arriving through the repository, as a clone or pull delivers it.
  await seedTrackedCanvas(
    repoDir,
    { ...shared, worktreeId: null },
    { 'index.html': '<!doctype html><html><body><p id="proof">tracked bytes</p></body></html>' },
  )

  await loc.hubWorktree(page, worktreeId).click()
  await openSurface(page, 'Canvas')

  // One row, not two, and it is the tracked one.
  await expect(loc.canvasListItem(page, 'canvas-runbook')).toHaveCount(1)
  await expect(loc.canvasListTracked(page, 'canvas-runbook')).toBeVisible()
  await expect(loc.canvasListItem(page, 'canvas-runbook')).toContainText('Runbook')
  await expect(loc.canvasListItem(page, 'canvas-runbook')).not.toContainText('private')

  await loc.canvasListItem(page, 'canvas-runbook').click()
  const frame = page.frameLocator(`[data-testid="${TestIds.canvasIframe}"]`)
  await expect(frame.locator('#proof')).toHaveText('tracked bytes')
})

test('tracking the project defaults writes one file the human can commit', async ({
  page,
  repoDir,
  seeded,
}) => {
  await waitForShell(page)
  const { worktreeId } = await waitForProjectAndWorktree(seeded.udBase)

  await loc.hubWorktree(page, worktreeId).click()
  await openSurface(page, 'Canvas')

  const before = gitStatus(repoDir)
  await loc.canvasTrackDefaults(page).click()
  await loc.canvasTrackDefaultsConfirm(page).click()

  await expect
    .poll(() => statusDelta(before, gitStatus(repoDir)), { timeout: 15_000 })
    .toEqual(['?? .porcelain/project.json'])

  const overrides = JSON.parse(
    await readFile(join(repoDir, '.porcelain', 'project.json'), 'utf8'),
  ) as { hiddenPaths: string[]; pinnedPaths: string[]; worktrees: Record<string, unknown> }
  expect(overrides).toEqual({ hiddenPaths: [], pinnedPaths: [], worktrees: {} })
})
