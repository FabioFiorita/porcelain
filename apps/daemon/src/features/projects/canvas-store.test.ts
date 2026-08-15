// @vitest-environment node
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type CanvasStore, createCanvasStore, type StoredCanvas } from './canvas-store'

let homeDir = ''
let store: CanvasStore

const record: StoredCanvas = {
  id: 'canvas-a',
  worktreeId: 'wt-1',
  title: 'Intent',
  kind: 'html',
  entryFile: 'index.html',
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
}

async function writeIndex(projectId: string, canvases: StoredCanvas[]): Promise<void> {
  const path = canvasIndexPath(homeDir, projectId)
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, `${JSON.stringify({ version: 1, value: { canvases } })}\n`, 'utf8')
}

beforeEach(async () => {
  homeDir = await mkdtemp(join(tmpdir(), 'porcelain-canvas-store-'))
  store = createCanvasStore({ homeDir })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(homeDir, { recursive: true, force: true })
})

describe('Canvas store', () => {
  it('lists no canvases for a project with no manifest yet', async () => {
    expect(await store.listCanvases('proj-1')).toEqual({ ok: true, value: [] })
  })

  it('lists the canvases recorded for a Project', async () => {
    await writeIndex('proj-1', [record])
    expect(await store.listCanvases('proj-1')).toEqual({ ok: true, value: [record] })
  })

  it('reports not-found for a canvas id absent from the manifest', async () => {
    await writeIndex('proj-1', [])
    expect(await store.readCanvasEntry('proj-1', 'canvas-a')).toEqual({
      ok: false,
      error: { code: 'canvas.not-found' },
    })
  })

  it('reads the entry file content for a recorded canvas', async () => {
    await writeIndex('proj-1', [record])
    const bundleDir = canvasBundleDir(homeDir, 'proj-1', 'canvas-a')
    await mkdir(bundleDir, { recursive: true })
    await writeFile(join(bundleDir, 'index.html'), '<p>hi</p>', 'utf8')

    const result = await store.readCanvasEntry('proj-1', 'canvas-a')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.value.record).toEqual(record)
    expect(result.value.content).toBe('<p>hi</p>')
    expect(result.value.bundleDir).toBe(bundleDir)
  })

  it('reports not-found when the recorded entry file is missing on disk', async () => {
    await writeIndex('proj-1', [record])
    await mkdir(canvasBundleDir(homeDir, 'proj-1', 'canvas-a'), { recursive: true })
    expect(await store.readCanvasEntry('proj-1', 'canvas-a')).toEqual({
      ok: false,
      error: { code: 'canvas.not-found' },
    })
  })

  it('rejects an entry file a symlink smuggles outside the bundle directory', async () => {
    await writeIndex('proj-1', [record])
    const bundleDir = canvasBundleDir(homeDir, 'proj-1', 'canvas-a')
    await mkdir(bundleDir, { recursive: true })
    const outside = join(homeDir, 'secret.txt')
    await writeFile(outside, 'top secret', 'utf8')
    await symlink(outside, join(bundleDir, 'index.html'))

    expect(await store.readCanvasEntry('proj-1', 'canvas-a')).toEqual({
      ok: false,
      error: { code: 'canvas.entry-outside-bundle' },
    })
  })

  it('rejects a manifest entryFile written as a traversal outside the bundle', async () => {
    await writeIndex('proj-1', [{ ...record, entryFile: '../../secret.txt' }])
    await mkdir(canvasBundleDir(homeDir, 'proj-1', 'canvas-a'), { recursive: true })
    expect(await store.readCanvasEntry('proj-1', 'canvas-a')).toEqual({
      ok: false,
      error: { code: 'canvas.entry-outside-bundle' },
    })
  })
})
