// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCanvasStore } from './canvas-store'
import { isContainedBundlePath, writeCanvasBundle } from './canvas-write'

let home: string

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'porcelain-canvas-write-'))
})

afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

const PROJECT = 'project-1'

function store(overrides: { now?: () => string; newId?: () => string } = {}) {
  let tick = 0
  return createCanvasStore({
    homeDir: home,
    now: overrides.now ?? (() => `2026-08-18T00:00:0${tick++}.000Z`),
    newId: overrides.newId ?? (() => 'canvas-1'),
  })
}

describe('isContainedBundlePath', () => {
  it.each(['index.html', 'sections/intent.html', './index.md'])('accepts %s', (path) => {
    expect(isContainedBundlePath(path)).toBe(true)
  })

  it.each([
    '',
    '/etc/passwd',
    '../escape.html',
    '../../etc/passwd',
    '..\\win.html',
  ])('refuses %s', (path) => {
    expect(isContainedBundlePath(path)).toBe(false)
  })
})

describe('writeCanvasBundle', () => {
  it('replaces a bundle wholesale rather than merging into it', async () => {
    const dest = join(home, 'bundle')
    await writeCanvasBundle(dest, {
      kind: 'files',
      files: [
        { path: 'index.html', content: 'first' },
        { path: 'stale.html', content: 'gone next time' },
      ],
    })
    await writeCanvasBundle(dest, {
      kind: 'files',
      files: [{ path: 'index.html', content: 'second' }],
    })

    expect(await readFile(join(dest, 'index.html'), 'utf8')).toBe('second')
    await expect(readFile(join(dest, 'stale.html'), 'utf8')).rejects.toThrow()
  })

  it('refuses to write outside the bundle', async () => {
    const result = await writeCanvasBundle(join(home, 'bundle'), {
      kind: 'files',
      files: [{ path: '../escaped.html', content: 'nope' }],
    })
    expect(result).toEqual({ ok: false, error: 'entry-outside-bundle' })
    await expect(readFile(join(home, 'escaped.html'), 'utf8')).rejects.toThrow()
  })

  it('reports a missing source directory instead of writing an empty bundle', async () => {
    const result = await writeCanvasBundle(join(home, 'bundle'), {
      kind: 'directory',
      sourceDir: join(home, 'does-not-exist'),
    })
    expect(result).toEqual({ ok: false, error: 'source-missing' })
  })

  it('copies a directory wholesale, siblings included', async () => {
    const source = join(home, 'source')
    await mkdir(join(source, 'assets'), { recursive: true })
    await writeFile(join(source, 'index.html'), '<h1>hi</h1>')
    await writeFile(join(source, 'assets', 'style.css'), 'body{}')

    const dest = join(home, 'bundle')
    expect(await writeCanvasBundle(dest, { kind: 'directory', sourceDir: source })).toEqual({
      ok: true,
    })
    expect(await readFile(join(dest, 'assets', 'style.css'), 'utf8')).toBe('body{}')
  })
})

describe('canvasStore.writeCanvas', () => {
  it('creates a Canvas the store can read back', async () => {
    const canvases = store()
    const written = await canvases.writeCanvas(PROJECT, {
      worktreeId: null,
      title: 'Explanation',
      kind: 'html',
      entryFile: 'index.html',
      source: { kind: 'files', files: [{ path: 'index.html', content: '<h1>hi</h1>' }] },
    })
    expect(written.ok).toBe(true)

    const read = await canvases.readCanvasEntry(PROJECT, 'canvas-1')
    expect(read.ok && read.value.content).toContain('<h1>hi</h1>')
    const listed = await canvases.listCanvases(PROJECT)
    expect(listed.ok && listed.value).toHaveLength(1)
  })

  it('keeps createdAt when replacing, and does not add a second record', async () => {
    const canvases = store()
    const first = await canvases.writeCanvas(PROJECT, {
      worktreeId: null,
      title: 'One',
      kind: 'html',
      entryFile: 'index.html',
      source: { kind: 'files', files: [{ path: 'index.html', content: 'a' }] },
    })
    if (!first.ok) throw new Error('expected a write')

    const second = await canvases.writeCanvas(PROJECT, {
      id: first.value.id,
      worktreeId: null,
      title: 'One, revised',
      kind: 'html',
      entryFile: 'index.html',
      source: { kind: 'files', files: [{ path: 'index.html', content: 'b' }] },
    })
    if (!second.ok) throw new Error('expected a replace')

    expect(second.value.createdAt).toBe(first.value.createdAt)
    expect(second.value.updatedAt).not.toBe(first.value.updatedAt)
    expect(second.value.title).toBe('One, revised')
    const listed = await canvases.listCanvases(PROJECT)
    expect(listed.ok && listed.value).toHaveLength(1)
  })

  it('carries the review template through so the Review can be found again', async () => {
    const canvases = store()
    await canvases.writeCanvas(PROJECT, {
      worktreeId: null,
      title: 'Active review',
      kind: 'html',
      entryFile: 'index.html',
      template: 'review',
      source: { kind: 'files', files: [{ path: 'index.html', content: 'review' }] },
    })
    const listed = await canvases.listCanvases(PROJECT)
    expect(listed.ok && listed.value[0]?.template).toBe('review')
  })

  it('refuses an entry file that climbs out of the bundle', async () => {
    const canvases = store()
    const result = await canvases.writeCanvas(PROJECT, {
      worktreeId: null,
      title: 'Escape',
      kind: 'html',
      entryFile: '../../../etc/passwd',
      source: { kind: 'files', files: [{ path: 'index.html', content: 'x' }] },
    })
    expect(result).toEqual({ ok: false, error: { code: 'canvas.entry-outside-bundle' } })
    const listed = await canvases.listCanvases(PROJECT)
    expect(listed.ok && listed.value).toHaveLength(0)
  })
})
