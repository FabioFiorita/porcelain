import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import {
  invalidateCanvasNotification,
  invalidateProjectsInventoryNotification,
} from './canvas-notifications'
import { SHELL_HUB_INVENTORIES_QUERY_KEY } from './hub-inventories'

describe('Project inventory notification', () => {
  it('refreshes the combined shell inventory and only the announcing browser Environment', async () => {
    const client = new QueryClient()
    const primaryKey = [
      { domain: 'projects', name: 'hub-inventory' },
      { host: 'local', version: '1' },
    ] as const
    const remoteAKey = ['browser', 'hubInventory', 'remote-a'] as const
    const remoteBKey = ['browser', 'hubInventory', 'remote-b'] as const
    client.setQueryData(SHELL_HUB_INVENTORIES_QUERY_KEY, 'shell')
    client.setQueryData(primaryKey, 'primary')
    client.setQueryData(remoteAKey, 'a')
    client.setQueryData(remoteBKey, 'b')

    await invalidateProjectsInventoryNotification(client, 'remote-a')

    expect(client.getQueryState(SHELL_HUB_INVENTORIES_QUERY_KEY)?.isInvalidated).toBe(true)
    expect(client.getQueryState(primaryKey)?.isInvalidated).toBe(false)
    expect(client.getQueryState(remoteAKey)?.isInvalidated).toBe(true)
    expect(client.getQueryState(remoteBKey)?.isInvalidated).toBe(false)
  })
})

describe('Canvas notification', () => {
  it('refreshes both primary query key forms without crossing into a remote Environment', async () => {
    const client = new QueryClient()
    const identity = { domain: 'projects', name: 'canvas', projectId: 'project-1' }
    const daemon = { host: 'local', version: '1' }
    const implicitPrimary = [identity, daemon, null] as const
    const explicitPrimary = [identity, daemon, 'primary-environment'] as const
    const remote = [identity, daemon, 'remote-environment'] as const
    client.setQueryData(implicitPrimary, 'implicit')
    client.setQueryData(explicitPrimary, 'explicit')
    client.setQueryData(remote, 'remote')

    await invalidateCanvasNotification(
      {
        kind: 'review.canvas-changed',
        projectId: 'project-1',
        projectPath: 'C:/repo',
      },
      client,
      [null, 'primary-environment'],
      daemon,
    )

    expect(client.getQueryState(implicitPrimary)?.isInvalidated).toBe(true)
    expect(client.getQueryState(explicitPrimary)?.isInvalidated).toBe(true)
    expect(client.getQueryState(remote)?.isInvalidated).toBe(false)
  })
})
