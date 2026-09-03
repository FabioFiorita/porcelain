import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeCanvasBundle } from '../../features/projects/canvas-write'
import { reviewBundleSource } from './mcp-canvas'

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('Review Canvas bundle source', () => {
  it('copies declared evidence bytes beside the canonical document', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-review-canvas-'))
    dirs.push(root)
    const sourceDir = join(root, 'source')
    const destination = join(root, 'canvas')
    await mkdir(join(sourceDir, 'evidence'), { recursive: true })
    await writeFile(join(sourceDir, 'evidence', 'result.png'), Buffer.from([1, 2, 3, 4]))

    const source = reviewBundleSource(
      {
        title: 'Evidence review',
        sections: [{ title: 'Proof', prose: 'See the attached result.', references: [] }],
        evidence: {
          title: 'Evidence',
          checks: [{ label: 'Focused tests', status: 'pass' }],
          assets: [{ kind: 'image', path: 'evidence/result.png', label: 'Result' }],
        },
        layers: [],
        files: [],
      },
      undefined,
      sourceDir,
    )

    await expect(writeCanvasBundle(destination, source)).resolves.toEqual({ ok: true })
    await expect(readFile(join(destination, 'evidence', 'result.png'))).resolves.toEqual(
      Buffer.from([1, 2, 3, 4]),
    )
    await expect(readFile(join(destination, 'canvas.json'), 'utf8')).resolves.toContain(
      'evidence/result.png',
    )
  })
})
