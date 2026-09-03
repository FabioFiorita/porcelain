// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reviewCanvasDocument, structuredCanvasDocumentSchema } from '@porcelain/contracts/projects'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import {
  legacyProjectOverlayCanvasManifestPath,
  projectOverlayCanvasBundleDir,
  projectOverlayCanvasManifestPath,
  projectOverlayOverridesPath,
  projectPorcelainDir,
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvasAccessTokens } from './canvas-access-tokens'
import { type CanvasOperations, createCanvasOperations } from './canvas-operations'
import { createCanvasOverlayStore } from './canvas-overlay-store'
import { createCanvasStore, type StoredCanvas } from './canvas-store'

/**
 * Git promotion end to end at the operation boundary (#26): private bundle in,
 * tracked bundle out, one canonical copy, and an explicit target every time.
 */

let root = ''
let homeDir = ''
let repo = ''
let operations: CanvasOperations
let store: ReturnType<typeof createCanvasStore>

const PRIVATE_CANVAS: StoredCanvas = {
  id: 'canvas-intent',
  worktreeId: 'wt-1',
  title: 'Intent',
  kind: 'html',
  entryFile: 'index.html',
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T09:00:00.000Z',
}

async function writeIndex(canvases: StoredCanvas[]): Promise<void> {
  const path = canvasIndexPath(homeDir, 'proj-1')
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, `${JSON.stringify({ version: 1, value: { canvases } })}\n`, 'utf8')
}

async function writePrivateBundle(record: StoredCanvas, body: string): Promise<string> {
  const dir = canvasBundleDir(homeDir, 'proj-1', record.id)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, record.entryFile), body, 'utf8')
  return dir
}

async function writeTrackedBundle(record: StoredCanvas, body: string): Promise<string> {
  const dir = projectOverlayCanvasBundleDir(repo, record.id)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, record.entryFile), body, 'utf8')
  await writeFile(
    projectOverlayCanvasManifestPath(repo, record.id),
    `${JSON.stringify(record, null, 2)}\n`,
    'utf8',
  )
  return dir
}

async function readIndexRecords(): Promise<StoredCanvas[]> {
  const raw = JSON.parse(await readFile(canvasIndexPath(homeDir, 'proj-1'), 'utf8')) as {
    value: { canvases: StoredCanvas[] }
  }
  return raw.value.canvases
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-promote-'))
  homeDir = join(root, 'home')
  repo = join(root, 'repo')
  await mkdir(homeDir, { recursive: true })
  await mkdir(repo, { recursive: true })
  store = createCanvasStore({ homeDir })
  operations = createCanvasOperations({
    store,
    overlay: createCanvasOverlayStore(),
    accessTokens: createCanvasAccessTokens(),
    worktrees: {
      listWorktrees: async (projectId) =>
        projectId === 'proj-1'
          ? { ok: true, value: [{ id: 'wt-1', path: repo }] }
          : { ok: false, error: { code: 'projects.not-found' } },
    },
  })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

describe('promoting a Canvas into the Git overlay', () => {
  it('promotes and reads a semantic v2 Review without overwriting its document', async () => {
    const reviewData = {
      title: 'Truthful worktree review',
      why: 'Git state and the UI must tell the same story.',
      how: 'Keep semantic content separate from tracked storage metadata.',
      layers: [{ label: 'Storage boundary', pattern: '^apps/daemon/' }],
      files: [
        {
          path: 'apps/daemon/src/features/projects/canvas-overlay-store.ts',
          source: 'changed' as const,
          layer: 'Storage boundary',
        },
      ],
    }
    const document = reviewCanvasDocument(reviewData)
    const written = await store.writeCanvas('proj-1', {
      id: 'review-structured',
      worktreeId: 'wt-1',
      title: reviewData.title,
      kind: 'structured',
      entryFile: 'canvas.json',
      template: 'review',
      source: {
        kind: 'structured',
        entryFile: 'canvas.json',
        document: `${JSON.stringify(document, null, 2)}\n`,
        extraFiles: [
          {
            path: 'review.json',
            content: `${JSON.stringify(
              {
                name: reviewData.title,
                layers: reviewData.layers,
                files: reviewData.files,
              },
              null,
              2,
            )}\n`,
          },
        ],
      },
    })
    expect(written.ok).toBe(true)

    const promoted = await operations.promoteCanvas({
      projectId: 'proj-1',
      canvasId: 'review-structured',
      path: repo,
    })
    expect(promoted.ok).toBe(true)

    const read = await operations.readCanvas({
      projectId: 'proj-1',
      canvasId: 'review-structured',
      worktreePath: repo,
    })
    if (!read.ok) throw new Error('expected promoted Review to be readable')
    const parsed = structuredCanvasDocumentSchema.parse(JSON.parse(read.value.content))
    expect(parsed).toEqual(document)
    expect(parsed).toMatchObject({
      version: 2,
      template: 'review',
      sections: [
        { title: 'Why', prose: reviewData.why },
        { title: 'How', prose: reviewData.how },
      ],
    })
    expect(
      JSON.parse(
        await readFile(projectOverlayCanvasManifestPath(repo, 'review-structured'), 'utf8'),
      ),
    ).toMatchObject({ id: 'review-structured', entryFile: 'canvas.json', template: 'review' })
    expect(
      JSON.parse(
        await readFile(
          join(projectOverlayCanvasBundleDir(repo, 'review-structured'), 'canvas.json'),
          'utf8',
        ),
      ),
    ).toEqual(document)
  })

  it('moves the bundle into the checkout and leaves no private copy behind', async () => {
    await writeIndex([PRIVATE_CANVAS])
    const privateDir = await writePrivateBundle(PRIVATE_CANVAS, '<p>intent</p>')

    const result = await operations.promoteCanvas({
      projectId: 'proj-1',
      canvasId: 'canvas-intent',
      path: repo,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')

    expect(result.value.bundlePath).toBe(projectOverlayCanvasBundleDir(repo, 'canvas-intent'))
    expect(await readFile(join(result.value.bundlePath, 'index.html'), 'utf8')).toBe(
      '<p>intent</p>',
    )
    // The private copy is gone from BOTH the index and the disk — one canonical
    // source, never a tracked and a private version free to diverge.
    expect(await readIndexRecords()).toEqual([])
    await expect(readdir(privateDir)).rejects.toThrow()
  })

  it('writes a manifest whose Worktree id is null, because tracked bytes travel', async () => {
    await writeIndex([PRIVATE_CANVAS])
    await writePrivateBundle(PRIVATE_CANVAS, '<p>intent</p>')

    await operations.promoteCanvas({
      projectId: 'proj-1',
      canvasId: 'canvas-intent',
      path: repo,
    })

    const manifest = JSON.parse(
      await readFile(projectOverlayCanvasManifestPath(repo, 'canvas-intent'), 'utf8'),
    ) as StoredCanvas
    expect(manifest).toEqual({ ...PRIVATE_CANVAS, worktreeId: null })
  })

  it('never stages or commits — promotion writes plain files', async () => {
    await writeIndex([PRIVATE_CANVAS])
    await writePrivateBundle(PRIVATE_CANVAS, '<p>intent</p>')

    await operations.promoteCanvas({ projectId: 'proj-1', canvasId: 'canvas-intent', path: repo })

    // No git metadata of any kind was created by the operation itself.
    expect(await readdir(root)).toEqual(expect.arrayContaining(['home', 'repo']))
    await expect(readdir(join(repo, '.git'))).rejects.toThrow()
  })

  it('leaves no staging directory behind in the checkout', async () => {
    await writeIndex([PRIVATE_CANVAS])
    await writePrivateBundle(PRIVATE_CANVAS, '<p>intent</p>')

    await operations.promoteCanvas({ projectId: 'proj-1', canvasId: 'canvas-intent', path: repo })

    expect(await readdir(join(projectPorcelainDir(repo), 'canvases'))).toEqual(['canvas-intent'])
  })

  it('reports canvas.not-found when the id is not a private Canvas of this Project', async () => {
    await writeIndex([])
    expect(
      await operations.promoteCanvas({ projectId: 'proj-1', canvasId: 'ghost', path: repo }),
    ).toEqual({ ok: false, error: { code: 'canvas.not-found' } })
  })

  it('reserves manifest.json instead of overwriting a generic entry with that name', async () => {
    const reservedEntry = {
      ...PRIVATE_CANVAS,
      id: 'canvas-reserved-entry',
      entryFile: 'manifest.json',
    }
    await writeIndex([reservedEntry])
    const privateDir = await writePrivateBundle(reservedEntry, '<p>must survive</p>')

    expect(
      await operations.promoteCanvas({
        projectId: 'proj-1',
        canvasId: reservedEntry.id,
        path: repo,
      }),
    ).toEqual({ ok: false, error: { code: 'canvas.unavailable' } })
    expect(await readFile(join(privateDir, 'manifest.json'), 'utf8')).toBe('<p>must survive</p>')
    await expect(readdir(projectOverlayCanvasBundleDir(repo, reservedEntry.id))).rejects.toThrow()
  })
})

describe('the promotion target is explicit', () => {
  it('rejects a path that is not a Worktree of this Project', async () => {
    await writeIndex([PRIVATE_CANVAS])
    await writePrivateBundle(PRIVATE_CANVAS, '<p>intent</p>')
    const stranger = join(root, 'stranger')
    await mkdir(stranger, { recursive: true })

    expect(
      await operations.promoteCanvas({
        projectId: 'proj-1',
        canvasId: 'canvas-intent',
        path: stranger,
      }),
    ).toEqual({ ok: false, error: { code: 'projects.overlay-target-invalid' } })
    // and nothing at all was written into the repository it was aimed at
    await expect(readdir(projectPorcelainDir(stranger))).rejects.toThrow()
  })

  it('rejects a worktreeId that names a different checkout than the path', async () => {
    await writeIndex([PRIVATE_CANVAS])
    await writePrivateBundle(PRIVATE_CANVAS, '<p>intent</p>')

    expect(
      await operations.promoteCanvas({
        projectId: 'proj-1',
        canvasId: 'canvas-intent',
        path: repo,
        worktreeId: 'wt-somewhere-else',
      }),
    ).toEqual({ ok: false, error: { code: 'projects.overlay-target-invalid' } })
    await expect(readdir(projectPorcelainDir(repo))).rejects.toThrow()
  })

  it('rejects overrides aimed at a path that is not a Worktree of this Project', async () => {
    const stranger = join(root, 'stranger')
    await mkdir(stranger, { recursive: true })
    expect(
      await operations.promoteOverrides({
        projectId: 'proj-1',
        path: stranger,
        pinnedPaths: ['a'],
      }),
    ).toEqual({ ok: false, error: { code: 'projects.overlay-target-invalid' } })
  })
})

describe('tracked wins over private', () => {
  it('continues reading legacy HTML and Markdown manifests named canvas.json', async () => {
    const legacyHtml = { ...PRIVATE_CANVAS, worktreeId: null }
    const legacyMarkdown = {
      ...legacyHtml,
      id: 'canvas-legacy-markdown',
      kind: 'markdown' as const,
      entryFile: 'index.md',
    }
    for (const [record, content] of [
      [legacyHtml, '<p>legacy HTML</p>'],
      [legacyMarkdown, '# legacy Markdown'],
    ] as const) {
      const dir = projectOverlayCanvasBundleDir(repo, record.id)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, record.entryFile), content, 'utf8')
      await writeFile(
        legacyProjectOverlayCanvasManifestPath(repo, record.id),
        `${JSON.stringify(record, null, 2)}\n`,
        'utf8',
      )
    }

    const html = await operations.readCanvas({
      projectId: 'proj-1',
      canvasId: legacyHtml.id,
      worktreePath: repo,
    })
    const markdown = await operations.readCanvas({
      projectId: 'proj-1',
      canvasId: legacyMarkdown.id,
      worktreePath: repo,
    })
    expect(html.ok && html.value.content).toContain('legacy HTML')
    expect(markdown.ok && markdown.value.content).toBe('# legacy Markdown')
  })

  it('lists the tracked record and hides the private one with the same id', async () => {
    await writeIndex([PRIVATE_CANVAS])
    await writePrivateBundle(PRIVATE_CANVAS, '<p>private</p>')
    await writeTrackedBundle(
      { ...PRIVATE_CANVAS, worktreeId: null, title: 'Intent (tracked)' },
      '<p>tracked</p>',
    )

    const listed = await operations.listCanvases({ projectId: 'proj-1', worktreePath: repo })
    if (!listed.ok) throw new Error('expected ok')
    expect(listed.value).toHaveLength(1)
    expect(listed.value[0]).toMatchObject({
      id: 'canvas-intent',
      title: 'Intent (tracked)',
      tracked: true,
    })
  })

  it('reads the tracked bytes, not the private ones', async () => {
    await writeIndex([PRIVATE_CANVAS])
    await writePrivateBundle(PRIVATE_CANVAS, '<p>private</p>')
    await writeTrackedBundle({ ...PRIVATE_CANVAS, worktreeId: null }, '<p>tracked</p>')

    const read = await operations.readCanvas({
      projectId: 'proj-1',
      canvasId: 'canvas-intent',
      worktreePath: repo,
    })
    if (!read.ok) throw new Error('expected ok')
    expect(read.value.content).toContain('<p>tracked</p>')
    expect(read.value.content).not.toContain('<p>private</p>')
    expect(read.value.record.tracked).toBe(true)
  })

  it('falls back to the private Canvas when the checkout has no tracked copy', async () => {
    await writeIndex([PRIVATE_CANVAS])
    await writePrivateBundle(PRIVATE_CANVAS, '<p>private</p>')

    const read = await operations.readCanvas({
      projectId: 'proj-1',
      canvasId: 'canvas-intent',
      worktreePath: repo,
    })
    if (!read.ok) throw new Error('expected ok')
    expect(read.value.content).toContain('<p>private</p>')
    expect(read.value.record.tracked).toBe(false)
  })

  it('lists only private Canvases when no checkout is addressed', async () => {
    await writeIndex([PRIVATE_CANVAS])
    await writeTrackedBundle({ ...PRIVATE_CANVAS, worktreeId: null, title: 'Tracked' }, '<p>t</p>')

    const listed = await operations.listCanvases({ projectId: 'proj-1' })
    if (!listed.ok) throw new Error('expected ok')
    expect(listed.value).toEqual([expect.objectContaining({ title: 'Intent', tracked: false })])
  })

  it('replaces tracked bytes when an already-promoted Canvas is updated', async () => {
    await writeIndex([
      { ...PRIVATE_CANVAS, title: 'Updated', updatedAt: '2026-08-15T10:00:00.000Z' },
    ])
    await writePrivateBundle(
      { ...PRIVATE_CANVAS, title: 'Updated', updatedAt: '2026-08-15T10:00:00.000Z' },
      '<p>updated</p>',
    )
    await writeTrackedBundle({ ...PRIVATE_CANVAS, worktreeId: null }, '<p>old</p>')

    const replaced = await operations.promoteCanvas({
      projectId: 'proj-1',
      canvasId: 'canvas-intent',
      path: repo,
      replace: true,
    })
    expect(replaced.ok).toBe(true)
    if (!replaced.ok) throw new Error('expected replace to succeed')

    const read = await operations.readCanvas({
      projectId: 'proj-1',
      canvasId: 'canvas-intent',
      worktreePath: repo,
    })
    if (!read.ok) throw new Error('expected tracked Canvas to be readable')
    expect(read.value.content).toContain('<p>updated</p>')
    expect(read.value.content).not.toContain('<p>old</p>')
    expect(await readIndexRecords()).toEqual([])
  })
})

describe('a promoted bundle stays confined to its own directory', () => {
  it('refuses an entry that escapes the bundle with a relative traversal', async () => {
    await writeFile(join(repo, 'secret.html'), '<p>secret</p>', 'utf8')
    await writeTrackedBundle(
      { ...PRIVATE_CANVAS, worktreeId: null, entryFile: '../../secret.html' },
      '<p>unused</p>',
    )

    expect(
      await operations.readCanvas({
        projectId: 'proj-1',
        canvasId: 'canvas-intent',
        worktreePath: repo,
      }),
    ).toEqual({ ok: false, error: { code: 'canvas.not-found' } })
  })

  it('refuses an entry that escapes the bundle through a symlink', async () => {
    await writeFile(join(repo, 'secret.html'), '<p>secret</p>', 'utf8')
    const dir = await writeTrackedBundle(
      { ...PRIVATE_CANVAS, worktreeId: null, entryFile: 'link.html' },
      '<p>unused</p>',
    )
    // Replace the plain entry with a symlink pointing out of the bundle — the
    // exact shape a hostile clone would commit.
    await rm(join(dir, 'link.html'))
    await symlink(join(repo, 'secret.html'), join(dir, 'link.html'))

    const read = await operations.readCanvas({
      projectId: 'proj-1',
      canvasId: 'canvas-intent',
      worktreePath: repo,
    })
    expect(read).toEqual({ ok: false, error: { code: 'canvas.not-found' } })
  })

  it('never inlines a tracked Canvas author script, unlike a private one', async () => {
    // a promoted Canvas is third-party code once a clone can deliver
    // it. Its `<script src>` is left as a reference the served CSP then refuses,
    // rather than embedded into the document Porcelain hands the iframe.
    const record = { ...PRIVATE_CANVAS, worktreeId: null }
    const dir = await writeTrackedBundle(record, '<script src="app.js"></script>')
    await writeFile(join(dir, 'app.js'), 'window.__ran = true', 'utf8')

    const tracked = await operations.readCanvas({
      projectId: 'proj-1',
      canvasId: 'canvas-intent',
      worktreePath: repo,
    })
    if (!tracked.ok) throw new Error('expected ok')
    expect(tracked.value.content).toContain('src="app.js"')
    expect(tracked.value.content).not.toContain('window.__ran')

    await writeIndex([PRIVATE_CANVAS])
    const privateDir = await writePrivateBundle(PRIVATE_CANVAS, '<script src="app.js"></script>')
    await writeFile(join(privateDir, 'app.js'), 'window.__ran = true', 'utf8')
    const priv = await operations.readCanvas({ projectId: 'proj-1', canvasId: 'canvas-intent' })
    if (!priv.ok) throw new Error('expected ok')
    expect(priv.value.content).toContain('window.__ran')
  })

  it('ignores a bundle whose manifest claims an id other than its directory', async () => {
    await writeTrackedBundle({ ...PRIVATE_CANVAS, worktreeId: null }, '<p>tracked</p>')
    await writeFile(
      projectOverlayCanvasManifestPath(repo, 'canvas-intent'),
      `${JSON.stringify({ ...PRIVATE_CANVAS, id: 'somebody-elses-canvas', worktreeId: null })}\n`,
      'utf8',
    )

    const listed = await operations.listCanvases({ projectId: 'proj-1', worktreePath: repo })
    if (!listed.ok) throw new Error('expected ok')
    expect(listed.value).toEqual([])
  })
})

describe('promoted project overrides', () => {
  it('writes the tracked defaults in the shape the private surfaces already use', async () => {
    const result = await operations.promoteOverrides({
      projectId: 'proj-1',
      path: repo,
      hiddenPaths: ['apps/legacy'],
      pinnedPaths: ['apps/web'],
    })
    expect(result).toEqual({
      ok: true,
      value: {
        hiddenPaths: ['apps/legacy'],
        pinnedPaths: ['apps/web'],
      },
    })
    expect(JSON.parse(await readFile(projectOverlayOverridesPath(repo), 'utf8'))).toEqual(
      result.ok ? result.value : null,
    )
  })

  it('keeps fields the caller did not name, so one promotion never erases another', async () => {
    await operations.promoteOverrides({ projectId: 'proj-1', path: repo, hiddenPaths: ['a'] })
    const second = await operations.promoteOverrides({
      projectId: 'proj-1',
      path: repo,
      pinnedPaths: ['b'],
    })
    expect(second).toEqual({
      ok: true,
      value: { hiddenPaths: ['a'], pinnedPaths: ['b'] },
    })
  })

  it('reports an untouched repository as having no overlay at all', async () => {
    expect(await operations.listOverlay({ path: repo })).toEqual({
      ok: true,
      value: { path: repo, present: false, canvases: [], overrides: null },
    })
  })

  it('reports the overlay contents once something has been promoted', async () => {
    await operations.promoteOverrides({
      projectId: 'proj-1',
      path: repo,
      pinnedPaths: ['apps/web'],
    })
    await writeTrackedBundle({ ...PRIVATE_CANVAS, worktreeId: null }, '<p>tracked</p>')

    const listed = await operations.listOverlay({ path: repo })
    if (!listed.ok) throw new Error('expected ok')
    expect(listed.value.present).toBe(true)
    expect(listed.value.overrides).toEqual({
      hiddenPaths: [],
      pinnedPaths: ['apps/web'],
    })
    expect(listed.value.canvases).toEqual([
      expect.objectContaining({ id: 'canvas-intent', tracked: true }),
    ])
  })
})
