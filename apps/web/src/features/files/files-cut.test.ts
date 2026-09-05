import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { planFileMoves, useFilesCut, useFilesCutStore } from './files-cut'
import { hasUnsavedFiles, trackUnsavedFile } from './files-editing'

const fixture = vi.hoisted(() => ({
  target: { environmentId: 'local', projectId: 'p', worktreeId: 'w', path: '/repo' },
  rename: vi.fn(),
}))
vi.mock('@renderer/stores/hub-repo', () => ({ useHubRepoTarget: () => fixture.target }))
vi.mock('./files-mutations', () => ({ useFilesActions: () => ({ rename: fixture.rename }) }))

describe('file move planning', () => {
  it('moves a dragged selection without replacing the cut clipboard', async () => {
    fixture.rename.mockReset().mockResolvedValue(undefined)
    useFilesCutStore.setState({ target: fixture.target, paths: ['/repo/cut.txt'], busy: false })
    const { result } = renderHook(() => useFilesCut())
    await act(async () => {
      await result.current.paste('/repo/dest', {
        target: fixture.target,
        paths: ['/repo/drag.txt'],
      })
    })
    expect(fixture.rename).toHaveBeenCalledWith('/repo/drag.txt', '/repo/dest/drag.txt')
    expect(useFilesCutStore.getState()).toMatchObject({ paths: ['/repo/cut.txt'], busy: false })
  })
  it('retains only unfinished cuts after a partial failure and releases the busy state', async () => {
    fixture.rename
      .mockReset()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Destination exists'))
    useFilesCutStore.setState({
      target: fixture.target,
      paths: ['/repo/a', '/repo/b'],
      busy: false,
    })
    const { result } = renderHook(() => useFilesCut())
    await act(async () => {
      await expect(result.current.paste('/repo/dest')).rejects.toThrow('Destination exists')
    })
    expect(useFilesCutStore.getState()).toMatchObject({ paths: ['/repo/b'], busy: false })
  })
  it('does not move a cut selection owned by another environment', async () => {
    fixture.rename.mockReset()
    useFilesCutStore.setState({
      target: { ...fixture.target, environmentId: 'remote' },
      paths: ['/repo/a'],
      busy: false,
    })
    const { result } = renderHook(() => useFilesCut())
    expect(result.current.canPaste).toBe(false)
    await result.current.paste('/repo/dest')
    expect(fixture.rename).not.toHaveBeenCalled()
  })
  it('protects unsaved descendants only in their owning environment', () => {
    const target = { environmentId: 'local', projectId: 'p', worktreeId: 'w', path: '/repo' }
    const cleanup = trackUnsavedFile({}, target, '/repo/src/a.ts')
    expect(hasUnsavedFiles(target, ['/repo/src'])).toBe(true)
    expect(hasUnsavedFiles({ ...target, environmentId: 'remote' }, ['/repo/src'])).toBe(false)
    cleanup()
    expect(hasUnsavedFiles(target, ['/repo/src'])).toBe(false)
  })
  it('moves selected ancestors once, without separately moving their children', () => {
    expect(planFileMoves('/repo', ['/repo/src', '/repo/src/a.ts'], '/repo/dest')).toEqual([
      { from: '/repo/src', to: '/repo/dest/src' },
    ])
  })
  it('handles Windows paths and skips moves to the current parent', () => {
    expect(planFileMoves('C:\\repo', ['C:\\repo\\src\\a.ts'], 'C:\\repo')).toEqual([
      { from: 'C:/repo/src/a.ts', to: 'C:/repo/a.ts' },
    ])
    expect(planFileMoves('/repo', ['/repo/a.ts'], '/repo')).toEqual([])
  })
  it('rejects descendants, paths outside the worktree, and duplicate destination names', () => {
    expect(() => planFileMoves('/repo', ['/repo/src'], '/repo/src/child')).toThrow('itself')
    expect(() => planFileMoves('/repo', ['/other/a.ts'], '/repo')).toThrow('worktree')
    expect(() => planFileMoves('/repo', ['/repo/a.ts'], '/other')).toThrow('worktree')
    expect(() => planFileMoves('/repo', ['/repo/a/x', '/repo/b/x'], '/repo')).toThrow('same name')
  })
})
