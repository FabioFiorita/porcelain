import type { HubInventory } from '@porcelain/contracts/projects'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { environmentClientFor, setPrimaryEnvironmentId } from '@renderer/lib/environment-sessions'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createValidatingTrpcHarness } from '../../hooks/trpc-test-harness'
import { useHubInventories } from './hub-inventories'

// Electron never runs hub-inventories.ts's browser effect, so this suite pins isBrowser
// false to exercise the shell path that must set primaryEnvironmentId instead.
vi.mock('@renderer/lib/platform', () => ({ isBrowser: false, isE2E: false, isLinuxShell: false }))

const LOCAL_ENVIRONMENT_ID = 'env-local-shell'

vi.mock('@renderer/lib/trpc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/lib/trpc')>()
  const inventory: HubInventory = {
    environment: {
      id: 'env-local-shell',
      name: 'This device',
      host: 'macbook',
      platform: 'darwin',
      arch: 'arm64',
    },
    projects: [],
  }
  return {
    ...actual,
    shellTrpcClient: {
      hubInventories: {
        query: vi.fn().mockResolvedValue([{ environmentId: null, current: true, inventory }]),
      },
    },
  }
})

beforeEach(() => {
  setPrimaryEnvironmentId(null)
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
})
