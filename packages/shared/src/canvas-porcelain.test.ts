import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  canvasBundleDir,
  canvasIndexPath,
  isInsideDir,
  projectCanvasesDir,
} from './canvas-porcelain'

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

describe('isInsideDir', () => {
  it('accepts a direct child', () => {
    expect(isInsideDir('/root', '/root/child.txt')).toBe(true)
  })

  it('accepts a nested descendant', () => {
    expect(isInsideDir('/root', '/root/a/b/c.txt')).toBe(true)
  })

  it('rejects the root itself', () => {
    expect(isInsideDir('/root', '/root')).toBe(false)
  })

  it('rejects a sibling directory that merely shares a prefix', () => {
    expect(isInsideDir('/root', '/root-evil/child.txt')).toBe(false)
  })

  it('rejects a parent traversal', () => {
    expect(isInsideDir('/root', '/root/../outside.txt')).toBe(false)
  })

  it('does not false-positive a name starting with ".." (not startsWith check)', () => {
    expect(isInsideDir('/root', '/root/..foo.txt')).toBe(true)
  })
})
