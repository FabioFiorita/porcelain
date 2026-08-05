import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { INTENT_MANIFEST } from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readIntentDocs } from './intent-docs'

let dir = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'porcelain-intent-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('intent documents', () => {
  it('is empty when the directory does not exist', async () => {
    expect(await readIntentDocs(join(dir, 'nope'))).toEqual([])
  })

  it('picks the medium from the extension and titles from the file name', async () => {
    await writeFile(join(dir, 'index.md'), '# Why')
    await writeFile(join(dir, 'data-flow.excalidraw'), '{"elements":[]}')
    const docs = await readIntentDocs(dir)
    expect(docs.map((d) => [d.file, d.medium, d.label])).toEqual([
      ['data-flow.excalidraw', 'excalidraw', 'Data flow'],
      ['index.md', 'markdown', 'Index'],
    ])
  })

  it('honours manifest order and puts unlisted files after it', async () => {
    await writeFile(join(dir, 'a.md'), 'a')
    await writeFile(join(dir, 'b.md'), 'b')
    await writeFile(join(dir, 'c.md'), 'c')
    await writeFile(
      join(dir, INTENT_MANIFEST),
      JSON.stringify({ tabs: [{ file: 'c.md', label: 'Last first' }, { file: 'b.md' }] }),
    )
    const docs = await readIntentDocs(dir)
    expect(docs.map((d) => d.file)).toEqual(['c.md', 'b.md', 'a.md'])
    expect(docs[0]?.label).toBe('Last first')
  })

  it('inlines a stylesheet and an image so html stays on srcdoc', async () => {
    await mkdir(join(dir, 'assets'), { recursive: true })
    await writeFile(join(dir, 'assets', 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    await writeFile(join(dir, 'index.css'), 'body { color: red }')
    await writeFile(
      join(dir, 'index.html'),
      '<link rel="stylesheet" href="index.css"><img src="assets/shot.png">',
    )
    const [doc] = await readIntentDocs(dir)
    expect(doc?.body).toContain('<style')
    expect(doc?.body).toContain('color: red')
    expect(doc?.body).toContain('data:image/png;base64,')
    // Never a URL — a srcdoc document inherits the parent CSP; a src= one does not.
    expect(doc?.body).not.toContain('href="index.css"')
  })

  it('ignores files it cannot render', async () => {
    await writeFile(join(dir, 'notes.txt'), 'nope')
    await writeFile(join(dir, 'script.js'), 'alert(1)')
    await writeFile(join(dir, 'index.md'), 'yes')
    expect((await readIntentDocs(dir)).map((d) => d.file)).toEqual(['index.md'])
  })

  it('refuses a manifest entry that tries to walk out of the directory', async () => {
    await writeFile(join(dir, 'index.md'), 'ok')
    await writeFile(
      join(dir, INTENT_MANIFEST),
      JSON.stringify({ tabs: [{ file: '../../../etc/passwd' }, { file: 'index.md' }] }),
    )
    expect((await readIntentDocs(dir)).map((d) => d.file)).toEqual(['index.md'])
  })

  it('drops an oversized document instead of throwing', async () => {
    await writeFile(join(dir, 'huge.md'), 'x'.repeat(3 * 1024 * 1024))
    await writeFile(join(dir, 'index.md'), 'small')
    expect((await readIntentDocs(dir)).map((d) => d.file)).toEqual(['index.md'])
  })
})

describe('excalidraw is parsed daemon-side', () => {
  it('hands the renderer a scene, never raw JSON text', async () => {
    await writeFile(join(dir, 'shape.excalidraw'), JSON.stringify({ elements: [{ type: 'rect' }] }))
    const [doc] = await readIntentDocs(dir)
    expect(doc?.medium).toBe('excalidraw')
    expect(doc?.medium === 'excalidraw' && doc.scene.elements).toHaveLength(1)
  })

  it('drops a malformed scene rather than shipping it to the client', async () => {
    await writeFile(join(dir, 'broken.excalidraw'), 'not json at all')
    await writeFile(join(dir, 'index.md'), 'fine')
    expect((await readIntentDocs(dir)).map((d) => d.file)).toEqual(['index.md'])
  })
})
