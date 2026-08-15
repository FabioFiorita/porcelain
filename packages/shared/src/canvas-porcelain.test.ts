import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { canvasBundleDir, canvasIndexPath, projectCanvasesDir } from './canvas-porcelain'

describe('canvas-porcelain layout', () => {
  it('nests canvases under the Project, not a Worktree', () => {
    expect(projectCanvasesDir('/home/u/.porcelain', 'proj-1')).toBe(
      join('/home/u/.porcelain', 'projects', 'proj-1', 'canvases'),
    )
  })

  it('resolves the index manifest inside the Project canvases dir', () => {
    expect(canvasIndexPath('/home/u/.porcelain', 'proj-1')).toBe(
      join('/home/u/.porcelain', 'projects', 'proj-1', 'canvases', 'index.json'),
    )
  })

  it('resolves one bundle directory per Canvas id', () => {
    expect(canvasBundleDir('/home/u/.porcelain', 'proj-1', 'canvas-a')).toBe(
      join('/home/u/.porcelain', 'projects', 'proj-1', 'canvases', 'canvas-a'),
    )
  })
})
