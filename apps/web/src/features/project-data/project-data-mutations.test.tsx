import { projectDataMutations } from '@porcelain/client-runtime/project-data'
import { projectDataContractFixtures } from '@porcelain/contracts/project-data'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useQueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useSetCompanionDisposition,
  useSetCompanionGitVisibility,
  useSetProjectLayers,
  useSetProjectNotes,
} from './project-data-mutations'
import { projectDataQueryKey } from './project-data-query-key'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const fixtures = projectDataContractFixtures
const REPO = fixtures.setRepoNotes.input.repoPath
const OTHER = '/synthetic/other'

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

beforeEach(() => {
  vi.mocked(toast.error).mockReset()
  useProjectSelectionStore.setState({ project: { path: REPO, name: 'repo' }, showHidden: false })
})

function seedIdentities(
  queryClient: ReturnType<typeof useQueryClient>,
  daemon: { host: string | null; version: string | null },
): {
  notes: readonly unknown[]
  layers: readonly unknown[]
  dispositions: readonly unknown[]
  visibility: readonly unknown[]
  otherNotes: readonly unknown[]
} {
  const notesInput = fixtures.setRepoNotes.input
  const layersInput = fixtures.setRepoLayers.input
  const notes = projectDataQueryKey(
    daemon,
    projectDataMutations.setRepoNotes.affectedQueries(notesInput)[0],
  )
  const layers = projectDataQueryKey(
    daemon,
    projectDataMutations.setRepoLayers.affectedQueries(layersInput)[0],
  )
  const visibility = projectDataQueryKey(
    daemon,
    projectDataMutations.setCompanionGitVisibility.affectedQueries(
      fixtures.setCompanionGitVisibility.input,
    )[0],
  )
  const dispositions = projectDataQueryKey(
    daemon,
    projectDataMutations.setCompanionGitVisibility.affectedQueries(
      fixtures.setCompanionGitVisibility.input,
    )[1],
  )
  const otherNotes = projectDataQueryKey(
    daemon,
    projectDataMutations.setRepoNotes.affectedQueries({ repoPath: OTHER, notes: 'x' })[0],
  )
  queryClient.setQueryData(notes, 'old')
  queryClient.setQueryData(layers, { layers: [], custom: false })
  queryClient.setQueryData(dispositions, [])
  queryClient.setQueryData(visibility, { hidden: true })
  queryClient.setQueryData(otherNotes, 'other')
  return { notes, layers, dispositions, visibility, otherNotes }
}

describe('Web Project Data writes', () => {
  it('saves notes with a void save and invalidates only the notes identity', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      setRepoNotes: () => ({ ok: true, value: undefined }),
    })

    const { result } = renderHook(
      () => ({
        save: useSetProjectNotes().save,
        queryClient: useQueryClient(),
        daemon: useDaemonIdentity(),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.daemon.host).toBe('workstation'))

    const daemon = { host: result.current.daemon.host, version: result.current.daemon.version }
    const keys = seedIdentities(result.current.queryClient, daemon)

    const returned = result.current.save(REPO, fixtures.setRepoNotes.input.notes)
    expect(returned).toBeUndefined()

    await waitFor(() =>
      expect(result.current.queryClient.getQueryState(keys.notes)?.isInvalidated).toBe(true),
    )
    expect(mock.requests().filter((r) => r.procedure === 'setRepoNotes')).toContainEqual({
      procedure: 'setRepoNotes',
      kind: 'mutation',
      input: fixtures.setRepoNotes.input,
    })
    expect(result.current.queryClient.getQueryState(keys.layers)?.isInvalidated).toBeFalsy()
    expect(result.current.queryClient.getQueryState(keys.otherNotes)?.isInvalidated).toBeFalsy()
  })

  it('saves layers without toasting and invalidates only the layers identity', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      setRepoLayers: () => ({ ok: true, value: undefined }),
    })

    const { result } = renderHook(
      () => ({
        layers: useSetProjectLayers(),
        queryClient: useQueryClient(),
        daemon: useDaemonIdentity(),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.daemon.host).toBe('workstation'))

    const daemon = { host: result.current.daemon.host, version: result.current.daemon.version }
    const keys = seedIdentities(result.current.queryClient, daemon)

    await act(async () => {
      await result.current.layers.save([...fixtures.setRepoLayers.input.layers])
    })

    expect(mock.requests().filter((r) => r.procedure === 'setRepoLayers')).toContainEqual({
      procedure: 'setRepoLayers',
      kind: 'mutation',
      input: {
        repoPath: REPO,
        layers: [{ label: 'Docs', pattern: '(^|/)docs/' }],
      },
    })
    expect(result.current.queryClient.getQueryState(keys.layers)?.isInvalidated).toBe(true)
    expect(result.current.queryClient.getQueryState(keys.notes)?.isInvalidated).toBeFalsy()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('writes visibility with the contract input and invalidates companion identities only', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      setCompanionGitVisibility: () => ({
        ok: true,
        value: fixtures.setCompanionGitVisibility.output,
      }),
    })

    const { result } = renderHook(
      () => ({
        setVisibility: useSetCompanionGitVisibility(),
        queryClient: useQueryClient(),
        daemon: useDaemonIdentity(),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.daemon.host).toBe('workstation'))

    const daemon = { host: result.current.daemon.host, version: result.current.daemon.version }
    const keys = seedIdentities(result.current.queryClient, daemon)

    await act(async () => {
      await result.current.setVisibility(fixtures.setCompanionGitVisibility.input.hidden)
    })

    expect(
      mock.requests().filter((r) => r.procedure === 'setCompanionGitVisibility'),
    ).toContainEqual({
      procedure: 'setCompanionGitVisibility',
      kind: 'mutation',
      input: fixtures.setCompanionGitVisibility.input,
    })
    expect(result.current.queryClient.getQueryState(keys.visibility)?.isInvalidated).toBe(true)
    expect(result.current.queryClient.getQueryState(keys.dispositions)?.isInvalidated).toBe(true)
    expect(result.current.queryClient.getQueryState(keys.notes)?.isInvalidated).toBeFalsy()
  })

  it('writes disposition with the contract input and invalidates companion identities only', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      setCompanionDisposition: () => ({
        ok: true,
        value: fixtures.setCompanionDisposition.output,
      }),
    })

    const { result } = renderHook(
      () => ({
        disposition: useSetCompanionDisposition(),
        queryClient: useQueryClient(),
        daemon: useDaemonIdentity(),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.daemon.host).toBe('workstation'))

    const daemon = { host: result.current.daemon.host, version: result.current.daemon.version }
    const keys = seedIdentities(result.current.queryClient, daemon)

    let untracked: string[] = []
    await act(async () => {
      untracked = await result.current.disposition.set(
        fixtures.setCompanionDisposition.input.key,
        fixtures.setCompanionDisposition.input.disposition,
      )
    })

    expect(untracked).toEqual([...fixtures.setCompanionDisposition.output.untracked])
    expect(mock.requests().filter((r) => r.procedure === 'setCompanionDisposition')).toContainEqual(
      {
        procedure: 'setCompanionDisposition',
        kind: 'mutation',
        input: fixtures.setCompanionDisposition.input,
      },
    )
    expect(result.current.queryClient.getQueryState(keys.dispositions)?.isInvalidated).toBe(true)
    expect(result.current.queryClient.getQueryState(keys.visibility)?.isInvalidated).toBe(true)
    expect(result.current.queryClient.getQueryState(keys.layers)?.isInvalidated).toBeFalsy()
  })
})
