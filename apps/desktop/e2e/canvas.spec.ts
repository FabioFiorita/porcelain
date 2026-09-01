import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { expect, loc, selectTab, TestIds, test, waitForShell } from './helpers/app'
// Real bytes, so inlineLocalAssets has something to base64 and the gallery has something to decode.
import { PNG_1PX } from './helpers/review-fixture'

const MP4_1S = Buffer.from(
  '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',
  'base64',
)

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
 * Canvas is Project-scoped, and the daemon only mints a Project id
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
          '<video id="capture" controls src="capture.mp4"></video>',
          '<a href="https://example.com/porcelain-e2e">external link</a>',
          '<script src="app.js"></script>',
          '</body></html>',
        ].join(''),
        'style.css': '#proof { color: rgb(255, 0, 0); }',
        'app.js': 'document.getElementById("proof").dataset.scriptRan = "yes"',
        'shot.png': PNG_1PX,
        'capture.mp4': MP4_1S,
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
  const video = frame.locator('#capture')
  await expect(video).toHaveAttribute('src', 'capture.mp4')
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.duration))
    .toBeGreaterThan(0)

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
