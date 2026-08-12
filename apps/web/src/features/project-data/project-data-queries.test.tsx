import {
  projectDataDispositionsQuery,
  projectDataLayersQuery,
  projectDataNotesQuery,
  projectDataVisibilityQuery,
} from '@porcelain/client-runtime/project-data'
import { projectDataContractFixtures } from '@porcelain/contracts/project-data'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  useCompanionDispositions,
  useCompanionGitVisibility,
  useProjectLayers,
  useProjectNotes,
} from './project-data-queries'
import { projectDataQueryKey } from './project-data-query-key'

const REPO = projectDataContractFixtures.repoNotes.input
const fixtures = projectDataContractFixtures

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

describe('Web Project Data reads', () => {
  beforeEach(() => {
    useProjectSelectionStore.setState({ project: { path: REPO, name: 'repo' }, showHidden: false })
  })

  it('loads fixture notes, layers, dispositions, and visibility via identity keys', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      repoNotes: (input) => {
        expect(input).toBe(REPO)
        return { ok: true, value: fixtures.repoNotes.output }
      },
      repoLayers: (input) => {
        expect(input).toBe(REPO)
        return { ok: true, value: fixtures.repoLayers.output }
      },
      companionDispositions: (input) => {
        expect(input).toBe(REPO)
        return { ok: true, value: [...fixtures.companionDispositions.output] }
      },
      companionGitVisibility: (input) => {
        expect(input).toBe(REPO)
        return { ok: true, value: fixtures.companionGitVisibility.output }
      },
    })

    const notes = renderHook(() => useProjectNotes(), { wrapper })
    const layers = renderHook(() => useProjectLayers(), { wrapper })
    const dispositions = renderHook(() => useCompanionDispositions(), { wrapper })
    const visibility = renderHook(() => useCompanionGitVisibility(), { wrapper })

    await waitFor(() => expect(notes.result.current).toBe(fixtures.repoNotes.output))
    await waitFor(() => expect(layers.result.current).toEqual(fixtures.repoLayers.output))
    await waitFor(() =>
      expect(dispositions.result.current).toEqual([...fixtures.companionDispositions.output]),
    )
    await waitFor(() =>
      expect(visibility.result.current.data).toEqual(fixtures.companionGitVisibility.output),
    )

    expect(mock.requests().filter((r) => r.procedure === 'repoNotes')).toContainEqual({
      procedure: 'repoNotes',
      kind: 'query',
      input: REPO,
    })

    const daemon = { host: 'workstation', version: '0.52.1' }
    expect(projectDataQueryKey(daemon, projectDataNotesQuery(REPO))[0]).toEqual(
      projectDataNotesQuery(REPO),
    )
    expect(projectDataQueryKey(daemon, projectDataLayersQuery(REPO))[0].name).toBe('layers')
    expect(projectDataQueryKey(daemon, projectDataDispositionsQuery(REPO))[0].name).toBe(
      'dispositions',
    )
    expect(projectDataQueryKey(daemon, projectDataVisibilityQuery(REPO))[0].name).toBe('visibility')
  })

  it('returns undefined and does not call a procedure when no project is selected', async () => {
    useProjectSelectionStore.setState({ project: null })
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      repoNotes: () => ({ ok: true, value: fixtures.repoNotes.output }),
      repoLayers: () => ({ ok: true, value: fixtures.repoLayers.output }),
      companionDispositions: () => ({
        ok: true,
        value: [...fixtures.companionDispositions.output],
      }),
      companionGitVisibility: () => ({
        ok: true,
        value: fixtures.companionGitVisibility.output,
      }),
    })

    const notes = renderHook(() => useProjectNotes(), { wrapper })
    const layers = renderHook(() => useProjectLayers(), { wrapper })
    const dispositions = renderHook(() => useCompanionDispositions(), { wrapper })
    const visibility = renderHook(() => useCompanionGitVisibility(), { wrapper })

    expect(notes.result.current).toBeUndefined()
    expect(layers.result.current).toBeUndefined()
    expect(dispositions.result.current).toBeUndefined()
    expect(visibility.result.current.data).toBeUndefined()
    expect(mock.requests().filter((r) => r.procedure !== 'daemonInfo')).toEqual([])
  })
})
