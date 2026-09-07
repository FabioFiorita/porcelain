import { renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({ tablet: true, push: vi.fn(), replace: vi.fn() }))
vi.mock('expo-router', () => ({ useRouter: () => ({ push: ctx.push, replace: ctx.replace }) }))
vi.mock('./use-app-window', () => ({ useIsTablet: () => ctx.tablet }))
vi.mock('@/features/projects', () => ({ useHubRepoPath: () => '/repo' }))
vi.mock('@/features/remote', () => ({ useActiveEnvironment: () => ({ id: 'local' }) }))

import { useFileTabsStore } from '@/features/files/file-tabs-store'
import { useFilesStore } from '@/features/files/files-store'
import { useSurfaceOpen } from './use-surface-open'

beforeEach(() => {
  ctx.push.mockReset()
  ctx.replace.mockReset()
  useFileTabsStore.setState({ owners: {} })
  useFilesStore.getState().reset()
})
it.each([true, false])('uses file tabs on tablet=%s and retains phone navigation', (tablet) => {
  ctx.tablet = tablet
  const { result } = renderHook(() => useSurfaceOpen())
  result.current.file('src/main.ts', 12)
  result.current.file('src/main.ts', 14)
  expect(tablet ? ctx.replace : ctx.push).toHaveBeenLastCalledWith({
    pathname: '/file/[...path]',
    params: { path: ['src', 'main.ts'], line: '14' },
  })
  expect(tablet ? ctx.push : ctx.replace).not.toHaveBeenCalled()
  expect(useFilesStore.getState()).toMatchObject({ selection: 'src/main.ts', selectionLine: 14 })
  const owners = Object.values(useFileTabsStore.getState().owners)
  expect(owners).toHaveLength(tablet ? 1 : 0)
  if (tablet) expect(owners[0].tabs).toEqual([{ path: 'src/main.ts', line: 14 }])
})
