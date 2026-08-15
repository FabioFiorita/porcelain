import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { expect, loc, openSurface, selectTab, TestIds, test, waitForShell } from './helpers/app'
// Real bytes, so inlineLocalAssets has something to base64 and the gallery has something to decode.
import { PNG_1PX, publishFixtureReview, seedFixtureEvidence } from './helpers/review-fixture'

interface StoredCanvas {
  id: string
  worktreeId: string | null
  title: string
  kind: 'html' | 'markdown'
  entryFile: string
  createdAt: string
  updatedAt: string
}

/**
 * Canvas is Project-scoped (ADR 0002), and the daemon only mints a Project id
 * once a repo is opened — poll the SAME hub-inventory.json the daemon writes
 * (features/projects/hub-inventory-store.ts) rather than guessing an id ahead
 * of the boot that creates it.
 */
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

/** Write a Canvas manifest + bundle directly, same on-disk shape `porcelain canvas set` writes. */
async function seedCanvases(
  homeDir: string,
  projectId: string,
  canvases: StoredCanvas[],
  bundles: Record<string, Record<string, string | Buffer>>,
): Promise<void> {
  const indexPath = canvasIndexPath(homeDir, projectId)
  await mkdir(join(indexPath, '..'), { recursive: true })
  await writeFile(indexPath, JSON.stringify({ version: 1, value: { canvases } }))
  for (const [canvasId, files] of Object.entries(bundles)) {
    const dir = canvasBundleDir(homeDir, projectId, canvasId)
    await mkdir(dir, { recursive: true })
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(dir, name), content)
    }
  }
}

test('Canvas: list, Markdown render, and a sandboxed HTML Canvas with inlined assets + external-link bridge', async ({
  page,
  seeded,
}) => {
  await waitForShell(page)
  const { projectId, worktreeId } = await waitForProjectAndWorktree(seeded.udBase)

  const now = '2026-08-15T00:00:00.000Z'
  await seedCanvases(
    seeded.udBase,
    projectId,
    [
      {
        id: 'canvas-md',
        worktreeId,
        title: 'Notes',
        kind: 'markdown',
        entryFile: 'index.md',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'canvas-html',
        worktreeId,
        title: 'Dashboard',
        kind: 'html',
        entryFile: 'index.html',
        createdAt: now,
        updatedAt: '2026-08-15T01:00:00.000Z',
      },
    ],
    {
      'canvas-md': { 'index.md': '# Canvas notes\n\nHello from Markdown.' },
      'canvas-html': {
        'index.html': [
          '<!doctype html><html><head>',
          '<link rel="stylesheet" href="style.css">',
          '</head><body>',
          '<p id="proof">canvas content</p>',
          '<img id="shot" src="shot.png">',
          '<a href="https://example.com/porcelain-e2e">external link</a>',
          '<script src="app.js"></script>',
          '</body></html>',
        ].join(''),
        'style.css': '#proof { color: rgb(255, 0, 0); }',
        'app.js': 'document.getElementById("proof").dataset.scriptRan = "yes"',
        'shot.png': PNG_1PX,
      },
    },
  )

  // Boot restores the last Project (legacy single-project selection) but Canvas
  // reads the Hub target, which only a Worktree click sets — same as a real user.
  await loc.hubWorktree(page, worktreeId).click()
  await selectTab(page, 'Canvas')

  await expect(loc.canvasListItem(page, 'canvas-md')).toBeVisible()
  await expect(loc.canvasListItem(page, 'canvas-html')).toBeVisible()

  await loc.canvasListItem(page, 'canvas-md').click()
  await expect(page.getByRole('heading', { name: 'Canvas notes' })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)

  await selectTab(page, 'Canvas')
  await loc.canvasListItem(page, 'canvas-html').click()

  const iframe = loc.canvasIframe(page)
  await expect(iframe).toBeVisible()
  // The one flag that must never be there: allow-same-origin would hand this
  // Canvas's JS the app's real origin (localStorage, the daemon token).
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')

  const frame = page.frameLocator(`[data-testid="${TestIds.canvasIframe}"]`)
  // The script ran (inlined <script src>, executed inside the sandboxed doc).
  await expect(frame.locator('#proof')).toHaveAttribute('data-script-ran', 'yes')
  // The stylesheet was inlined and applied.
  await expect(frame.locator('#proof')).toHaveCSS('color', 'rgb(255, 0, 0)')
  // The sibling image was inlined as a data URI, not left as a broken relative src.
  await expect(frame.locator('#shot')).toHaveAttribute('src', /^data:image\/png;base64,/)

  // Neither allow-top-navigation nor allow-popups is granted, so the click-
  // interception bridge is the ONLY way this link can reach anywhere — it must
  // open in a new tab through the app, not navigate the iframe (or fail silently).
  const [popup] = await Promise.all([
    page.context().waitForEvent('page'),
    frame.locator('a').click(),
  ])
  await popup.waitForLoadState('domcontentloaded').catch(() => {})
  expect(popup.url()).toBe('https://example.com/porcelain-e2e')
  await popup.close()
  await expect(iframe).toBeVisible()
})

/**
 * #22's last acceptance criterion, which no single spec covered: the two halves of the Canvas story
 * standing up at the same time on the same Worktree. Proving them apart leaves the interesting
 * failure — Review and the generic Canvases fighting over the Viewer, the surface list, or the
 * Project scope — invisible, because each spec only ever sees its own half of the surface.
 */
test('one Worktree carries several Canvases alongside a Review Canvas with image and video evidence', async ({
  page,
  repoDir,
  seeded,
}) => {
  await waitForShell(page)
  const { projectId, worktreeId } = await waitForProjectAndWorktree(seeded.udBase)

  const now = '2026-08-15T00:00:00.000Z'
  await seedCanvases(
    seeded.udBase,
    projectId,
    [
      {
        id: 'canvas-architecture',
        worktreeId,
        title: 'Architecture',
        kind: 'html',
        entryFile: 'index.html',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'canvas-runbook',
        worktreeId,
        title: 'Runbook',
        kind: 'markdown',
        entryFile: 'index.md',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'canvas-glossary',
        worktreeId,
        title: 'Glossary',
        kind: 'markdown',
        entryFile: 'index.md',
        createdAt: now,
        updatedAt: now,
      },
    ],
    {
      'canvas-architecture': {
        'index.html':
          '<!doctype html><html><body><p id="proof">architecture canvas</p>' +
          '<img id="diagram" src="diagram.png"></body></html>',
        'diagram.png': PNG_1PX,
      },
      'canvas-runbook': { 'index.md': '# Runbook\n\nHow to operate the thing.' },
      'canvas-glossary': { 'index.md': '# Glossary\n\nWords and what they mean.' },
    },
  )

  await publishFixtureReview(repoDir, seeded.env, {
    name: 'Composed Canvas unit',
    thesis: 'Review and the generic Canvases share one Worktree.',
    sectionTitle: 'Scope',
    sectionProse: 'The Worktree carries three Canvases and a Review with media evidence.',
  })
  await seedFixtureEvidence(repoDir)

  await loc.hubWorktree(page, worktreeId).click()

  // Half one: this Worktree lists more than one generic Canvas, and each one opens in the Viewer.
  await openSurface(page, 'Canvas')
  for (const id of ['canvas-architecture', 'canvas-runbook', 'canvas-glossary']) {
    await expect(loc.canvasListItem(page, id)).toBeVisible()
  }

  await loc.canvasListItem(page, 'canvas-runbook').click()
  await expect(page.getByRole('heading', { name: 'Runbook' })).toBeVisible()

  await openSurface(page, 'Canvas')
  await loc.canvasListItem(page, 'canvas-glossary').click()
  await expect(page.getByRole('heading', { name: 'Glossary' })).toBeVisible()

  await openSurface(page, 'Canvas')
  await loc.canvasListItem(page, 'canvas-architecture').click()
  const frame = page.frameLocator(`[data-testid="${TestIds.canvasIframe}"]`)
  await expect(frame.locator('#proof')).toHaveText('architecture canvas')
  await expect(frame.locator('#diagram')).toHaveAttribute('src', /^data:image\/png;base64,/)

  // Half two: the same Worktree's Review Canvas, with image AND video evidence in one gallery.
  await openSurface(page, 'Review')
  await expect(loc.reviewOpen(page)).toBeVisible({ timeout: 15_000 })
  await loc.reviewOpen(page).click()
  await expect(loc.activeReview(page)).toContainText('Composed Canvas unit', { timeout: 15_000 })
  for (const tab of ['intent', 'process', 'execution', 'evidence'] as const) {
    await expect(loc.activeReviewTab(page, tab)).toBeVisible()
  }
  await loc.activeReviewTab(page, 'evidence').click()
  await loc.evidenceSubTab(page, 'assets').click()
  await expect(loc.evidenceGalleryItem(page, 'shot.png')).toBeVisible()
  await expect(loc.evidenceGalleryItem(page, 'capture.mp4')).toBeVisible()
  await expect(page.locator('video')).toHaveAttribute('src', /^data:video\/mp4;base64,/)

  // And the Canvases are still there — Review did not take the surface over.
  await openSurface(page, 'Canvas')
  await expect(loc.canvasListItem(page, 'canvas-architecture')).toBeVisible()
  await expect(loc.canvasListItem(page, 'canvas-runbook')).toBeVisible()
  await expect(loc.canvasListItem(page, 'canvas-glossary')).toBeVisible()
})
