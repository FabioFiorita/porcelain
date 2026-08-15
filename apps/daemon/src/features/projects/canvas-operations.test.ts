// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type CanvasOperations, createCanvasOperations } from './canvas-operations'
import { createCanvasStore, type StoredCanvas } from './canvas-store'

let homeDir = ''
let operations: CanvasOperations

const htmlRecord: StoredCanvas = {
  id: 'canvas-html',
  worktreeId: 'wt-1',
  title: 'Intent',
  kind: 'html',
  entryFile: 'index.html',
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T09:00:00.000Z',
}

const markdownRecord: StoredCanvas = {
  id: 'canvas-md',
  worktreeId: 'wt-1',
  title: 'Notes',
  kind: 'markdown',
  entryFile: 'index.md',
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T01:00:00.000Z',
}

async function writeIndex(projectId: string, canvases: StoredCanvas[]): Promise<void> {
  const path = canvasIndexPath(homeDir, projectId)
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, `${JSON.stringify({ version: 1, value: { canvases } })}\n`, 'utf8')
}

beforeEach(async () => {
  homeDir = await mkdtemp(join(tmpdir(), 'porcelain-canvas-ops-'))
  operations = createCanvasOperations({ store: createCanvasStore({ homeDir }) })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(homeDir, { recursive: true, force: true })
})

describe('Canvas operations', () => {
  it('lists Canvases newest-updated first as public records with no storage detail', async () => {
    await writeIndex('proj-1', [markdownRecord, htmlRecord])
    const result = await operations.listCanvases({ projectId: 'proj-1' })
    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: 'canvas-html',
          worktreeId: 'wt-1',
          title: 'Intent',
          kind: 'html',
          createdAt: '2026-08-15T00:00:00.000Z',
          updatedAt: '2026-08-15T09:00:00.000Z',
        },
        {
          id: 'canvas-md',
          worktreeId: 'wt-1',
          title: 'Notes',
          kind: 'markdown',
          createdAt: '2026-08-15T00:00:00.000Z',
          updatedAt: '2026-08-15T01:00:00.000Z',
        },
      ],
    })
  })

  it('reports canvas.not-found reading an unknown canvas', async () => {
    await writeIndex('proj-1', [])
    expect(await operations.readCanvas({ projectId: 'proj-1', canvasId: 'nope' })).toEqual({
      ok: false,
      error: { code: 'canvas.not-found' },
    })
  })

  it('returns Markdown content unmodified', async () => {
    await writeIndex('proj-1', [markdownRecord])
    const bundleDir = canvasBundleDir(homeDir, 'proj-1', 'canvas-md')
    await mkdir(bundleDir, { recursive: true })
    await writeFile(join(bundleDir, 'index.md'), '# Notes\n\n![shot](shot.png)', 'utf8')

    const result = await operations.readCanvas({ projectId: 'proj-1', canvasId: 'canvas-md' })
    expect(result).toEqual({
      ok: true,
      value: {
        record: {
          id: 'canvas-md',
          worktreeId: 'wt-1',
          title: 'Notes',
          kind: 'markdown',
          createdAt: '2026-08-15T00:00:00.000Z',
          updatedAt: '2026-08-15T01:00:00.000Z',
        },
        content: '# Notes\n\n![shot](shot.png)',
      },
    })
  })

  it('inlines a relative sibling image into HTML content as a data URI', async () => {
    await writeIndex('proj-1', [htmlRecord])
    const bundleDir = canvasBundleDir(homeDir, 'proj-1', 'canvas-html')
    await mkdir(bundleDir, { recursive: true })
    await writeFile(join(bundleDir, 'index.html'), '<img src="shot.png">', 'utf8')
    await writeFile(join(bundleDir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    const result = await operations.readCanvas({ projectId: 'proj-1', canvasId: 'canvas-html' })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.value.content).toContain('data:image/png;base64,')
    expect(result.value.content).not.toContain('src="shot.png"')
  })
})
