import type {
  WatchInterest,
  WatchInterestRegistration,
} from '@porcelain/client-runtime/session/interests'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { type Pane, useTabsStore } from '@renderer/stores/tabs'
import { useTreeDirsStore } from '@renderer/stores/tree-dirs'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFilesInterestBridge } from './files-interests'

const PROJECT = '/synthetic/repo'

const registrations: WatchInterest[] = []
const release = vi.fn()
const { selectProject } = vi.hoisted(() => ({ selectProject: vi.fn() }))

vi.mock(import('@renderer/lib/daemon'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    primary: {
      ...actual.primary,
      runtime: {
        ...actual.primary.runtime,
        selectProject,
        registerWatchInterest: (interest: WatchInterest): WatchInterestRegistration => {
          registrations.push(interest)
          return { release }
        },
      },
    },
  }
})

function filePane(...paths: string[]): Pane {
  return {
    tabs: paths.map((path) => ({ id: `file:${path}`, kind: 'file', title: path, path })),
    activeTabId: null,
  }
}

beforeEach(() => {
  registrations.length = 0
  release.mockClear()
  selectProject.mockClear()
  useProjectSelectionStore.setState({ project: { path: PROJECT, name: 'repo' } })
  useTabsStore.setState({ panes: [filePane()], activePaneIndex: 0 })
  useTreeDirsStore.setState({ dirs: new Set<string>() })
})

describe('useFilesInterestBridge', () => {
  it('registers open Viewer files and expanded dirs as relative interests', async () => {
    useTabsStore.setState({ panes: [filePane(`${PROJECT}/src/open.ts`)], activePaneIndex: 0 })
    useTreeDirsStore.setState({ dirs: new Set([`${PROJECT}/src`, PROJECT]) })

    renderHook(() => useFilesInterestBridge())

    await waitFor(() => expect(selectProject).toHaveBeenCalledWith(PROJECT))
    await waitFor(() => expect(registrations.length).toBeGreaterThan(0))
    const files = registrations.filter((r) => r.files.length > 0)
    const dirs = registrations.filter((r) => r.dirs.length > 0)
    expect(files.some((r) => r.files.includes(`${PROJECT}/src/open.ts`))).toBe(true)
    expect(dirs.some((r) => r.dirs.includes(`${PROJECT}/src`))).toBe(true)
    // Project root maps to absolute project path via '.' identity.
    expect(dirs.some((r) => r.dirs.includes(PROJECT))).toBe(true)
  })

  it('skips paths outside the project', async () => {
    useTabsStore.setState({
      panes: [filePane('/outside/secret.ts', `${PROJECT}/ok.ts`)],
      activePaneIndex: 0,
    })
    renderHook(() => useFilesInterestBridge())
    await waitFor(() => expect(registrations.length).toBeGreaterThan(0))
    const allFiles = registrations.flatMap((r) => r.files)
    expect(allFiles).toContain(`${PROJECT}/ok.ts`)
    expect(allFiles).not.toContain('/outside/secret.ts')
  })

  it('disposes and rebuilds when the project changes', async () => {
    const { unmount } = renderHook(() => useFilesInterestBridge())
    useTabsStore.setState({ panes: [filePane(`${PROJECT}/a.ts`)], activePaneIndex: 0 })
    await waitFor(() => expect(registrations.length).toBeGreaterThan(0))
    const before = registrations.length

    act(() => {
      useProjectSelectionStore.setState({ project: { path: '/synthetic/other', name: 'other' } })
    })
    await waitFor(() => expect(release).toHaveBeenCalled())

    unmount()
    expect(registrations.length).toBeGreaterThanOrEqual(before)
  })

  it('recomputes when panes or dirs change reactively (not getState snapshot)', async () => {
    renderHook(() => useFilesInterestBridge())
    const before = registrations.length

    act(() => {
      useTabsStore.setState({ panes: [filePane(`${PROJECT}/src/a.ts`)], activePaneIndex: 0 })
    })
    await waitFor(() => expect(registrations.length).toBeGreaterThan(before))

    const mid = registrations.length
    act(() => {
      useTreeDirsStore.setState({ dirs: new Set([`${PROJECT}/src`]) })
    })
    await waitFor(() => expect(registrations.length).toBeGreaterThan(mid))
  })
})
