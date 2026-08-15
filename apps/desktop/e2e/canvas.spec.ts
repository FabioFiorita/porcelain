import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { expect, loc, selectTab, TestIds, test, waitForShell } from './helpers/app'

// A 1x1 transparent PNG — real bytes, so inlineLocalAssets has something to base64.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
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
