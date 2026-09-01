import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { useHubRepoOwner } from '@renderer/hooks/use-hub-owner'
import {
  ensureEnvironmentSession,
  setBrowserEnvironmentConnections,
  setPrimaryEnvironmentId,
} from '@renderer/lib/environment-sessions'
import { HubRepoProvider } from '@renderer/stores/hub-repo'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

const TARGET = {
  environmentId: 'env-secondary',
  projectId: 'project-secondary',
  worktreeId: 'worktree-secondary',
  path: '/secondary/repo',
} as const

afterEach(() => {
  setBrowserEnvironmentConnections([])
  setPrimaryEnvironmentId(null)
})

describe('useHubRepoOwner for Review', () => {
  it('resolves the selected secondary client and scopes its cache identity', async () => {
    const connection = {
      id: TARGET.environmentId,
      name: 'Secondary',
      url: 'http://127.0.0.1:43220',
      token: 'pc_client_secondary_secret',
    }
    setBrowserEnvironmentConnections([connection])
    const secondary = ensureEnvironmentSession(connection)
    const { wrapper: inner } = createValidatingTrpcHarness({
      daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    })
    const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
      <HubRepoProvider target={TARGET}>{inner({ children })}</HubRepoProvider>
    )

    const { result } = renderHook(() => useHubRepoOwner(), { wrapper })
    await waitFor(() => expect(result.current.owner?.client).toBe(secondary.client))
    expect(result.current.repoPath).toBe(TARGET.path)
    expect(result.current.daemon.host).toBe(TARGET.environmentId)
  })

  it('refuses an unknown secondary id instead of borrowing the primary client', () => {
    setPrimaryEnvironmentId('env-primary')
    const { wrapper: inner } = createValidatingTrpcHarness({
      daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    })
    const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
      <HubRepoProvider target={TARGET}>{inner({ children })}</HubRepoProvider>
    )

    const { result } = renderHook(() => useHubRepoOwner(), { wrapper })
    expect(result.current.owner).toBeNull()
  })
})
