import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  environment: { id: 'one' },
  repo: '/repo',
  move: vi.fn(),
  replace: vi.fn(),
}))
vi.mock('@/features/remote', () => ({ useActiveEnvironment: () => ctx.environment }))
vi.mock('@/features/projects', () => ({ useHubRepoPath: () => ctx.repo }))
vi.mock('./files-mutations', () => ({ useFileWrites: () => ({ move: ctx.move }) }))
vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: ctx.replace }),
  usePathname: () => '/file/src/main.ts',
}))

import { planRelativeMoves, useFilesMoveStore, useFilesMoves } from './files-moves'
import { useFilesStore } from './files-store'

beforeEach(() => {
  ctx.environment = { id: 'one' }
  ctx.repo = '/repo'
  ctx.move.mockReset().mockResolvedValue(undefined)
  ctx.replace.mockReset()
  useFilesMoveStore.setState({ cut: null, busy: false })
  useFilesStore.getState().reset()
})

describe('mobile Files moves', () => {
  it('moves selected parents once and omits paths already at the destination', () => {
    expect(planRelativeMoves(['src', 'src/main.ts', 'src', 'archive/other'], 'archive')).toEqual([
      { from: 'src', to: 'archive/src' },
    ])
  })
  it('rejects unsafe destinations and ambiguous names before writing', () => {
    expect(() => planRelativeMoves(['src'], 'src/nested')).toThrow('itself')
    expect(() => planRelativeMoves(['a/main.ts', 'b/main.ts'], '')).toThrow('same name')
    expect(() => planRelativeMoves(['src'], '../outside')).toThrow('inside')
  })
  it('retains only unfinished paths after a partial failure', async () => {
    ctx.move.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Destination exists'))
    const { result } = renderHook(() => useFilesMoves())
    act(() => result.current.cut(['a.ts', 'b.ts']))
    await act(async () => {
      await expect(result.current.paste('src')).rejects.toThrow('Destination exists')
    })
    expect(useFilesMoveStore.getState().cut?.paths).toEqual(['b.ts'])
    expect(useFilesMoveStore.getState().busy).toBe(false)
  })
  it('refuses pasting the clipboard into a different environment or worktree', async () => {
    const { result, rerender } = renderHook(() => useFilesMoves())
    act(() => result.current.cut(['a.ts']))
    ctx.environment = { id: 'two' }
    rerender()
    expect(result.current.canPaste).toBe(false)
    await act(() => result.current.paste('src'))
    ctx.environment = { id: 'one' }
    ctx.repo = '/other'
    rerender()
    await act(() => result.current.paste('src'))
    expect(ctx.move).not.toHaveBeenCalled()
    expect(useFilesMoveStore.getState().cut?.paths).toEqual(['a.ts'])
  })
  it('stops a batch if the active owner changes while a move is in flight', async () => {
    let finish!: () => void
    ctx.move.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const { result, rerender } = renderHook(() => useFilesMoves())
    act(() => result.current.cut(['a.ts', 'b.ts']))
    let pending!: Promise<void>
    act(() => {
      pending = result.current.paste('src')
    })
    ctx.environment = { id: 'two' }
    rerender()
    await act(async () => {
      finish()
      await expect(pending).rejects.toThrow('worktree changed')
    })
    expect(ctx.move).toHaveBeenCalledTimes(1)
    expect(useFilesMoveStore.getState().cut?.paths).toEqual(['b.ts'])
    expect(ctx.replace).not.toHaveBeenCalled()
  })
  it('retargets the open file when its parent moves and preserves unrelated cut paths for explicit moves', async () => {
    const { result } = renderHook(() => useFilesMoves())
    act(() => {
      useFilesStore.getState().openFile('src/main.ts')
      result.current.cut(['other.ts'])
    })
    await act(() =>
      result.current.move('archive', { environmentId: 'one', repoPath: '/repo', paths: ['src'] }),
    )
    expect(useFilesStore.getState().selection).toBe('archive/src/main.ts')
    expect(ctx.replace).toHaveBeenCalledWith({
      pathname: '/file/[...path]',
      params: { path: ['archive', 'src', 'main.ts'] },
    })
    expect(useFilesMoveStore.getState().cut?.paths).toEqual(['other.ts'])
  })
})
