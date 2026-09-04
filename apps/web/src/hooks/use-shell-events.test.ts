import { SHELL_HUB_INVENTORIES_QUERY_KEY } from '@renderer/features/projects/hub-inventories'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { handleShellEvent } from './use-shell-events'

function shellUtils(): {
  value: Parameters<typeof handleShellEvent>[1]
  environmentConnections: ReturnType<typeof vi.fn>
} {
  const environmentConnections = vi.fn(async () => undefined)
  return {
    value: {
      environmentConnections: { invalidate: environmentConnections },
      environmentStatuses: { invalidate: vi.fn(async () => undefined) },
      remoteEnvironments: { invalidate: vi.fn(async () => undefined) },
      wslDistributions: { invalidate: vi.fn(async () => undefined) },
    } as never,
    environmentConnections,
  }
}

describe('shell Environment lifecycle events', () => {
  it.each(['remote-environments-changed', 'wsl-environments-changed'] as const)(
    'refreshes the Hub inventory after %s',
    async (event) => {
      const queryClient = new QueryClient()
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
      const shell = shellUtils()

      await handleShellEvent(event, shell.value, queryClient)

      expect(shell.environmentConnections).toHaveBeenCalledOnce()
      expect(invalidate).toHaveBeenCalledWith({
        exact: true,
        queryKey: SHELL_HUB_INVENTORIES_QUERY_KEY,
      })
    },
  )
})
