import type { HubInventory } from '@porcelain/contracts/projects'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import {
  environmentClientFor,
  setPrimaryEnvironmentId,
  THIS_DEVICE_CONNECTION_ID,
} from '@renderer/lib/environment-sessions'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createValidatingTrpcHarness } from '../../hooks/trpc-test-harness'
import { useHubInventories } from './hub-inventories'

// Electron never runs hub-inventories.ts's browser effect, so this suite pins isBrowser
// false to exercise the shell path that must set primaryEnvironmentId instead.
vi.mock('@renderer/lib/platform', () => ({ isBrowser: false, isE2E: false, isLinuxShell: false }))

const {
  LOCAL_ENVIRONMENT_ID,
  REMOTE_ENVIRONMENT_ID,
  registerEnvironmentAlias,
  hubInventoriesQuery,
  localInventory,
  remoteInventory,
} = vi.hoisted(() => {
  const LOCAL_ENVIRONMENT_ID = 'env-local-shell'
  const REMOTE_ENVIRONMENT_ID = 'env-remote-daemon'
  return {
    LOCAL_ENVIRONMENT_ID,
    REMOTE_ENVIRONMENT_ID,
    registerEnvironmentAlias: vi.fn(),
    hubInventoriesQuery: vi.fn(),
    localInventory: {
      environment: {
        id: LOCAL_ENVIRONMENT_ID,
        name: 'This device',
        host: 'macbook',
        platform: 'darwin',
        arch: 'arm64',
      },
      projects: [],
    } as HubInventory,
    remoteInventory: {
      environment: {
        id: REMOTE_ENVIRONMENT_ID,
        name: 'remote',
        host: 'beelink',
        platform: 'linux',
        arch: 'x64',
      },
      projects: [],
    } as HubInventory,
  }
})

vi.mock('@renderer/lib/environment-sessions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@renderer/lib/environment-sessions')>()),
  registerEnvironmentAlias,
}))

vi.mock('@renderer/lib/trpc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/lib/trpc')>()
  return {
    ...actual,
    shellTrpcClient: {
      hubInventories: { query: hubInventoriesQuery },
      environmentDaemonPairs: {
        query: vi.fn().mockResolvedValue([]),
      },
    },
  }
})

beforeEach(() => {
  setPrimaryEnvironmentId(null)
  registerEnvironmentAlias.mockClear()
  // Default fixture: This device is this window's primary — most tests in this file rely on
  // this shape and only override it to exercise the opposite binding.
  hubInventoriesQuery.mockReset().mockResolvedValue([
    { environmentId: null, current: true, inventory: localInventory },
    { environmentId: 'group-remote', current: false, inventory: remoteInventory },
  ])
})

afterEach(() => {
  setPrimaryEnvironmentId(null)
})

describe('useHubInventories on the Electron shell', () => {
  it('registers the local Environment id as primary, so downstream owner lookups resolve', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    })
    renderHook(() => useHubInventories(), { wrapper })

    // Before the fix this stayed null forever: environmentClientFor/environmentSessionFor
    // only recognize a real Environment id as local by matching primaryEnvironmentId, and
    // every Hub selection carries the real id even for the local Environment — so every
    // Files/Git/Search/Terminal/Actions query keyed off a Hub target resolved no owning
    // client and sat disabled indefinitely the moment a worktree was opened.
    await waitFor(() =>
      expect(
        environmentClientFor(LOCAL_ENVIRONMENT_ID, { query: vi.fn() } as never),
      ).not.toBeNull(),
    )
  })

  it('registers a shell alias once per non-current source, daemon-announced id to shell id', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    })
    renderHook(() => useHubInventories(), { wrapper })

    await waitFor(() =>
      expect(registerEnvironmentAlias).toHaveBeenCalledWith(REMOTE_ENVIRONMENT_ID, 'group-remote'),
    )
    // The current (local) source has a null shell identity — nothing to alias.
    expect(registerEnvironmentAlias).toHaveBeenCalledTimes(1)
  })

  it('aliases This device to THIS_DEVICE_CONNECTION_ID when this window is primary-bound to a saved Environment instead', async () => {
    // "Pair & use here" (or restoring a window last bound remote) makes a saved Environment
    // this window's primary, leaving This device as the non-current source — the reverse of
    // every other case in this file. Before the fix, This device's null shell identity was
    // never aliased in this direction, so environmentSessionFor(localRealId) could never
    // resolve it and opening the local Project threw "The target Environment is offline."
    hubInventoriesQuery.mockReset().mockResolvedValue([
      { environmentId: null, current: false, inventory: localInventory },
      { environmentId: 'group-remote', current: true, inventory: remoteInventory },
    ])
    const { wrapper } = createValidatingTrpcHarness({
      daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    })
    renderHook(() => useHubInventories(), { wrapper })

    await waitFor(() =>
      expect(registerEnvironmentAlias).toHaveBeenCalledWith(
        LOCAL_ENVIRONMENT_ID,
        THIS_DEVICE_CONNECTION_ID,
      ),
    )
    // The remote source still aliases too — every non-null shell identity does, current or not.
    expect(registerEnvironmentAlias).toHaveBeenCalledWith(REMOTE_ENVIRONMENT_ID, 'group-remote')
    expect(registerEnvironmentAlias).toHaveBeenCalledTimes(2)
  })
})
